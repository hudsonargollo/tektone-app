// AI Instagram Post Generator (Tektone Hub AI Instagram Post Generator
// PRD, 2026-08-12) — internal content tool, STAFF/ADMIN only via the
// existing session-cookie auth (the PRD's "Secret API Key" framing
// assumed a standalone public worker; this lives inside the
// already-authenticated hub, so it uses the same session gate every
// other hub route uses instead of adding a second auth mechanism).
//
//   POST   /api/social/generate         — build master prompt(s), generate via Workers AI, store
//   GET    /api/social                  — gallery list, most recent first
//   GET    /api/social/:id/image        — stream the R2 object (mirrors /api/blog/media/:key+)
//   POST   /api/social/:id/caption      — reroll just the AI overlay caption for one post
//   PATCH  /api/social/:id              — mark exported (called after canvas export succeeds)
//   PATCH  /api/social/group/:groupId   — mark every slide in a carousel exported at once
//   DELETE /api/social/:id              — remove a gallery entry + its R2 object
//   DELETE /api/social/group/:groupId   — remove every slide in a carousel + their R2 objects
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isStaffOrAdmin } from "../../_lib/rbac.js";
import { generateSocialPost, regenerateCaption } from "../../../worker/lib/socialPostService.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const OBJECTIVES = new Set(["autoridade", "conversao", "bastidores"]);
// Feed and carousel slides share the same two crop ratios; a story is
// always 1080x1920 and isn't user-selectable (see the "generate" handler).
const FEED_ASPECT_RATIOS = new Set(["1080x1080", "1080x1350"]);
const STORY_ASPECT_RATIO = "1080x1920";
const POST_FORMATS = new Set(["feed", "carousel", "story"]);
const MIN_CAROUSEL_SLIDES = 2;
const MAX_CAROUSEL_SLIDES = 8; // see socialPostService.js's generateSocialPost docstring

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!isStaffOrAdmin(user)) return json({ error: "forbidden" }, 403);

  try {
    // ── image serving (streams from R2, mirrors /api/blog/media/:key+) ──
    if (seg[0] && seg[1] === "image" && !seg[2] && method === "GET") {
      const post = await db.prepare("SELECT r2_key FROM social_posts WHERE id = ?").bind(seg[0]).first();
      if (!post) return json({ error: "not found" }, 404);
      if (!env.BLOG_MEDIA) return json({ error: "R2 (BLOG_MEDIA) não vinculado." }, 500);
      const obj = await env.BLOG_MEDIA.get(post.r2_key);
      if (!obj) return json({ error: "not found" }, 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // ── generate ──────────────────────────────────────────────────────
    if (seg[0] === "generate" && !seg[1] && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const objective = String(body.objective || "");
      const visualTone = String(body.visualTone || "").trim();
      const postFormat = POST_FORMATS.has(body.postFormat) ? body.postFormat : "feed";

      if (!OBJECTIVES.has(objective)) return json({ error: "objective inválido" }, 400);
      if (!visualTone) return json({ error: "visualTone é obrigatório" }, 400);
      if (!env.AI) return json({ error: "Workers AI (env.AI) não vinculado." }, 500);
      if (!env.BLOG_MEDIA) return json({ error: "R2 (BLOG_MEDIA) não vinculado." }, 500);

      let aspectRatio;
      let subject, subjects;

      if (postFormat === "carousel") {
        aspectRatio = FEED_ASPECT_RATIOS.has(body.aspectRatio) ? body.aspectRatio : "1080x1080";
        subjects = Array.isArray(body.subjects) ? body.subjects.map((s) => String(s || "").trim()) : [];
        if (subjects.length < MIN_CAROUSEL_SLIDES || subjects.length > MAX_CAROUSEL_SLIDES) {
          return json({ error: `carrossel precisa de ${MIN_CAROUSEL_SLIDES} a ${MAX_CAROUSEL_SLIDES} slides` }, 400);
        }
        if (subjects.some((s) => !s)) return json({ error: "todo slide precisa de um assunto/contexto" }, 400);
      } else {
        aspectRatio = postFormat === "story" ? STORY_ASPECT_RATIO : (FEED_ASPECT_RATIOS.has(body.aspectRatio) ? body.aspectRatio : "1080x1080");
        subject = String(body.subject || "").trim();
        if (!subject) return json({ error: "subject é obrigatório" }, 400);
      }

      const result = await generateSocialPost(env, {
        createdBy: user.email,
        objective,
        visualTone,
        postFormat,
        aspectRatio,
        subject,
        subjects,
      });
      return json(result, 201);
    }

    // ── reroll overlay caption for one post ─────────────────────────────
    if (seg[0] && seg[1] === "caption" && !seg[2] && method === "POST") {
      const existing = await db.prepare("SELECT id FROM social_posts WHERE id = ?").bind(seg[0]).first();
      if (!existing) return json({ error: "not found" }, 404);
      if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada." }, 500);
      const caption = await regenerateCaption(env, { id: seg[0] });
      return json({ caption });
    }

    // ── mark whole carousel exported ────────────────────────────────────
    if (seg[0] === "group" && seg[1] && !seg[2] && method === "PATCH") {
      await db.prepare("UPDATE social_posts SET status = 'exported' WHERE group_id = ?").bind(seg[1]).run();
      return json({ ok: true });
    }

    // ── delete whole carousel ────────────────────────────────────────────
    if (seg[0] === "group" && seg[1] && !seg[2] && method === "DELETE") {
      const { results: slides } = await db.prepare("SELECT r2_key FROM social_posts WHERE group_id = ?").bind(seg[1]).all();
      if (env.BLOG_MEDIA) await Promise.all(slides.map((s) => env.BLOG_MEDIA.delete(s.r2_key).catch(() => {})));
      await db.prepare("DELETE FROM social_posts WHERE group_id = ?").bind(seg[1]).run();
      return json({ ok: true });
    }

    // ── gallery list ──────────────────────────────────────────────────
    if (!seg[0] && method === "GET") {
      const { results } = await db
        .prepare("SELECT * FROM social_posts ORDER BY created_at DESC LIMIT 100")
        .all();
      return json({ posts: results });
    }

    // ── mark exported ─────────────────────────────────────────────────
    if (seg[0] && !seg[1] && method === "PATCH") {
      const existing = await db.prepare("SELECT id FROM social_posts WHERE id = ?").bind(seg[0]).first();
      if (!existing) return json({ error: "not found" }, 404);
      await db.prepare("UPDATE social_posts SET status = 'exported' WHERE id = ?").bind(seg[0]).run();
      return json({ ok: true });
    }

    // ── delete ────────────────────────────────────────────────────────
    if (seg[0] && !seg[1] && method === "DELETE") {
      const existing = await db.prepare("SELECT r2_key FROM social_posts WHERE id = ?").bind(seg[0]).first();
      if (!existing) return json({ error: "not found" }, 404);
      if (env.BLOG_MEDIA) await env.BLOG_MEDIA.delete(existing.r2_key).catch(() => {});
      await db.prepare("DELETE FROM social_posts WHERE id = ?").bind(seg[0]).run();
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("social error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
