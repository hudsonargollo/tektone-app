/**
 * AI Instagram Post Generator (Tektone Hub AI Instagram Post Generator PRD,
 * 2026-08-12) — generates a brand-aligned image via Cloudflare Workers AI,
 * stores it in R2, and logs the exact prompt used. See
 * functions/api/social/[[path]].js for the HTTP layer and
 * migrations/0014_hub_brand_kb_and_social_posts.sql for brand_kb, the
 * structured source the master prompt pulls from.
 *
 * Model: @cf/stabilityai/stable-diffusion-xl-base-1.0, per the PRD.
 * Empirically verified this session (not assumed): unlike
 * @cf/black-forest-labs/flux-1-schnell (blogService.js, which returns
 * { image: base64String }), SDXL on Workers AI returns a raw
 * ReadableStream of PNG bytes — must be read via `new
 * Response(result).arrayBuffer()`, not base64-decoded.
 */
import { fetchWithRetry } from "./retry.js";
import { compositePost } from "./socialCompositor.js";

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const OBJECTIVE_LABELS = {
  autoridade: "Autoridade",
  conversao: "Conversão",
  bastidores: "Bastidores",
};

// Rows from brand_kb whose category/title map to a given objective — used
// to ground the master prompt in the right positioning angle instead of a
// generic "make it look nice" instruction.
const OBJECTIVE_POSITIONING_TITLE = {
  autoridade: "Autoridade",
  conversao: "Conversão",
  bastidores: "Bastidores",
};

async function loadBrandKb(db) {
  const { results } = await db.prepare("SELECT category, title, content, structured_value FROM brand_kb ORDER BY category, sort_order").all();
  return results;
}

/**
 * Builds the master prompt per the PRD's "Prompt Engineering" step:
 * concatenates the guided-form inputs with brand tokens pulled from
 * brand_kb (palette hex codes, the no-glow constraint, the voice line,
 * and a positioning snippet matched to the chosen objective) so the
 * output is constrained by the brand system, not just the raw subject.
 */
export function buildMasterPrompt({ objective, subject, visualTone, brandKb }) {
  const palette = brandKb.filter((r) => r.category === "palette" && r.structured_value);
  const paletteDesc = palette
    .map((r) => {
      try {
        const v = JSON.parse(r.structured_value);
        return v.hex ? `${r.title} (${v.hex})` : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .join(", ");

  const voiceLine = brandKb.find((r) => r.category === "voice" && r.id === "bkb-voi-1")?.content;
  const noGlow = brandKb.find((r) => r.category === "constraint")?.content;
  const positioningTitle = OBJECTIVE_POSITIONING_TITLE[objective];
  const positioning = brandKb.find((r) => r.category === "positioning" && r.title === positioningTitle)?.content;

  const objectiveLabel = OBJECTIVE_LABELS[objective] || objective;

  return [
    `Premium editorial photograph for an Instagram post. Objective: ${objectiveLabel}.`,
    `Subject/context: ${subject}.`,
    `Visual tone: ${visualTone}.`,
    paletteDesc ? `Strict color palette — use only these tones: ${paletteDesc}.` : null,
    "Sophisticated, architectural, minimal composition. Premium but not pretentious, confident but not loud.",
    noGlow ? "No glow, no neon drop-shadow, no light halos, no bloom effects." : null,
    "No text, no watermark, no logo baked into the image — overlays are applied separately.",
    voiceLine ? `Brand voice reference (tone only, not literal text): "${voiceLine}"` : null,
    positioning ? `Positioning angle: ${positioning}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateImage(env, prompt) {
  const result = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", { prompt });
  // SDXL returns a raw ReadableStream of PNG bytes (verified empirically —
  // see module docstring), NOT { image: base64 } like flux-1-schnell.
  const buf = await new Response(result).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Drafts the short overlay line rendered onto the image (canvas step in
 * SocialPostGenerator.jsx), grounded in brand_kb's voice + the positioning
 * angle matched to the chosen objective — so it stays concise and on the
 * actual Tektone sales proposition instead of a blank field the human has
 * to fill in from scratch every time. Best-effort: caption generation must
 * never block or fail image generation, so any error here just falls back
 * to null (the human can still type their own overlay text, same as before
 * this feature existed).
 */
async function generateCaption(env, { objective, subject, brandKb }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const voiceLine = brandKb.find((r) => r.category === "voice" && r.id === "bkb-voi-1")?.content;
    const positioningTitle = OBJECTIVE_POSITIONING_TITLE[objective];
    const positioning = brandKb.find((r) => r.category === "positioning" && r.title === positioningTitle)?.content;
    const objectiveLabel = OBJECTIVE_LABELS[objective] || objective;

    const prompt = `Você escreve legendas curtas de overlay para posts de Instagram da Tektone, uma consultoria de tecnologia e negócios sob medida (não é agência, não é software house, não é fábrica de apps).

Voz da marca: "${voiceLine || "Tektone fala devagar. Nunca grita. Quando precisa cortar, corta com clareza."}"
Objetivo deste post: ${objectiveLabel}.${positioning ? ` Proposta de negócio / posicionamento a reforçar: ${positioning}` : ""}
Assunto/contexto da imagem: ${subject}

Escreva UMA frase curta (no máximo 12 palavras) para sobrepor na imagem. Direta, confiante, específica ao contexto — nunca genérica, nunca promocional, sem hashtags, sem emojis, sem aspas. Responda apenas com a frase, nada mais.`;

    const res = await fetchWithRetry(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.BLOG_AI_MODEL || "claude-sonnet-5",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      { tries: 2, baseMs: 500 }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = (Array.isArray(data?.content) ? data.content.find((b) => b?.type === "text") : null)?.text;
    return text ? text.trim().replace(/^["'“]+|["'”]+$/g, "") : null;
  } catch (err) {
    console.warn("[social] caption generation failed, continuing without", err.message);
    return null;
  }
}

async function generateAndStoreSlide(env, { db, createdBy, objective, visualTone, brandKb, subject, aspectRatio, postFormat, groupId, slideIndex }) {
  const masterPrompt = buildMasterPrompt({ objective, subject, visualTone, brandKb });
  const [imageBytes, caption] = await Promise.all([
    generateImage(env, masterPrompt),
    generateCaption(env, { objective, subject, brandKb }),
  ]);

  const id = uid();
  // Raw SDXL output is kept separately from the served/composited image
  // (see socialCompositor.js's docstring — never composite onto an
  // already-composited image) so a later caption reroll/edit can always
  // recomposite from the pristine source instead of stacking overlays.
  const rawR2Key = `social/${id}-raw.png`;
  const r2Key = `social/${id}.png`;
  const [width, height] = aspectRatio.split("x").map(Number);
  const compositedBytes = await compositePost(imageBytes, { width, height, caption, watermarkOn: true });
  await Promise.all([
    env.BLOG_MEDIA.put(rawR2Key, imageBytes, { httpMetadata: { contentType: "image/png" } }),
    env.BLOG_MEDIA.put(r2Key, compositedBytes, { httpMetadata: { contentType: "image/png" } }),
  ]);

  await db
    .prepare(
      `INSERT INTO social_posts (id, created_by, objective, subject_context, visual_tone, master_prompt, r2_key, aspect_ratio, post_format, group_id, slide_index, caption, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    )
    .bind(id, createdBy, objective, subject, visualTone, masterPrompt, r2Key, aspectRatio, postFormat, groupId, slideIndex, caption)
    .run();

  return { id, r2Key, masterPrompt, aspectRatio, postFormat, groupId, slideIndex, caption };
}

// Recomposites `social/{id}.png` from the pristine `social/{id}-raw.png`
// with whatever caption is currently in the DB — shared by both the AI
// caption reroll and a human's manual caption edit, since both need the
// exact same "start from raw, never double-composite" recipe.
async function recompositeFromRaw(env, { id, aspectRatio, caption }) {
  const rawObj = await env.BLOG_MEDIA.get(`social/${id}-raw.png`);
  if (!rawObj) return; // best-effort — a missing raw shouldn't fail the caption save
  const rawBytes = new Uint8Array(await rawObj.arrayBuffer());
  const [width, height] = aspectRatio.split("x").map(Number);
  const compositedBytes = await compositePost(rawBytes, { width, height, caption, watermarkOn: true });
  await env.BLOG_MEDIA.put(`social/${id}.png`, compositedBytes, { httpMetadata: { contentType: "image/png" } });
}

/**
 * Rerolls just the overlay caption for one already-generated post — used
 * by the "sugerir outra" control in SocialPostGenerator.jsx when the
 * AI-drafted line doesn't land, without paying for a fresh SDXL image.
 * Recomposites the served image from the raw source with the new caption.
 */
export async function regenerateCaption(env, { id }) {
  const post = await env.DB.prepare("SELECT objective, subject_context, aspect_ratio FROM social_posts WHERE id = ?").bind(id).first();
  if (!post) return null;
  const brandKb = await loadBrandKb(env.DB);
  const caption = await generateCaption(env, { objective: post.objective, subject: post.subject_context, brandKb });
  await env.DB.prepare("UPDATE social_posts SET caption = ? WHERE id = ?").bind(caption, id).run();
  await recompositeFromRaw(env, { id, aspectRatio: post.aspect_ratio, caption });
  return caption;
}

/**
 * Saves a human-edited caption (the reviewer typing over the AI draft) and
 * recomposites from raw — previously web only ever baked a hand-typed
 * caption into the canvas locally, never persisting it server-side, so a
 * page reload or a later reroll silently lost the edit. This closes that
 * gap as a side effect of moving compositing server-side.
 */
export async function updateCaption(env, { id, caption }) {
  const post = await env.DB.prepare("SELECT aspect_ratio FROM social_posts WHERE id = ?").bind(id).first();
  if (!post) return null;
  await env.DB.prepare("UPDATE social_posts SET caption = ? WHERE id = ?").bind(caption, id).run();
  await recompositeFromRaw(env, { id, aspectRatio: post.aspect_ratio, caption });
  return caption;
}

/**
 * Full generate flow: build the brand-constrained master prompt(s), call
 * Workers AI, upload to R2 (BLOG_MEDIA bucket, social/ prefix — see
 * functions/api/social/[[path]].js's rationale comment for why this
 * reuses the existing bucket instead of provisioning a new one), insert a
 * `social_posts` row per image with status='draft'.
 *
 * Three formats (migration 0015):
 * - 'feed'/'story': one image, one row. `subject` is a single string.
 *   Story forces aspect_ratio to 1080x1920 (IG stories are the only
 *   format that isn't feed-shaped) — enforced by the caller
 *   (functions/api/social/[[path]].js), not re-derived here.
 * - 'carousel': N images (2-8 — capped to keep the request's total
 *   Workers AI latency bounded; IG technically allows up to 10, but each
 *   slide is a separate ~10-20s SDXL call), one row per slide, sharing a
 *   `groupId` and ordered by `slideIndex`. `subjects` is an array of
 *   per-slide subject/context strings so each card can tell a distinct
 *   beat of the carousel instead of repeating one image. Slides generate
 *   in parallel (Promise.all) rather than sequentially — otherwise an
 *   8-slide carousel would serialize to ~8x a single post's latency and
 *   risk the request timing out.
 */
export async function generateSocialPost(env, { createdBy, objective, visualTone, aspectRatio, postFormat, subject, subjects }) {
  const brandKb = await loadBrandKb(env.DB);

  if (postFormat === "carousel") {
    const groupId = uid();
    const slides = await Promise.all(
      subjects.map((slideSubject, slideIndex) =>
        generateAndStoreSlide(env, {
          db: env.DB,
          createdBy,
          objective,
          visualTone,
          brandKb,
          subject: slideSubject,
          aspectRatio,
          postFormat,
          groupId,
          slideIndex,
        })
      )
    );
    return { groupId, slides };
  }

  const post = await generateAndStoreSlide(env, {
    db: env.DB,
    createdBy,
    objective,
    visualTone,
    brandKb,
    subject,
    aspectRatio,
    postFormat,
    groupId: null,
    slideIndex: null,
  });
  return { groupId: null, slides: [post] };
}
