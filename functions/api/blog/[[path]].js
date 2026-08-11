// /blog backend — AI-drafted, admin-curated. Same route-shape convention as
// the rest of functions/api/*: public reads need no auth, everything under
// admin/ requires ADMIN (Hudson's "super admin" framing maps onto the
// existing single ADMIN tier — no new role added for this one feature).
//
//   GET  /api/blog/pillars                    — public, active pillars
//   GET  /api/blog/posts                       — public, published only (?pillar=slug)
//   GET  /api/blog/posts/:slug                 — public, published only
//   GET  /api/blog/media/:key+                 — public, streams from R2
//   GET  /api/blog/admin/posts?status=         — admin, review queue
//   PATCH /api/blog/admin/posts/:id            — admin, edit before publish
//   POST /api/blog/admin/posts/:id/approve     — admin, publish
//   POST /api/blog/admin/posts/:id/reject      — admin, { reviewerNotes }
//   POST /api/blog/admin/generate               — admin, manual draft trigger (all pillars)
//   GET/POST/PATCH /api/blog/admin/pillars      — admin, pillar management
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";
import { generateDraft, generateWeeklyDrafts } from "../../../worker/lib/blogService.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function requireAdmin(request, env) {
  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(env.DB, email) : null;
  return user && isAdmin(user) ? user : null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    // ── public: pillars ──────────────────────────────────────────────────
    if (seg[0] === "pillars" && !seg[1] && method === "GET") {
      const { results } = await db.prepare("SELECT * FROM blog_pillars WHERE active = 1 ORDER BY name").all();
      return json({ pillars: results });
    }

    // ── public: media (streams from R2) ─────────────────────────────────
    if (seg[0] === "media" && seg.length > 1 && method === "GET") {
      if (!env.BLOG_MEDIA) return json({ error: "R2 (BLOG_MEDIA) não vinculado." }, 500);
      const key = seg.slice(1).join("/");
      const obj = await env.BLOG_MEDIA.get(key);
      if (!obj) return json({ error: "not found" }, 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // ── admin ────────────────────────────────────────────────────────────
    if (seg[0] === "admin") {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: "forbidden" }, 403);

      if (seg[1] === "posts" && !seg[2] && method === "GET") {
        const status = new URL(request.url).searchParams.get("status");
        const where = status ? "WHERE p.status = ?" : "";
        const { results } = await db
          .prepare(
            `SELECT p.*, pl.name as pillar_name, pl.slug as pillar_slug FROM blog_posts p
             JOIN blog_pillars pl ON pl.id = p.pillar_id ${where} ORDER BY p.created_at DESC`
          )
          .bind(...(status ? [status] : []))
          .all();
        return json({ posts: results });
      }

      if (seg[1] === "posts" && seg[2] && !seg[3] && method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const fields = {};
        for (const f of ["title", "excerpt", "content"]) if (f in body) fields[f] = body[f];
        if (!Object.keys(fields).length) return json({ error: "nada para atualizar" }, 400);
        const cols = Object.keys(fields);
        await db
          .prepare(`UPDATE blog_posts SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
          .bind(...cols.map((c) => fields[c]), seg[2])
          .run();
        const post = await db.prepare("SELECT * FROM blog_posts WHERE id = ?").bind(seg[2]).first();
        return json({ post });
      }

      if (seg[1] === "posts" && seg[2] && seg[3] === "approve" && method === "POST") {
        await db
          .prepare(
            `UPDATE blog_posts SET status = 'published', published_at = datetime('now'), reviewed_by_email = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
          )
          .bind(user.email, seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "posts" && seg[2] && seg[3] === "reject" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        await db
          .prepare(
            `UPDATE blog_posts SET status = 'rejected', reviewer_notes = ?, reviewed_by_email = ?, reviewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
          )
          .bind(body.reviewerNotes || null, user.email, seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "generate" && method === "POST") {
        const results = await generateWeeklyDrafts(env);
        return json({ results }, 201);
      }

      if (seg[1] === "pillars" && !seg[2] && method === "GET") {
        const { results } = await db.prepare("SELECT * FROM blog_pillars ORDER BY name").all();
        return json({ pillars: results });
      }

      if (seg[1] === "pillars" && !seg[2] && method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!body.name || !body.promptSeed) return json({ error: "name e promptSeed obrigatórios" }, 400);
        const id = uid();
        const slug = String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        await db
          .prepare(`INSERT INTO blog_pillars (id, name, slug, description, prompt_seed) VALUES (?, ?, ?, ?, ?)`)
          .bind(id, body.name, slug, body.description || null, body.promptSeed)
          .run();
        const pillar = await db.prepare("SELECT * FROM blog_pillars WHERE id = ?").bind(id).first();
        return json({ pillar }, 201);
      }

      if (seg[1] === "pillars" && seg[2] && method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const fields = {};
        if ("active" in body) fields.active = body.active ? 1 : 0;
        for (const f of ["description"]) if (f in body) fields[f] = body[f];
        if ("promptSeed" in body) fields.prompt_seed = body.promptSeed;
        if (!Object.keys(fields).length) return json({ error: "nada para atualizar" }, 400);
        const cols = Object.keys(fields);
        await db
          .prepare(`UPDATE blog_pillars SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
          .bind(...cols.map((c) => fields[c]), seg[2])
          .run();
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    }

    // ── public: posts ────────────────────────────────────────────────────
    if (seg[0] === "posts" && !seg[1] && method === "GET") {
      const pillarSlug = new URL(request.url).searchParams.get("pillar");
      const where = ["p.status = 'published'"];
      const bind = [];
      if (pillarSlug) {
        where.push("pl.slug = ?");
        bind.push(pillarSlug);
      }
      const { results } = await db
        .prepare(
          `SELECT p.id, p.slug, p.title, p.excerpt, p.cover_illustration, p.published_at, pl.name as pillar_name, pl.slug as pillar_slug
             FROM blog_posts p JOIN blog_pillars pl ON pl.id = p.pillar_id
            WHERE ${where.join(" AND ")} ORDER BY p.published_at DESC`
        )
        .bind(...bind)
        .all();
      return json({ posts: results });
    }

    if (seg[0] === "posts" && seg[1] && method === "GET") {
      const post = await db
        .prepare(
          `SELECT p.*, pl.name as pillar_name, pl.slug as pillar_slug FROM blog_posts p
           JOIN blog_pillars pl ON pl.id = p.pillar_id WHERE p.slug = ? AND p.status = 'published'`
        )
        .bind(seg[1])
        .first();
      if (!post) return json({ error: "not found" }, 404);
      return json({ post });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("blog error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
