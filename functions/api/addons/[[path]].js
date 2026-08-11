// Add-on catalog — Phase 5/6 of Hub Tektone (the marketplace's product
// list). GET is public to any authenticated user (CUSTOMER included — this
// is the storefront). Everything else (create/edit/deactivate) is ADMIN
// only, per PRD §5.2. ai_banner_url is a client-resized base64 JPEG data URL
// stored directly in D1 — same pattern this app already uses for user
// avatars (see functions/api/auth's MAX_AVATAR_LEN) — NOT an R2 URL: R2
// isn't enabled on this Cloudflare account yet (needs dashboard activation,
// outside what this code can do), so this reuses the proven fallback
// instead of blocking the whole feature on that. Swap to R2 later if/when
// it's enabled — the column stores a URL either way, callers don't care
// which. An admin generates the source image ahead of time (e.g. via
// Higgsfield) and uploads it here; this route never generates images.
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const MAX_BANNER_LEN = 900000; // ~640KB data URL — a resized 640x240 JPEG comfortably fits

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user) return json({ error: "unauthorized" }, 401);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const id = seg[0];
  const method = request.method;

  try {
    if (!id) {
      if (method === "GET") {
        // Non-admins only ever see the live storefront; an admin managing
        // the catalog needs inactive items too.
        const sql = isAdmin(user)
          ? "SELECT * FROM addons_catalog ORDER BY created_at DESC"
          : "SELECT * FROM addons_catalog WHERE is_active = 1 ORDER BY created_at DESC";
        const { results } = await db.prepare(sql).all();
        return json({ addons: results });
      }
      if (method === "POST") {
        if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
        const body = await request.json().catch(() => ({}));
        const title = String(body.title || "").trim();
        const price = Number(body.price);
        if (!title || !(price > 0)) return json({ error: "title e price obrigatórios" }, 400);
        if (body.aiBannerUrl && body.aiBannerUrl.length > MAX_BANNER_LEN)
          return json({ error: "Imagem muito grande. Use uma menor." }, 413);
        const newId = uid();
        await db
          .prepare(
            `INSERT INTO addons_catalog (id, title, description, price, special_price, ai_banner_url, category, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
          )
          .bind(newId, title, body.description || null, price, body.specialPrice || null, body.aiBannerUrl || null, body.category || null, email)
          .run();
        const addon = await db.prepare("SELECT * FROM addons_catalog WHERE id = ?").bind(newId).first();
        return json({ addon }, 201);
      }
    } else {
      if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
      if (method === "PUT") {
        const body = await request.json().catch(() => ({}));
        const fields = {};
        if (body.title !== undefined) fields.title = body.title;
        if (body.description !== undefined) fields.description = body.description;
        if (body.price !== undefined) fields.price = Number(body.price);
        if (body.specialPrice !== undefined) fields.special_price = body.specialPrice ? Number(body.specialPrice) : null;
        if (body.aiBannerUrl !== undefined) {
          if (body.aiBannerUrl && body.aiBannerUrl.length > MAX_BANNER_LEN)
            return json({ error: "Imagem muito grande. Use uma menor." }, 413);
          fields.ai_banner_url = body.aiBannerUrl;
        }
        if (body.category !== undefined) fields.category = body.category;
        if (body.isActive !== undefined) fields.is_active = body.isActive ? 1 : 0;
        const cols = Object.keys(fields);
        if (cols.length) {
          await db
            .prepare(`UPDATE addons_catalog SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
            .bind(...cols.map((c) => fields[c]), id)
            .run();
        }
        const addon = await db.prepare("SELECT * FROM addons_catalog WHERE id = ?").bind(id).first();
        return json({ addon });
      }
      if (method === "DELETE") {
        await db.prepare("DELETE FROM addons_catalog WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
