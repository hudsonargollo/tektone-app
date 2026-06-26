/**
 * Meeting-notes ingestion — Cloudflare Pages Function (KV-backed).
 *
 * Receives the plain text of a Gemini meeting-notes Google Doc, parses the
 * "Próximas etapas" section into tasks, resolves the project (auto-creating it
 * when missing) and the assigned members, then creates kanban cards.
 *
 * Auth: Authorization: Bearer <INGEST_TOKEN>  (env secret; NOT a user session).
 *
 *   POST /api/ingest/meeting-notes
 *     body: { title?, date?, text, project? }
 *     → { ok, project, projectCreated, created: [...], skipped: [...], tasks }
 *
 * Dedup is twofold: a per-document content hash (ingest:docs) skips re-sent
 * docs, and per-task title+project matching skips tasks that already exist.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function kvGet(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
const kvSet = (kv, key, value) => kv.put(key, JSON.stringify(value));

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// constant-time-ish string compare for the bearer token
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CLIENT_COLORS = [
  "#2E4A43", "#9B3D2E", "#B8862F", "#4C6B7A",
  "#7A5A6E", "#5B7A4E", "#C7B79C", "#8A8579",
];

// ── parsing ──────────────────────────────────────────────────────────────────
// Pull the "Próximas etapas" block (until "Detalhes"/"Details" or end) and parse
// each "[Names] Title: Description" line.
function extractTasks(text) {
  const start = text.match(/pr[óo]ximas etapas/i);
  if (!start) return [];
  let rest = text.slice(start.index + start[0].length);
  const end = rest.match(/\n\s*(?:detalhes|details)\b/i);
  if (end) rest = rest.slice(0, end.index);

  const tasks = [];
  for (const line of rest.split(/\n/)) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*(.+?)\s*$/);
    if (!m) continue;
    const namesRaw = m[1];
    const body = m[2];
    let title = body;
    let description = "";
    const colon = body.indexOf(":");
    if (colon !== -1) {
      title = body.slice(0, colon).trim();
      description = body.slice(colon + 1).trim();
    }
    if (title) tasks.push({ namesRaw, title, description });
  }
  return tasks;
}

const splitNames = (raw) =>
  raw.split(/[,;/]|\se\s|\sand\s/i).map((s) => s.trim()).filter(Boolean);

const isGroupToken = (t) =>
  /^(the group|o grupo|grupo|todos|toda a equipe|a equipe|equipe|all|everyone)$/i.test(
    String(t).trim()
  );

// Map a free-text name to an existing member's exact name (or null).
function matchMember(token, members) {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  let m = members.find((x) => String(x.name).toLowerCase() === t);
  if (m) return m.name;
  const first = t.split(/\s+/)[0];
  m = members.find((x) => {
    const n = String(x.name).toLowerCase();
    return n.startsWith(t) || n.split(/\s+/)[0] === first;
  });
  return m ? m.name : null;
}

// Decide which project the notes belong to.
function resolveProjectName(text, hint, clients) {
  if (hint && String(hint).trim()) return String(hint).trim();
  for (const c of clients) {
    if (c.name && c.name.length >= 3 && new RegExp(escapeRe(c.name), "i").test(text)) {
      return c.name;
    }
  }
  let m = text.match(/projeto\s+["“'']([^"”'']{2,60})["”'']/i);
  if (m) return m[1].trim();
  m = text.match(/projeto\s+([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+){0,3})/);
  if (m) return m[1].trim();
  return "Reuniões";
}

function buildDescription(desc, assignees, meta) {
  const parts = [];
  if (desc) parts.push(desc);
  if (assignees.length > 1) parts.push(`👥 ${assignees.join(", ")}`);
  const origin = meta.title
    ? `— ${meta.title}${meta.date ? ` · ${meta.date}` : ""}`
    : meta.date
      ? `— ${meta.date}`
      : "";
  if (origin) parts.push(origin);
  return parts.join("\n\n");
}

// ── handler ──────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (seg[0] !== "meeting-notes") return json({ error: "Not found" }, 404);
  if (method !== "POST") return json({ error: "Method not allowed" }, 405);

  // auth
  if (!env.INGEST_TOKEN) return json({ error: "INGEST_TOKEN not configured" }, 500);
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(token, env.INGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const kv = env.KANBAN;
  if (!kv) return json({ error: "KV namespace KANBAN not bound" }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const text = String(body.text || "");
  if (!text.trim()) return json({ error: "Missing 'text'" }, 400);

  const meta = { title: body.title ? String(body.title) : "", date: body.date ? String(body.date) : "" };

  // doc-level dedup
  const docHash = await sha256hex(text);
  const docs = await kvGet(kv, "ingest:docs", []);
  if (docs.includes(docHash)) {
    return json({ ok: true, alreadyProcessed: true, created: [], skipped: [] });
  }

  const tasks = extractTasks(text);
  if (tasks.length === 0) {
    docs.push(docHash);
    await kvSet(kv, "ingest:docs", docs.slice(-1000));
    return json({ ok: true, created: [], skipped: [], note: "No 'Próximas etapas' tasks found." });
  }

  const clients = await kvGet(kv, "kanban:clients", []);
  const members = await kvGet(kv, "kanban:members", []);
  const cards = await kvGet(kv, "kanban:cards", []);

  // resolve / auto-create project
  const projectName = resolveProjectName(text, body.project, clients);
  let client = clients.find((c) => String(c.name).toLowerCase() === projectName.toLowerCase());
  let projectCreated = false;
  if (!client) {
    client = { id: uid(), name: projectName, color: CLIENT_COLORS[clients.length % CLIENT_COLORS.length] };
    clients.push(client);
    projectCreated = true;
  }

  const existingTitles = new Set(
    cards.filter((c) => c.clientId === client.id).map((c) => String(c.title || "").toLowerCase())
  );

  const created = [];
  const skipped = [];
  const detail = [];
  for (const t of tasks) {
    if (existingTitles.has(t.title.toLowerCase())) {
      skipped.push(t.title);
      continue;
    }
    const tokens = splitNames(t.namesRaw);
    const assignees = [];
    if (!tokens.some(isGroupToken)) {
      for (const tok of tokens) {
        const name = matchMember(tok, members);
        if (name && !assignees.includes(name)) assignees.push(name);
      }
    }
    const card = {
      id: uid(),
      columnId: "todo",
      title: t.title,
      description: buildDescription(t.description, assignees, meta),
      priority: "medium",
      clientId: client.id,
      assignee: assignees[0] || "",
      assignees,
      dueDate: "",
      labelColor: null,
      source: "meeting-notes",
      createdAt: new Date().toISOString(),
    };
    cards.push(card);
    existingTitles.add(t.title.toLowerCase());
    created.push(t.title);
    detail.push({ title: t.title, assignees });
  }

  if (projectCreated) await kvSet(kv, "kanban:clients", clients);
  if (created.length) await kvSet(kv, "kanban:cards", cards);
  docs.push(docHash);
  await kvSet(kv, "ingest:docs", docs.slice(-1000));

  return json({
    ok: true,
    project: client.name,
    projectCreated,
    created,
    skipped,
    tasks: detail,
  });
}
