/**
 * TEKTONE Kanban API — Cloudflare Pages Function (KV-backed).
 * Ported from the growth worker. Bound to the KANBAN KV namespace.
 *
 * KV keys:
 *   kanban:clients   → [{ id, name, color }]
 *   kanban:cards     → [{ id, columnId, title, description, priority, clientId, assignee, dueDate, order, labelColor, createdAt, reviewed, reviewedAt, reviewedBy }]
 *   kanban:members   → [{ id, name, email, role }]
 *   kanban:notifLog  → [{ id, type, to, fromName, fromEmail, cardId, cardTitle, clientId, commentId, text, createdAt, readAt }]
 *                      persistent per-recipient notification history (mentions, requests, assignments, nudges, reviews, reopens) — never deleted, only readAt-stamped
 *   push:web         → { [email]: [{ endpoint, expirationTime, keys }, ...] }  (written by functions/api/push/[[path]].js)
 *   push:expo        → { [email]: [expoPushToken, ...] }                       (written by functions/api/push/[[path]].js)
 *   kanban:todos:<email> → [{ id, text, done, createdAt }]  private personal daily
 *                          checklist, one key per user — never visible to anyone else
 *
 * Routes (relative to /api/kanban):
 *   GET|POST          /clients          PUT|DELETE /clients/:id
 *   GET|POST          /cards            PUT|DELETE /cards/:id
 *   POST              /cards/:id/review           — mark reviewed, move to Done, notify + broadcast
 *   POST              /cards/review-bulk          — same, for a batch of ids
 *   POST              /cards/reorder              — { columnId, orderedIds } re-numbers `order` within a column
 *   GET|POST          /members          PUT|DELETE /members/:id
 *   GET                /notifications              — { items, unreadCount } from kanban:notifLog, for the current user
 *   POST               /notifications/ack           — { ids } or { all: true }, marks readAt
 *   GET|POST          /todos            PUT|DELETE /todos/:id  — private per-user daily checklist
 *
 * A "reviewed" event is recorded as a system comment (kind: "reviewed") on the
 * card so it stays visible in the card's own thread; it also writes a
 * kanban:notifLog entry (type "reviewed") for the bell/log.
 */

import { getSessionEmail } from "../../_lib/session.js";
import { isAdmin } from "../../_lib/allowlist.js";
import { buildPushPayload } from "@block65/webcrypto-web-push";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const REVIEW_TTL_MS = 21 * 24 * 60 * 60 * 1000; // pending reviews expire after 21 days

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function uid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

async function kvGet(kv, key, fallback = []) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const kvSet = (kv, key, value) => kv.put(key, JSON.stringify(value));

const NOTIF_LOG_CAP = 500;

// Persistent, per-recipient notification log — replaces the old "recompute
// from unread comments" bell and the separate kanban:nudges store. Entries
// are never deleted, only marked readAt on ack, so the log doubles as a
// scrollable history. One entry per (event, recipient).
async function pushNotifs(kv, entries) {
  if (!entries.length) return;
  const log = await kvGet(kv, "kanban:notifLog", []);
  for (const e of entries) {
    log.push({
      id: uid(),
      commentId: null,
      clientId: null,
      createdAt: new Date().toISOString(),
      readAt: null,
      ...e,
    });
  }
  const trimmed = log.length > NOTIF_LOG_CAP ? log.slice(log.length - NOTIF_LOG_CAP) : log;
  await kvSet(kv, "kanban:notifLog", trimmed);
}

// Web Push send — best-effort, never throws. Prunes subscriptions the push
// service reports as gone (404/410); leaves them on any other error (a
// network hiccup shouldn't nuke a still-valid subscription).
async function sendWebPush(env, kv, email, { title, body, cardId }) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return;
  const all = await kvGet(kv, "push:web", {});
  const subs = all[email];
  if (!subs?.length) return;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const message = {
    data: JSON.stringify({ title, body, cardId }),
    options: { ttl: 900, urgency: "high" },
  };

  let changed = false;
  const kept = [];
  for (const sub of subs) {
    try {
      const payload = await buildPushPayload(message, sub, vapid);
      const res = await fetch(sub.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        changed = true;
        continue;
      }
    } catch {
      /* transient — keep the subscription */
    }
    kept.push(sub);
  }
  if (changed) {
    all[email] = kept;
    await kvSet(kv, "push:web", all);
  }
}

// Expo push send (mobile) — a single relay call handles both Android/FCM and
// iOS/APNs; best-effort, never throws.
async function sendExpoPush(env, kv, email, { title, body, cardId }) {
  const all = await kvGet(kv, "push:expo", {});
  const tokens = all[email];
  if (!tokens?.length) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, sound: "default", data: { cardId } }))),
  }).catch(() => {});
}

// Fires both push channels for a batch of recipients, in parallel, wrapped
// so a push failure never affects the request it's attached to.
function dispatchPush(context, env, kv, recipients, payload) {
  for (const to of recipients) {
    context.waitUntil(sendWebPush(env, kv, to, payload).catch(() => {}));
    context.waitUntil(sendExpoPush(env, kv, to, payload).catch(() => {}));
  }
}

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Members whose @firstname appears in the text (e.g. "@Pedro").
function parseMentions(text, members) {
  const t = String(text || "");
  return members.filter((m) => {
    const first = String(m.name || "").split(/\s+/)[0];
    return first && new RegExp(`@${reEscape(first)}\\b`, "i").test(t);
  });
}

// Best-effort email via Resend (no-op without RESEND_API_KEY).
async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY || !to?.length) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || "TEKTONE <notificacoes@tektone.com.br>",
      to,
      subject,
      text,
      html,
      reply_to: replyTo || undefined,
    }),
  });
}

const escHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const initialsOf = (name) =>
  (name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const hueOf = (name) => (name ? (name.charCodeAt(0) * 47) % 360 : 200);

// Drop recipients who opted out of email notifications on their profile
// (in-app/bell notifications are never filtered — this is email-only).
function filterOptedIn(emails, authUsers) {
  const optedOut = new Set(
    authUsers
      .filter((u) => u.emailNotifications === false)
      .map((u) => String(u.email).toLowerCase())
  );
  return emails.filter((e) => !optedOut.has(String(e).toLowerCase()));
}

// Branded "Mineral" transactional email for a comment / material request / review.
function notificationEmail({ authorName, authorEmail, authorHasAvatar, kind, text, cardTitle, projectName, projectColor, cardUrl, firstNames }) {
  const isReq = kind === "request";
  const isReviewed = kind === "reviewed";
  const tag = isReviewed
    ? { label: "Tarefa concluída", color: "#2E4A43", bg: "rgba(46,74,67,0.14)" }
    : isReq
      ? { label: "Nova solicitação", color: "#B8862F", bg: "rgba(184,134,47,0.14)" }
      : { label: "Novo comentário", color: "#2E4A43", bg: "rgba(46,74,67,0.12)" };
  const verb = isReviewed ? "revisou e concluiu" : isReq ? "fez uma solicitação" : "comentou";
  const caption = isReviewed ? "concluiu esta tarefa" : `${verb} em uma tarefa`;

  const body = escHtml(text)
    .replace(/@(\w+)/g, (m, n) =>
      firstNames.has(n.toLowerCase())
        ? `<strong style="color:#2E4A43;">${m}</strong>`
        : m
    )
    .replace(/\n/g, "<br>");

  const pill = projectName
    ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:${projectColor || "#6b6355"};background:${(projectColor || "#8A8579")}22;padding:3px 9px;border-radius:6px;">${escHtml(projectName)}</span>`
    : "";

  const avatarCell = authorHasAvatar
    ? `<img src="https://tasks.tektone.com.br/api/avatar?email=${encodeURIComponent(authorEmail || "")}" width="38" height="38" alt="${initialsOf(authorName)}" style="display:block;width:38px;height:38px;border-radius:50%;object-fit:cover;" />`
    : `<div style="width:38px;height:38px;border-radius:50%;background:hsl(${hueOf(authorName)} 60% 58%);color:#f8f3ea;font-weight:700;font-size:14px;text-align:center;line-height:38px;">${initialsOf(authorName)}</div>`;

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#efe8dc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe8dc;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#f8f3ea;border:1px solid rgba(20,22,24,0.08);border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="background:#141618;padding:16px 28px;">
<span style="color:#f8f3ea;font-weight:700;letter-spacing:0.28em;font-size:13px;">TEKTONE</span>
<span style="color:#C7B79C;font-size:12px;"> &middot; Opera&ccedil;&otilde;es</span>
</td></tr>
<tr><td style="padding:28px;">
<div style="display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;color:${tag.color};background:${tag.bg};padding:5px 11px;border-radius:6px;margin-bottom:18px;">${tag.label}</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr>
<td style="vertical-align:middle;">${avatarCell}</td>
<td style="vertical-align:middle;padding-left:12px;"><div style="font-size:14px;font-weight:700;color:#141618;">${escHtml(authorName)}</div><div style="font-size:12px;color:#8A8579;">${caption}</div></td>
</tr></table>
<div style="font-size:20px;font-weight:700;color:#141618;line-height:1.25;margin-bottom:10px;">${escHtml(cardTitle)}</div>
${pill}
<div style="margin-top:18px;padding:14px 16px;background:rgba(20,22,24,0.035);border-left:3px solid ${tag.color};border-radius:8px;font-size:15px;color:#3a3a3a;line-height:1.55;">${body}</div>
<div style="margin-top:26px;"><a href="${cardUrl}" style="display:inline-block;background:#2E4A43;color:#f8f3ea;font-weight:700;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:10px;">Abrir no quadro &rarr;</a></div>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid rgba(20,22,24,0.07);">
<div style="font-size:11px;color:#8A8579;line-height:1.5;">Voc&ecirc; recebeu este e-mail porque foi marcado em uma tarefa no TEKTONE.</div>
<a href="https://tasks.tektone.com.br" style="font-size:11px;color:#2E4A43;text-decoration:none;font-weight:600;">tasks.tektone.com.br</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

// Mutates `card` in place: moves it to Done and appends a system "reviewed"
// comment mentioning its assignees (so the existing bell/email pipeline picks
// it up). Returns the comment + the assignee emails it mentioned.
function markReviewed(card, members, reviewerEmail, reviewerName) {
  card.reviewed = true;
  card.reviewedAt = new Date().toISOString();
  card.reviewedBy = reviewerName;
  card.columnId = "done";
  card.comments = card.comments || [];

  const assigneeNames = card.assignees?.length
    ? card.assignees
    : card.assignee
      ? [card.assignee]
      : [];
  const norm = (s) => String(s || "").trim().toLowerCase();
  const mentioned = [
    ...new Set(
      assigneeNames
        .map((n) => members.find((m) => norm(m.name) === norm(n))?.email)
        .filter(Boolean)
        .map((e) => e.toLowerCase())
        .filter((e) => e !== norm(reviewerEmail))
    ),
  ];

  const comment = {
    id: uid(),
    text: "revisou e concluiu esta tarefa",
    kind: "reviewed",
    author: reviewerEmail,
    authorName: reviewerName,
    mentions: mentioned,
    createdAt: card.reviewedAt,
    resolvedAt: null,
    resolvedBy: null,
  };
  card.comments.push(comment);
  return { comment, mentioned };
}

// Best-effort email + realtime broadcast for a just-reviewed card (mirrors the
// mention-email flow above). Never throws — a missed notification/broadcast
// shouldn't fail the review action itself.
async function notifyReview(context, env, kv, card, mentioned, members, authUsers, reviewerEmail, reviewerName) {
  const clients = await kvGet(kv, "kanban:clients", []);
  const client = clients.find((c) => c.id === card.clientId);
  const cardUrl = `https://tasks.tektone.com.br/?card=${card.id}`;

  if (mentioned.length) {
    await pushNotifs(
      kv,
      mentioned.map((to) => ({
        type: "reviewed",
        to,
        fromName: reviewerName,
        fromEmail: reviewerEmail,
        cardId: card.id,
        cardTitle: card.title,
        clientId: card.clientId,
        text: "revisou e concluiu esta tarefa",
      }))
    );
    dispatchPush(context, env, kv, mentioned, {
      title: `${reviewerName} concluiu — ${card.title}`,
      body: "revisou e concluiu esta tarefa",
      cardId: card.id,
    });
    const recipients = filterOptedIn(mentioned, authUsers);
    if (recipients.length) {
      const authorHasAvatar = Boolean(
        authUsers.find((u) => String(u.email).toLowerCase() === reviewerEmail.toLowerCase())?.avatar
      );
      const firstNames = new Set(members.map((m) => String(m.name).split(/\s+/)[0].toLowerCase()));
      const html = notificationEmail({
        authorName: reviewerName,
        authorEmail: reviewerEmail,
        authorHasAvatar,
        kind: "reviewed",
        text: "revisou e concluiu esta tarefa",
        cardTitle: card.title,
        projectName: client?.name,
        projectColor: client?.color,
        cardUrl,
        firstNames,
      });
      context.waitUntil(
        sendEmail(env, {
          to: recipients,
          subject: `${reviewerName} concluiu — ${card.title}`,
          text: `${reviewerName} revisou e concluiu "${card.title}".\n\nAbrir: ${cardUrl}`,
          html,
          replyTo: reviewerEmail,
        }).catch(() => {})
      );
    }
  }

  if (env.BOARD_ROOM) {
    context.waitUntil(
      env.BOARD_ROOM
        .getByName("main")
        .broadcast({ type: "card:reviewed", cardId: card.id, cardTitle: card.title, reviewerName })
        .catch(() => {})
    );
  }
}

// ── Seed data (TEKTONE) ───────────────────────────────────────────────────
const DEFAULT_CLIENTS = [
  { id: "tektone", name: "TEKTONE", color: "#00E5FF" },
  { id: "parceiro-a", name: "Parceiro A", color: "#C2FF00" },
  { id: "parceiro-b", name: "Parceiro B", color: "#8B5CF6" },
];

const DEFAULT_MEMBERS = [
  { id: "pedro", name: "Pedro Silvestrini", email: "pedrosilvestrini@tektone.com.br", role: "CEO" },
  { id: "hudson", name: "Hudson Argollo", email: "hudson@tektone.com.br", role: "CTO" },
  { id: "alison", name: "Alison Aparecido", email: "alison@tektone.com.br", role: "CMO" },
];

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const kv = env.KANBAN;
  if (!kv) return json({ error: "KV namespace KANBAN not bound" }, 500);

  // params.path is the catch-all array, e.g. ["cards"] or ["cards", "abc123"]
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [resource, id] = seg;

  try {
    // ── CLIENTS ──────────────────────────────────────────────────────────
    if (resource === "clients") {
      if (!id) {
        if (method === "GET") {
          let clients = await kvGet(kv, "kanban:clients", null);
          if (clients === null) {
            clients = DEFAULT_CLIENTS;
            await kvSet(kv, "kanban:clients", clients);
          }
          return json({ clients });
        }
        if (method === "POST") {
          const body = await request.json();
          const clients = await kvGet(kv, "kanban:clients", DEFAULT_CLIENTS);
          const client = { id: uid(), name: body.name, color: body.color ?? "#00E5FF" };
          clients.push(client);
          await kvSet(kv, "kanban:clients", clients);
          return json({ client }, 201);
        }
      } else {
        const clients = await kvGet(kv, "kanban:clients", DEFAULT_CLIENTS);
        if (method === "PUT") {
          const body = await request.json();
          const updated = clients.map((c) => (c.id === id ? { ...c, ...body, id } : c));
          await kvSet(kv, "kanban:clients", updated);
          return json({ client: updated.find((c) => c.id === id) });
        }
        if (method === "DELETE") {
          await kvSet(kv, "kanban:clients", clients.filter((c) => c.id !== id));
          const cards = await kvGet(kv, "kanban:cards", []);
          await kvSet(kv, "kanban:cards", cards.filter((c) => c.clientId !== id));
          return json({ ok: true });
        }
      }
    }

    // ── CARDS ────────────────────────────────────────────────────────────
    if (resource === "cards") {
      // /cards/:id/comments[/:commentId[/resolve]] — managed independently so
      // card edits never clobber the thread.
      if (id && seg[2] === "comments") {
        const email = await getSessionEmail(request, env);
        if (!email) return json({ error: "unauthorized" }, 401);
        const commentId = seg[3];
        const cards = await kvGet(kv, "kanban:cards", []);
        const card = cards.find((c) => c.id === id);
        if (!card) return json({ error: "Card not found" }, 404);
        card.comments = card.comments || [];
        const members = await kvGet(kv, "kanban:members", []);
        const authorName =
          members.find((m) => String(m.email).toLowerCase() === email.toLowerCase())?.name || email;
        const save = () => kvSet(kv, "kanban:cards", cards);

        if (!commentId && method === "POST") {
          const body = await request.json().catch(() => ({}));
          const text = String(body.text || "").trim();
          if (!text) return json({ error: "Comentário vazio." }, 400);
          // include the author too, so you can @mention yourself (e.g. to test)
          const mentioned = parseMentions(text, members)
            .map((m) => String(m.email || "").toLowerCase())
            .filter(Boolean);
          const comment = {
            id: uid(),
            text,
            kind: body.kind === "request" ? "request" : "comment",
            author: email,
            authorName,
            mentions: [...new Set(mentioned)],
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            resolvedBy: null,
          };
          card.comments.push(comment);
          await save();
          // email mentioned teammates (best-effort, off-thread)
          if (comment.mentions.length) {
            const clients = await kvGet(kv, "kanban:clients", []);
            const client = clients.find((c) => c.id === card.clientId);
            const authUsers = await kvGet(kv, "auth:users", []);
            const authorHasAvatar = Boolean(
              authUsers.find((u) => String(u.email).toLowerCase() === email.toLowerCase())?.avatar
            );
            const verbSubj = comment.kind === "request" ? "fez uma solicitação" : "mencionou você";
            const cardUrl = `https://tasks.tektone.com.br/?card=${card.id}`;
            const firstNames = new Set(
              members.map((m) => String(m.name).split(/\s+/)[0].toLowerCase())
            );
            const html = notificationEmail({
              authorName,
              authorEmail: email,
              authorHasAvatar,
              kind: comment.kind,
              text,
              cardTitle: card.title,
              projectName: client?.name,
              projectColor: client?.color,
              cardUrl,
              firstNames,
            });
            const recipients = filterOptedIn(comment.mentions, authUsers);
            if (recipients.length) {
              context.waitUntil(
                sendEmail(env, {
                  to: recipients,
                  subject: `${authorName} ${verbSubj} — ${card.title}`,
                  text: `${authorName} ${verbSubj} em "${card.title}":\n\n${text}\n\nAbrir: ${cardUrl}`,
                  html,
                  replyTo: email,
                }).catch(() => {})
              );
            }
          }
          if (comment.mentions.length) {
            await pushNotifs(
              kv,
              comment.mentions.map((to) => ({
                type: comment.kind === "request" ? "request" : "mention",
                to,
                fromName: authorName,
                fromEmail: email,
                cardId: card.id,
                cardTitle: card.title,
                clientId: card.clientId,
                commentId: comment.id,
                text: text.slice(0, 100),
              }))
            );
            dispatchPush(context, env, kv, comment.mentions, {
              title: `${authorName} ${comment.kind === "request" ? "fez uma solicitação" : "mencionou você"} — ${card.title}`,
              body: text.slice(0, 140),
              cardId: card.id,
            });
          }
          if (comment.mentions.length && env.BOARD_ROOM) {
            context.waitUntil(
              env.BOARD_ROOM
                .getByName("main")
                .broadcast({
                  type: "comment:mention",
                  recipients: comment.mentions,
                  cardId: card.id,
                  cardTitle: card.title,
                  commentId: comment.id,
                  authorName,
                  text: text.slice(0, 100),
                })
                .catch(() => {})
            );
          }
          return json({ card, comment }, 201);
        }
        if (commentId && seg[4] === "nudge" && method === "POST") {
          const c = card.comments.find((x) => x.id === commentId);
          if (!c) return json({ error: "Comment not found" }, 404);
          const body = await request.json().catch(() => ({}));
          const to = String(body.to || "").toLowerCase().trim();
          const norm = (s) => String(s || "").trim().toLowerCase();
          if (!to || to === email.toLowerCase()) return json({ error: "Destinatário inválido." }, 400);

          // Recipient must be card-relevant: an assignee or that comment's
          // author. Server-side allowlist — never trust the client picker.
          const assigneeNames = card.assignees?.length
            ? card.assignees
            : card.assignee
              ? [card.assignee]
              : [];
          const assigneeEmails = assigneeNames
            .map((n) => members.find((m) => norm(m.name) === norm(n))?.email)
            .filter(Boolean)
            .map((e) => e.toLowerCase());
          const validTargets = new Set([...assigneeEmails, String(c.author).toLowerCase()]);
          if (!validTargets.has(to))
            return json({ error: "Só é possível chamar quem participa deste card." }, 403);

          const notifLog = await kvGet(kv, "kanban:notifLog", []);
          const cooldownMs = 45_000;
          const recent = notifLog.find(
            (n) =>
              n.type === "nudge" &&
              n.fromEmail === email &&
              n.to === to &&
              Date.now() - new Date(n.createdAt).getTime() < cooldownMs
          );
          if (recent) return json({ error: "Aguarde um instante antes de chamar novamente." }, 429);

          const nudge = {
            id: uid(),
            type: "nudge",
            to,
            fromName: authorName,
            fromEmail: email,
            cardId: id,
            cardTitle: card.title,
            clientId: card.clientId,
            commentId,
            text: String(c.text || "").slice(0, 100),
            createdAt: new Date().toISOString(),
            readAt: null,
          };
          notifLog.push(nudge);
          const trimmedLog =
            notifLog.length > NOTIF_LOG_CAP ? notifLog.slice(notifLog.length - NOTIF_LOG_CAP) : notifLog;
          await kvSet(kv, "kanban:notifLog", trimmedLog);
          dispatchPush(context, env, kv, [to], {
            title: `${authorName} chamou você — ${card.title}`,
            body: nudge.text,
            cardId: id,
          });

          if (env.BOARD_ROOM) {
            context.waitUntil(
              env.BOARD_ROOM.getByName("main").broadcast({ type: "nudge", ...nudge }).catch(() => {})
            );
          }
          return json({ ok: true, nudge }, 201);
        }
        if (commentId && seg[4] === "resolve" && method === "POST") {
          const c = card.comments.find((x) => x.id === commentId);
          if (!c) return json({ error: "Comment not found" }, 404);
          if (c.resolvedAt) {
            c.resolvedAt = null;
            c.resolvedBy = null;
          } else {
            c.resolvedAt = new Date().toISOString();
            c.resolvedBy = authorName;
          }
          await save();
          return json({ card });
        }
        if (commentId && method === "DELETE") {
          const c = card.comments.find((x) => x.id === commentId);
          if (c && c.author !== email && !isAdmin(email))
            return json({ error: "Apenas o autor pode excluir." }, 403);
          card.comments = card.comments.filter((x) => x.id !== commentId);
          await save();
          return json({ card });
        }
        return json({ error: "Not found" }, 404);
      }

      // /cards/:id/review — mark reviewed, move to Done, notify + broadcast
      if (id && seg[2] === "review" && method === "POST") {
        const email = await getSessionEmail(request, env);
        if (!email) return json({ error: "unauthorized" }, 401);
        const cards = await kvGet(kv, "kanban:cards", []);
        const card = cards.find((c) => c.id === id);
        if (!card) return json({ error: "Card not found" }, 404);
        const members = await kvGet(kv, "kanban:members", []);
        const authUsers = await kvGet(kv, "auth:users", []);
        const reviewerName =
          members.find((m) => String(m.email).toLowerCase() === email.toLowerCase())?.name || email;
        const { mentioned } = markReviewed(card, members, email, reviewerName);
        await kvSet(kv, "kanban:cards", cards);
        await notifyReview(context, env, kv, card, mentioned, members, authUsers, email, reviewerName);
        return json({ card });
      }

      // /cards/:id/seen — mark this card's comments as read by the current user
      if (id && seg[2] === "seen" && method === "POST") {
        const email = await getSessionEmail(request, env);
        if (!email) return json({ error: "unauthorized" }, 401);
        const reads = await kvGet(kv, "kanban:reads", {});
        reads[email] = reads[email] || {};
        reads[email][id] = new Date().toISOString();
        await kvSet(kv, "kanban:reads", reads);

        // Read receipts: mark every comment I didn't author as seen by me.
        const cards = await kvGet(kv, "kanban:cards", []);
        const card = cards.find((c) => c.id === id);
        if (card) {
          let changed = false;
          for (const c of card.comments || []) {
            if (c.author === email) continue;
            c.seenBy = c.seenBy || [];
            if (!c.seenBy.some((s) => s.email === email)) {
              c.seenBy.push({ email, seenAt: reads[email][id] });
              changed = true;
            }
          }
          if (changed) await kvSet(kv, "kanban:cards", cards);
        }
        return json({ ok: true });
      }

      if (!id) {
        if (method === "GET") return json({ cards: await kvGet(kv, "kanban:cards", []) });
        if (method === "POST") {
          const body = await request.json();
          const cards = await kvGet(kv, "kanban:cards", []);
          let order = body.order;
          if (order === undefined) {
            const inColumn = cards.filter((c) => c.columnId === body.columnId);
            order = inColumn.length ? Math.max(...inColumn.map((c) => c.order ?? 0)) + 1 : 0;
          }
          const card = { id: uid(), createdAt: new Date().toISOString(), ...body, order };
          cards.push(card);
          await kvSet(kv, "kanban:cards", cards);
          return json({ card }, 201);
        }
      } else if (id === "reorder" && method === "POST") {
        const email = await getSessionEmail(request, env);
        if (!email) return json({ error: "unauthorized" }, 401);
        const body = await request.json().catch(() => ({}));
        const columnId = body.columnId;
        const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
        if (!columnId || !orderedIds.length) return json({ error: "columnId e orderedIds são obrigatórios." }, 400);
        const cards = await kvGet(kv, "kanban:cards", []);
        const indexById = new Map(orderedIds.map((cardId, i) => [cardId, i]));
        for (const c of cards) {
          if (c.columnId === columnId && indexById.has(c.id)) c.order = indexById.get(c.id);
        }
        await kvSet(kv, "kanban:cards", cards);
        return json({ ok: true });
      } else if (id === "review-bulk" && method === "POST") {
        const email = await getSessionEmail(request, env);
        if (!email) return json({ error: "unauthorized" }, 401);
        const body = await request.json().catch(() => ({}));
        const ids = new Set(Array.isArray(body.ids) ? body.ids : []);
        if (!ids.size) return json({ error: "Nenhum card selecionado." }, 400);
        const cards = await kvGet(kv, "kanban:cards", []);
        const members = await kvGet(kv, "kanban:members", []);
        const authUsers = await kvGet(kv, "auth:users", []);
        const reviewerName =
          members.find((m) => String(m.email).toLowerCase() === email.toLowerCase())?.name || email;
        const reviewed = [];
        for (const card of cards) {
          if (!ids.has(card.id)) continue;
          const { mentioned } = markReviewed(card, members, email, reviewerName);
          reviewed.push({ card, mentioned });
        }
        await kvSet(kv, "kanban:cards", cards);
        for (const r of reviewed) {
          await notifyReview(context, env, kv, r.card, r.mentioned, members, authUsers, email, reviewerName);
        }
        return json({ cards: reviewed.map((r) => r.card) });
      } else {
        const cards = await kvGet(kv, "kanban:cards", []);
        if (method === "PUT") {
          const body = await request.json();
          const card = cards.find((c) => c.id === id);
          if (!card) return json({ error: "Card not found" }, 404);

          const email = await getSessionEmail(request, env);
          const members = await kvGet(kv, "kanban:members", []);
          const norm = (s) => String(s || "").trim().toLowerCase();
          const actorName =
            members.find((m) => norm(m.email) === norm(email))?.name || email || "Alguém";

          // Dragging a previously-reviewed card back out of Done (e.g. into
          // Em Revisão) reopens it — clear the reviewed flags and log it in
          // the comment thread, mirroring the request resolve/reopen pattern.
          let reopenComment = null;
          if (card.reviewed && "columnId" in body && body.columnId !== "done" && body.columnId !== card.columnId) {
            body.reviewed = false;
            body.reviewedAt = null;
            body.reviewedBy = null;
            reopenComment = {
              id: uid(),
              text: "reabriu esta tarefa",
              kind: "reviewed",
              reopened: true,
              author: email || "",
              authorName: actorName,
              mentions: [],
              createdAt: new Date().toISOString(),
              resolvedAt: null,
              resolvedBy: null,
            };
          }

          // Newly-added assignees get a realtime + bell notification (removed
          // ones and unchanged ones don't).
          const oldNames = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
          const newNames = body.assignees ?? oldNames;
          const addedNames = newNames.filter((n) => !oldNames.includes(n));
          const addedEmails = [
            ...new Set(
              addedNames
                .map((n) => members.find((m) => norm(m.name) === norm(n))?.email)
                .filter(Boolean)
                .map((e) => e.toLowerCase())
                .filter((e) => e !== norm(email))
            ),
          ];

          // Reopening notifies the card's current assignees (excluding whoever
          // just reopened it) — same audience `markReviewed` mentions on completion.
          const reopenedEmails = reopenComment
            ? [
                ...new Set(
                  oldNames
                    .map((n) => members.find((m) => norm(m.name) === norm(n))?.email)
                    .filter(Boolean)
                    .map((e) => e.toLowerCase())
                    .filter((e) => e !== norm(email))
                ),
              ]
            : [];

          // never let a card edit overwrite the comment thread
          const updated = cards.map((c) => {
            if (c.id !== id) return c;
            const merged = { ...c, ...body, id, comments: c.comments };
            if (reopenComment) merged.comments = [...(c.comments || []), reopenComment];
            return merged;
          });
          await kvSet(kv, "kanban:cards", updated);
          const updatedCard = updated.find((c) => c.id === id);

          if (addedEmails.length) {
            await pushNotifs(
              kv,
              addedEmails.map((to) => ({
                type: "assigned",
                to,
                fromName: actorName,
                fromEmail: email,
                cardId: id,
                cardTitle: updatedCard.title,
                clientId: updatedCard.clientId,
              }))
            );
            dispatchPush(context, env, kv, addedEmails, {
              title: `${actorName} atribuiu você — ${updatedCard.title}`,
              body: "Você foi adicionado como responsável.",
              cardId: id,
            });
          }
          if (reopenedEmails.length) {
            await pushNotifs(
              kv,
              reopenedEmails.map((to) => ({
                type: "reopened",
                to,
                fromName: actorName,
                fromEmail: email,
                cardId: id,
                cardTitle: updatedCard.title,
                clientId: updatedCard.clientId,
                text: "reabriu esta tarefa",
              }))
            );
            dispatchPush(context, env, kv, reopenedEmails, {
              title: `${actorName} reabriu — ${updatedCard.title}`,
              body: "A tarefa voltou a ficar em aberto.",
              cardId: id,
            });
          }

          if (addedEmails.length && env.BOARD_ROOM) {
            context.waitUntil(
              env.BOARD_ROOM
                .getByName("main")
                .broadcast({
                  type: "card:assigned",
                  recipients: addedEmails,
                  cardId: id,
                  cardTitle: updatedCard.title,
                  byName: actorName,
                })
                .catch(() => {})
            );
          }
          if (reopenedEmails.length && env.BOARD_ROOM) {
            context.waitUntil(
              env.BOARD_ROOM
                .getByName("main")
                .broadcast({
                  type: "card:reopened",
                  recipients: reopenedEmails,
                  cardId: id,
                  cardTitle: updatedCard.title,
                  byName: actorName,
                })
                .catch(() => {})
            );
          }
          return json({ card: updatedCard });
        }
        if (method === "DELETE") {
          await kvSet(kv, "kanban:cards", cards.filter((c) => c.id !== id));
          return json({ ok: true });
        }
      }
    }

    // ── MEMBERS ──────────────────────────────────────────────────────────
    if (resource === "members") {
      if (!id) {
        if (method === "GET") {
          let members = await kvGet(kv, "kanban:members", null);
          if (members === null) {
            members = DEFAULT_MEMBERS;
            await kvSet(kv, "kanban:members", members);
          }
          return json({ members });
        }
        if (method === "POST") {
          const body = await request.json();
          const members = await kvGet(kv, "kanban:members", DEFAULT_MEMBERS);
          const member = { id: uid(), ...body };
          members.push(member);
          await kvSet(kv, "kanban:members", members);
          return json({ member }, 201);
        }
      } else {
        const members = await kvGet(kv, "kanban:members", DEFAULT_MEMBERS);
        if (method === "PUT") {
          const body = await request.json();
          const updated = members.map((m) => (m.id === id ? { ...m, ...body, id } : m));
          await kvSet(kv, "kanban:members", updated);
          return json({ member: updated.find((m) => m.id === id) });
        }
        if (method === "DELETE") {
          await kvSet(kv, "kanban:members", members.filter((m) => m.id !== id));
          return json({ ok: true });
        }
      }
    }

    // ── PERSONAL TODOS (private per-user daily checklist) ──────────────────
    // Own KV key per user (not a shared blob filtered client-side, unlike
    // notifLog below) — this list is never read by anyone but its owner.
    if (resource === "todos") {
      const email = await getSessionEmail(request, env);
      if (!email) return json({ error: "unauthorized" }, 401);
      const key = `kanban:todos:${email}`;

      if (!id) {
        if (method === "GET") {
          const items = await kvGet(kv, key, []);
          return json({ items });
        }
        if (method === "POST") {
          const body = await request.json();
          const text = String(body.text || "").trim();
          if (!text) return json({ error: "Texto obrigatório." }, 400);
          const items = await kvGet(kv, key, []);
          const item = { id: uid(), text, done: false, createdAt: new Date().toISOString() };
          items.push(item);
          await kvSet(kv, key, items);
          return json({ item }, 201);
        }
      } else {
        const items = await kvGet(kv, key, []);
        if (method === "PUT") {
          const body = await request.json();
          const updated = items.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...(body.text !== undefined ? { text: String(body.text) } : {}),
                  ...(body.done !== undefined ? { done: Boolean(body.done) } : {}),
                }
              : t
          );
          await kvSet(kv, key, updated);
          return json({ item: updated.find((t) => t.id === id) });
        }
        if (method === "DELETE") {
          await kvSet(kv, key, items.filter((t) => t.id !== id));
          return json({ ok: true });
        }
      }
    }

    // ── NOTIFICATIONS (persistent per-recipient log) ───────────────────────
    if (resource === "notifications" && method === "GET") {
      const email = await getSessionEmail(request, env);
      if (!email) return json({ error: "unauthorized" }, 401);
      const log = await kvGet(kv, "kanban:notifLog", []);
      const items = log
        .filter((n) => n.to === email)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const unreadCount = items.filter((n) => !n.readAt).length;
      return json({ items, unreadCount });
    }

    if (resource === "notifications" && id === "ack" && method === "POST") {
      const email = await getSessionEmail(request, env);
      if (!email) return json({ error: "unauthorized" }, 401);
      const body = await request.json().catch(() => ({}));
      const ids = Array.isArray(body.ids) ? new Set(body.ids) : null;
      const all = Boolean(body.all);
      const log = await kvGet(kv, "kanban:notifLog", []);
      let changed = false;
      const now = new Date().toISOString();
      for (const n of log) {
        if (n.to !== email) continue;
        if (!all && (!ids || !ids.has(n.id))) continue;
        if (!n.readAt) {
          n.readAt = now;
          changed = true;
        }
      }
      if (changed) await kvSet(kv, "kanban:notifLog", log);
      return json({ ok: true });
    }

    // ── REVIEWS (meeting-notes validation popup, per-user) ────────────────
    if (resource === "reviews") {
      const email = await getSessionEmail(request, env);
      if (!email) return json({ error: "unauthorized" }, 401);
      const reviews = await kvGet(kv, "ingest:reviews", []);

      if (!id && method === "GET") {
        const cutoff = Date.now() - REVIEW_TTL_MS;
        const pending = reviews
          .filter(
            (r) =>
              !(r.seenBy || []).includes(email) &&
              new Date(r.createdAt).getTime() > cutoff
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return json({ reviews: pending });
      }

      if (id === "ack" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const ids = Array.isArray(body.ids) ? new Set(body.ids) : null;
        let changed = false;
        for (const r of reviews) {
          if (ids && !ids.has(r.id)) continue;
          if (!(r.seenBy || []).includes(email)) {
            r.seenBy = [...(r.seenBy || []), email];
            changed = true;
          }
        }
        if (changed) await kvSet(kv, "ingest:reviews", reviews);
        return json({ ok: true });
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
