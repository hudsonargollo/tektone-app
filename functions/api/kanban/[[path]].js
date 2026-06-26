/**
 * TEKTONE Kanban API — Cloudflare Pages Function (KV-backed).
 * Ported from the growth worker. Bound to the KANBAN KV namespace.
 *
 * KV keys:
 *   kanban:clients  → [{ id, name, color }]
 *   kanban:cards    → [{ id, columnId, title, description, priority, clientId, assignee, dueDate, labelColor, createdAt }]
 *   kanban:members  → [{ id, name, email, role }]
 *
 * Routes (relative to /api/kanban):
 *   GET|POST          /clients          PUT|DELETE /clients/:id
 *   GET|POST          /cards            PUT|DELETE /cards/:id
 *   GET|POST          /members          PUT|DELETE /members/:id
 */

import { verifySession, getCookie } from "../../_lib/session.js";
import { isAdmin } from "../../_lib/allowlist.js";

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
        const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
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
          const comment = {
            id: uid(),
            text,
            kind: body.kind === "request" ? "request" : "comment",
            author: email,
            authorName,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            resolvedBy: null,
          };
          card.comments.push(comment);
          await save();
          return json({ card, comment }, 201);
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

      // /cards/:id/seen — mark this card's comments as read by the current user
      if (id && seg[2] === "seen" && method === "POST") {
        const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
        if (!email) return json({ error: "unauthorized" }, 401);
        const reads = await kvGet(kv, "kanban:reads", {});
        reads[email] = reads[email] || {};
        reads[email][id] = new Date().toISOString();
        await kvSet(kv, "kanban:reads", reads);
        return json({ ok: true });
      }

      if (!id) {
        if (method === "GET") return json({ cards: await kvGet(kv, "kanban:cards", []) });
        if (method === "POST") {
          const body = await request.json();
          const cards = await kvGet(kv, "kanban:cards", []);
          const card = { id: uid(), createdAt: new Date().toISOString(), ...body };
          cards.push(card);
          await kvSet(kv, "kanban:cards", cards);
          return json({ card }, 201);
        }
      } else {
        const cards = await kvGet(kv, "kanban:cards", []);
        if (method === "PUT") {
          const body = await request.json();
          // never let a card edit overwrite the comment thread
          const updated = cards.map((c) =>
            c.id === id ? { ...c, ...body, id, comments: c.comments } : c
          );
          await kvSet(kv, "kanban:cards", updated);
          return json({ card: updated.find((c) => c.id === id) });
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

    // ── NOTIFICATIONS (unread comments per user) ──────────────────────────
    if (resource === "notifications" && method === "GET") {
      const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
      if (!email) return json({ error: "unauthorized" }, 401);
      const cards = await kvGet(kv, "kanban:cards", []);
      const reads = await kvGet(kv, "kanban:reads", {});
      const members = await kvGet(kv, "kanban:members", []);
      const ur = reads[email] || {};
      const norm = (s) => String(s || "").trim().toLowerCase();
      const myName = norm(
        members.find((m) => norm(m.email) === norm(email))?.name || ""
      );

      const notifications = [];
      for (const card of cards) {
        const comments = card.comments || [];
        if (!comments.length) continue;
        const since = ur[card.id];
        const unread = comments.filter(
          (c) => c.author !== email && (!since || c.createdAt > since)
        );
        if (!unread.length) continue;
        const last = unread[unread.length - 1];
        const assignees = card.assignees?.length
          ? card.assignees
          : card.assignee
            ? [card.assignee]
            : [];
        const mine = Boolean(myName) && assignees.map(norm).includes(myName);
        notifications.push({
          cardId: card.id,
          cardTitle: card.title,
          clientId: card.clientId,
          count: unread.length,
          hasRequest: unread.some((c) => c.kind === "request"),
          mine,
          last: {
            authorName: last.authorName,
            kind: last.kind,
            text: String(last.text || "").slice(0, 100),
            createdAt: last.createdAt,
          },
        });
      }
      notifications.sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
      const total = notifications.reduce((n, x) => n + x.count, 0);
      return json({ notifications, total });
    }

    // ── REVIEWS (meeting-notes validation popup, per-user) ────────────────
    if (resource === "reviews") {
      const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
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
