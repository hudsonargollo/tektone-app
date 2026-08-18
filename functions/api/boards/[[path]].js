// /boards backend — collaborative Notion+Miro-style docs/canvas (BlockSuite),
// gated behind users.plus_enabled (see rbac.hasPlusAccess). A board is private
// to its owner + explicit collaborators in board_users (see rbac.isBoardMember)
// — not flat role-gating like /finance or /comercial.
//
//   GET    /api/boards                          — list boards the session user is a member of
//   POST   /api/boards                          — create { title }, creator becomes owner
//   PUT    /api/boards/:id                      — rename { title }, member-gated
//   DELETE /api/boards/:id                      — owner/admin only
//   GET    /api/boards/:id/snapshot             — member-gated, raw Yjs bytes (404 if none yet)
//   PUT    /api/boards/:id/snapshot             — member-gated, raw Yjs bytes body
//   GET    /api/boards/:id/collaborators        — member-gated list
//   POST   /api/boards/:id/collaborators        — owner/admin only, { email, role }
//   DELETE /api/boards/:id/collaborators/:email — owner/admin only
//
// Realtime sync (GET /api/boards/:id/connect, proxying to the BOARDS_SYNC
// Durable Object) lands in Phase B — not implemented here yet.
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { hasPlusAccess, isAdmin, isBoardMember } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const snapshotKey = (id) => `boards/${id}.ydoc`;
const normEmail = (e) => (e || "").trim().toLowerCase();

async function isBoardOwner(db, user, boardId) {
  if (isAdmin(user)) return true;
  const row = await db
    .prepare("SELECT 1 FROM board_users WHERE board_id = ? AND user_email = ? AND role = 'owner'")
    .bind(boardId, user.email)
    .first();
  return Boolean(row);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);
  if (!env.BOARDS_DATA) return json({ error: "R2 (BOARDS_DATA) não vinculado." }, 500);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user || !hasPlusAccess(user)) return json({ error: "Acesso negado." }, 403);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    // ── list ─────────────────────────────────────────────────────────────
    if (seg.length === 0 && method === "GET") {
      const { results } = isAdmin(user)
        ? await db.prepare("SELECT * FROM boards ORDER BY updated_at DESC").all()
        : await db
            .prepare(
              `SELECT b.* FROM boards b
               JOIN board_users bu ON bu.board_id = b.id
               WHERE bu.user_email = ?
               ORDER BY b.updated_at DESC`
            )
            .bind(user.email)
            .all();
      return json({ boards: results });
    }

    // ── create ───────────────────────────────────────────────────────────
    if (seg.length === 0 && method === "POST") {
      const { title } = await request.json().catch(() => ({}));
      const id = uid();
      await db
        .prepare("INSERT INTO boards (id, title, owner_email) VALUES (?, ?, ?)")
        .bind(id, (title || "").trim() || "Sem título", user.email)
        .run();
      await db
        .prepare("INSERT INTO board_users (board_id, user_email, role) VALUES (?, ?, 'owner')")
        .bind(id, user.email)
        .run();
      const board = await db.prepare("SELECT * FROM boards WHERE id = ?").bind(id).first();
      return json({ board }, 201);
    }

    const boardId = seg[0];
    if (!boardId) return json({ error: "Not found" }, 404);

    // ── rename ───────────────────────────────────────────────────────────
    if (seg.length === 1 && method === "PUT") {
      if (!(await isBoardMember(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const { title } = await request.json().catch(() => ({}));
      if (!title || !title.trim()) return json({ error: "Título obrigatório." }, 400);
      await db
        .prepare("UPDATE boards SET title = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(title.trim(), boardId)
        .run();
      return json({ ok: true });
    }

    // ── delete ───────────────────────────────────────────────────────────
    if (seg.length === 1 && method === "DELETE") {
      if (!(await isBoardOwner(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      await db.prepare("DELETE FROM boards WHERE id = ?").bind(boardId).run();
      await db.prepare("DELETE FROM board_users WHERE board_id = ?").bind(boardId).run();
      await env.BOARDS_DATA.delete(snapshotKey(boardId)).catch(() => {});
      return json({ ok: true });
    }

    // ── snapshot: load ───────────────────────────────────────────────────
    if (seg[1] === "snapshot" && method === "GET") {
      if (!(await isBoardMember(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const obj = await env.BOARDS_DATA.get(snapshotKey(boardId));
      if (!obj) return json({ error: "Nenhum snapshot ainda." }, 404);
      return new Response(obj.body, { headers: { "Content-Type": "application/octet-stream" } });
    }

    // ── snapshot: save ───────────────────────────────────────────────────
    if (seg[1] === "snapshot" && method === "PUT") {
      if (!(await isBoardMember(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const bytes = await request.arrayBuffer();
      await env.BOARDS_DATA.put(snapshotKey(boardId), bytes);
      await db
        .prepare("UPDATE boards SET updated_at = datetime('now') WHERE id = ?")
        .bind(boardId)
        .run();
      return json({ ok: true });
    }

    // ── collaborators: list ──────────────────────────────────────────────
    if (seg[1] === "collaborators" && seg.length === 2 && method === "GET") {
      if (!(await isBoardMember(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const { results } = await db
        .prepare("SELECT user_email, role, added_at FROM board_users WHERE board_id = ? ORDER BY added_at")
        .bind(boardId)
        .all();
      return json({ collaborators: results });
    }

    // ── collaborators: add ───────────────────────────────────────────────
    if (seg[1] === "collaborators" && seg.length === 2 && method === "POST") {
      if (!(await isBoardOwner(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const { email: rawEmail, role } = await request.json().catch(() => ({}));
      const target = normEmail(rawEmail);
      if (!target) return json({ error: "E-mail obrigatório." }, 400);
      if (!(await getUserByEmail(db, target))) return json({ error: "Usuário não encontrado." }, 400);
      await db
        .prepare(
          "INSERT INTO board_users (board_id, user_email, role) VALUES (?, ?, ?) ON CONFLICT (board_id, user_email) DO UPDATE SET role = excluded.role"
        )
        .bind(boardId, target, role === "viewer" ? "viewer" : "editor")
        .run();
      return json({ ok: true }, 201);
    }

    // ── collaborators: remove ────────────────────────────────────────────
    if (seg[1] === "collaborators" && seg.length === 3 && method === "DELETE") {
      if (!(await isBoardOwner(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      const target = normEmail(seg[2]);
      await db
        .prepare("DELETE FROM board_users WHERE board_id = ? AND user_email = ? AND role != 'owner'")
        .bind(boardId, target)
        .run();
      return json({ ok: true });
    }

    // ── realtime sync (Phase B) ──────────────────────────────────────────
    // Proxies a WebSocket upgrade to the per-board BoardSyncRoom Durable
    // Object in the sibling tektone-boards-sync Worker — same pattern as
    // functions/api/realtime/[[path]].js's BOARD_ROOM proxy, but keyed
    // per-board via getByName(boardId) instead of a hardcoded "main" room.
    if (seg[1] === "connect" && method === "GET") {
      if (!(await isBoardMember(db, user, boardId))) return json({ error: "Acesso negado." }, 403);
      if (request.headers.get("Upgrade") !== "websocket") {
        return json({ error: "Expected websocket" }, 426);
      }
      if (!env.BOARDS_SYNC) return json({ error: "Sync não configurado." }, 503);
      const doUrl = new URL(request.url);
      doUrl.searchParams.set("boardId", boardId);
      const doRequest = new Request(doUrl, request);
      return env.BOARDS_SYNC.getByName(boardId).fetch(doRequest);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("boards error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
