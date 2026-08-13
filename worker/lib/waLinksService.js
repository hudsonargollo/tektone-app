/**
 * Link shortener — go.tektone.com.br/<slug> -> either a WhatsApp chat
 * (wa.me/<phone> with a prefilled message) or an arbitrary destination URL.
 * Click-tracked. Managed from the CRM by closers and admins. Ported from
 * Código Internacional's own waLinksService.js (see migration
 * 0018_hub_wa_links.sql), same table shape and validation rules.
 */
const TYPES = ["whatsapp", "url"];

function normaliseSlug(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

// Short hex slug — plenty of keyspace (16^6 ≈ 16.7M) for a small team's link volume.
function randomSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

async function uniqueSlug(db) {
  for (let i = 0; i < 5; i++) {
    const s = randomSlug();
    const exists = await db.prepare("SELECT slug FROM wa_links WHERE slug = ?").bind(s).first();
    if (!exists) return s;
  }
  throw new Error("Não foi possível gerar um identificador único — tente novamente.");
}

// Resolves the effective type and validates its required field is present.
function validateDestination({ type, phone, url }) {
  const t = TYPES.includes(type) ? type : "whatsapp";
  if (t === "whatsapp") {
    if (!phone || !String(phone).trim()) throw new Error("Informe o número de WhatsApp.");
  } else {
    const u = String(url || "").trim();
    let parsed;
    try {
      parsed = new URL(u);
    } catch {
      parsed = null;
    }
    if (!parsed || !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Informe uma URL de destino válida (começando com https://).");
    }
  }
  return t;
}

export async function listWaLinks(db) {
  const { results } = await db.prepare("SELECT * FROM wa_links ORDER BY created_at DESC").all();
  return results;
}

export async function createWaLink(db, { slug, title, type, phone, message, url, actor }) {
  const t = validateDestination({ type, phone, url });
  let s = normaliseSlug(slug);
  if (s) {
    const exists = await db.prepare("SELECT slug FROM wa_links WHERE slug = ?").bind(s).first();
    if (exists) throw new Error(`O link "${s}" já existe.`);
  } else {
    s = await uniqueSlug(db);
  }
  await db
    .prepare(
      `INSERT INTO wa_links (slug, title, type, phone, message, url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      s,
      title?.trim() || null,
      t,
      t === "whatsapp" ? String(phone).trim() : null,
      t === "whatsapp" ? message?.trim() || null : null,
      t === "url" ? String(url).trim() : null,
      actor || null
    )
    .run();
  return db.prepare("SELECT * FROM wa_links WHERE slug = ?").bind(s).first();
}

// Title/phone/message/url are always editable. Passing `newSlug` renames the
// link's public URL (rejects if the target slug is already taken by another
// link). Passing `type` switches the destination kind and clears the other
// kind's fields so stale data can't leak through.
export async function updateWaLink(db, currentSlug, { title, phone, message, url, type, newSlug }) {
  let slug = currentSlug;
  if (newSlug !== undefined) {
    const s = normaliseSlug(newSlug);
    if (!s) throw new Error("Informe um identificador válido.");
    if (s !== currentSlug) {
      const exists = await db.prepare("SELECT slug FROM wa_links WHERE slug = ?").bind(s).first();
      if (exists) throw new Error(`O link "${s}" já existe.`);
      await db.prepare("UPDATE wa_links SET slug = ? WHERE slug = ?").bind(s, currentSlug).run();
      slug = s;
    }
  }

  const current = await db.prepare("SELECT * FROM wa_links WHERE slug = ?").bind(slug).first();
  if (!current) throw new Error("Link não encontrado.");
  const switchingType = type !== undefined;
  const t = switchingType ? validateDestination({ type, phone, url }) : current.type;

  const fields = ["type = ?"];
  const vals = [t];
  if (title !== undefined) {
    fields.push("title = ?");
    vals.push(title?.trim() || null);
  }
  if (t === "whatsapp") {
    if (phone !== undefined) {
      fields.push("phone = ?");
      vals.push(String(phone).trim());
    }
    if (message !== undefined) {
      fields.push("message = ?");
      vals.push(message?.trim() || null);
    }
    if (switchingType) {
      fields.push("url = ?");
      vals.push(null);
    }
  } else {
    if (url !== undefined) {
      fields.push("url = ?");
      vals.push(String(url).trim());
    }
    if (switchingType) {
      fields.push("phone = ?");
      vals.push(null);
      fields.push("message = ?");
      vals.push(null);
    }
  }
  await db.prepare(`UPDATE wa_links SET ${fields.join(", ")} WHERE slug = ?`).bind(...vals, slug).run();
  return db.prepare("SELECT * FROM wa_links WHERE slug = ?").bind(slug).first();
}

export async function deleteWaLink(db, slug) {
  await db.prepare("DELETE FROM wa_links WHERE slug = ?").bind(slug).run();
  return { slug, deleted: true };
}

/**
 * Public resolve — called by the go.tektone.com.br redirector worker for
 * every visit. Counts the click server-side before returning the target, so
 * a click is recorded even if the redirector never gets a response back.
 */
export async function resolveWaLink(db, slug) {
  const link = await db.prepare("SELECT * FROM wa_links WHERE slug = ?").bind(slug).first();
  if (!link) return null;
  await db
    .prepare("UPDATE wa_links SET clicks = clicks + 1, last_clicked_at = datetime('now') WHERE slug = ?")
    .bind(slug)
    .run();
  return link;
}
