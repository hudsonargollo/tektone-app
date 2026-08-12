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

async function generateAndStoreSlide(env, { db, createdBy, objective, visualTone, brandKb, subject, aspectRatio, postFormat, groupId, slideIndex }) {
  const masterPrompt = buildMasterPrompt({ objective, subject, visualTone, brandKb });
  const imageBytes = await generateImage(env, masterPrompt);

  const id = uid();
  const r2Key = `social/${id}.png`;
  await env.BLOG_MEDIA.put(r2Key, imageBytes, { httpMetadata: { contentType: "image/png" } });

  await db
    .prepare(
      `INSERT INTO social_posts (id, created_by, objective, subject_context, visual_tone, master_prompt, r2_key, aspect_ratio, post_format, group_id, slide_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
    )
    .bind(id, createdBy, objective, subject, visualTone, masterPrompt, r2Key, aspectRatio, postFormat, groupId, slideIndex)
    .run();

  return { id, r2Key, masterPrompt, aspectRatio, postFormat, groupId, slideIndex };
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
