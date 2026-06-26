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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

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
          const updated = cards.map((c) => (c.id === id ? { ...c, ...body, id } : c));
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

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
