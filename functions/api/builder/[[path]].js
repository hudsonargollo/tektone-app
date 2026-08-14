// /builder backend — the block-based page/form/quiz/funnel builder behind
// the Blog panel's new tab set. Same route-shape convention as
// functions/api/blog/[[path]].js: public reads need no auth, everything
// under admin/ requires ADMIN. See docs/ARCHITECTURE.md and
// ~/.claude/plans/tektone-block-builder.md for the full design — a
// "Document" is {kind, slug, title, status, blocks: JSON[], meta: JSON}.
//
//   GET    /api/builder/documents/:kind/:slug        — public, published only
//   GET    /api/builder/admin/documents?kind=        — admin, list (all statuses)
//   GET    /api/builder/admin/documents/:id          — admin, one document
//   POST   /api/builder/admin/documents              — admin, { kind, title } → draft
//   PATCH  /api/builder/admin/documents/:id           — admin, { title, slug, blocks, meta }
//   POST   /api/builder/admin/documents/:id/publish   — admin
//   POST   /api/builder/admin/documents/:id/archive   — admin
//   DELETE /api/builder/admin/documents/:id           — admin
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const VALID_KINDS = ["page", "form", "quiz", "funnel"];

const slugify = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (á→a) instead of dropping the letter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid();

async function requireAdmin(request, env) {
  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(env.DB, email) : null;
  return user && isAdmin(user) ? user : null;
}

function parseDoc(row) {
  if (!row) return row;
  return {
    ...row,
    blocks: JSON.parse(row.blocks || "[]"),
    meta: row.meta ? JSON.parse(row.meta) : null,
  };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    // ── public: fetch a published document by kind + slug ─────────────────
    if (seg[0] === "documents" && seg[1] && seg[2] && method === "GET") {
      const [, kind, slug] = seg;
      const doc = await db
        .prepare("SELECT * FROM builder_documents WHERE kind = ? AND slug = ? AND status = 'published'")
        .bind(kind, slug)
        .first();
      if (!doc) return json({ error: "not found" }, 404);
      return json({ document: parseDoc(doc) });
    }

    // ── admin ────────────────────────────────────────────────────────────
    if (seg[0] === "admin") {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: "forbidden" }, 403);

      if (seg[1] === "documents" && !seg[2] && method === "GET") {
        const kind = new URL(request.url).searchParams.get("kind");
        const where = kind ? "WHERE kind = ?" : "";
        const { results } = await db
          .prepare(`SELECT * FROM builder_documents ${where} ORDER BY updated_at DESC`)
          .bind(...(kind ? [kind] : []))
          .all();
        return json({ documents: results.map(parseDoc) });
      }

      if (seg[1] === "documents" && !seg[2] && method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!VALID_KINDS.includes(body.kind)) return json({ error: "kind inválido" }, 400);
        if (!body.title) return json({ error: "title obrigatório" }, 400);
        const id = uid();
        const slug = slugify(body.slug || body.title);
        const existing = await db
          .prepare("SELECT 1 FROM builder_documents WHERE kind = ? AND slug = ?")
          .bind(body.kind, slug)
          .first();
        if (existing) return json({ error: "já existe um documento com esse slug" }, 409);
        await db
          .prepare(
            `INSERT INTO builder_documents (id, kind, slug, title, blocks, created_by) VALUES (?, ?, ?, ?, '[]', ?)`
          )
          .bind(id, body.kind, slug, body.title, user.email)
          .run();
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(id).first();
        return json({ document: parseDoc(doc) }, 201);
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "GET") {
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(seg[2]).first();
        if (!doc) return json({ error: "not found" }, 404);
        return json({ document: parseDoc(doc) });
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const fields = {};
        for (const f of ["title"]) if (f in body) fields[f] = body[f];
        if ("slug" in body) fields.slug = slugify(body.slug);
        if ("blocks" in body) fields.blocks = JSON.stringify(body.blocks);
        if ("meta" in body) fields.meta = body.meta ? JSON.stringify(body.meta) : null;
        if (!Object.keys(fields).length) return json({ error: "nada para atualizar" }, 400);
        if (fields.slug) {
          const clash = await db
            .prepare(
              "SELECT 1 FROM builder_documents WHERE slug = ? AND id != ? AND kind = (SELECT kind FROM builder_documents WHERE id = ?)"
            )
            .bind(fields.slug, seg[2], seg[2])
            .first();
          if (clash) return json({ error: "já existe um documento com esse slug" }, 409);
        }
        const cols = Object.keys(fields);
        await db
          .prepare(`UPDATE builder_documents SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
          .bind(...cols.map((c) => fields[c]), seg[2])
          .run();
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(seg[2]).first();
        return json({ document: parseDoc(doc) });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "publish" && method === "POST") {
        await db
          .prepare(
            `UPDATE builder_documents SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
          )
          .bind(seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "archive" && method === "POST") {
        await db
          .prepare(`UPDATE builder_documents SET status = 'archived', updated_at = datetime('now') WHERE id = ?`)
          .bind(seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "DELETE") {
        await db.prepare("DELETE FROM builder_documents WHERE id = ?").bind(seg[2]).run();
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("builder error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
