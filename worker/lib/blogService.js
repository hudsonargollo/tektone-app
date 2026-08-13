/**
 * /blog generation pipeline — scheduled + autonomous, human-curated. A
 * Cloudflare Cron Trigger (see wrangler.worker.toml [triggers]) calls
 * generateDraft() weekly per active pillar. Nothing goes live without an
 * ADMIN approving it (functions/api/blog/[[path]].js's review routes) —
 * same isolation principle as kb_documents/customer_questions in the
 * codigo-internacional reference: the AI never publishes directly.
 *
 * Illustration: a genuinely fresh image per article, generated via
 * Cloudflare Workers AI (FLUX.1 [schnell], @cf/black-forest-labs/flux-1-schnell)
 * at draft time — not a pre-generated pool. Zero external API dependency,
 * no credit-exhaustion risk (confirmed via a live test this session — see
 * commit history). Style is locked via a fixed prompt template so every
 * cover reads as the same house style regardless of article subject.
 */
import { fetchWithRetry } from "./retry.js";

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const ILLUSTRATION_STYLE =
  "Ancient Greek copper-engraving illustration, classical black-figure vase painting style fused with fine antique line engraving, single warm sepia-ink color, aged parchment background, elegant minimal linework, symmetrical balanced composition, no text, no modern elements, no color beyond sepia and parchment tones.";

const DRAFT_PERSONA = `Você é o redator-chefe do blog da Tektone — uma consultoria de tecnologia e negócios que constrói produtos, sistemas e ativos digitais sob medida para empresários que quiseram recuperar tempo, transformar uma ideia em realidade, ou destravar mais potencial dentro do próprio negócio.

Voz da marca (do guia oficial): "Tektone fala devagar. Nunca grita. Quando precisa cortar, corta com clareza." — direto, consultivo, nunca promocional, nunca genérico. Cada artigo precisa ensinar algo específico e acionável, nunca conteúdo raso de preenchimento.`;

async function callAnthropic(env, prompt) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    { tries: 2, baseMs: 500 }
  );
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json();
  const text = (Array.isArray(data?.content) ? data.content.find((b) => b?.type === "text") : null)?.text;
  if (!text) throw new Error("no text in Anthropic response");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in Anthropic response");
  return JSON.parse(text.slice(start, end + 1));
}

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function generateIllustration(env, subjectPrompt) {
  const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
    prompt: `${subjectPrompt} ${ILLUSTRATION_STYLE}`,
    steps: 8,
  });
  // flux-1-schnell returns { image: base64String }
  const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
  return bytes;
}

/**
 * On-demand inline image for the editor's "gerar imagem" control (see
 * functions/api/blog/[[path]].js's POST .../images route and
 * src/components/BlogPanel.jsx) — same generateIllustration() call the
 * auto-cover uses, just keyed under the post instead of the pillar and
 * with an editor-supplied prompt instead of the AI-drafted
 * illustration_subject. Doesn't touch blog_posts at all: the caller
 * inserts `![](media/<key>)` into the draft content itself and saves it
 * through the normal PATCH .../posts/:id route.
 */
export async function generateInlineImage(env, { postId, prompt }) {
  const imageBytes = await generateIllustration(env, prompt);
  const key = `posts/${postId}/${uid()}.png`;
  await env.BLOG_MEDIA.put(key, imageBytes, { httpMetadata: { contentType: "image/png" } });
  return { key };
}

/**
 * Drafts one article for the given pillar: title/excerpt/content via Claude,
 * cover illustration via Workers AI, uploaded to R2. Inserts a `pending_review`
 * blog_posts row — never published automatically.
 */
export async function generateDraft(env, pillar) {
  const prompt = `${DRAFT_PERSONA}

PILAR: ${pillar.name}
DIRETRIZ: ${pillar.prompt_seed}

Escreva um artigo completo para este pilar. Responda APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{
  "title": "título do artigo, direto e específico, sem clickbait",
  "excerpt": "1-2 frases de resumo, para preview em cards",
  "content": "corpo do artigo em markdown, 400-700 palavras, com subtítulos ## quando fizer sentido",
  "illustration_subject": "descrição em inglês de UMA cena/composição que representa visualmente o tema deste artigo, para gerar a ilustração de capa — seja específico sobre a ação/composição, não apenas o tema abstrato"
}`;

  const draft = await callAnthropic(env, prompt);

  let coverKey = null;
  try {
    const imageBytes = await generateIllustration(env, draft.illustration_subject);
    coverKey = `${pillar.slug}/${uid()}.png`;
    await env.BLOG_MEDIA.put(coverKey, imageBytes, { httpMetadata: { contentType: "image/png" } });
  } catch (err) {
    console.warn("[blog] illustration generation failed, publishing without cover", err.message);
  }

  const id = uid();
  let slug = slugify(draft.title);
  const existing = await env.DB.prepare("SELECT id FROM blog_posts WHERE slug = ?").bind(slug).first();
  if (existing) slug = `${slug}-${id.slice(0, 6)}`;

  await env.DB.prepare(
    `INSERT INTO blog_posts (id, slug, title, excerpt, content, pillar_id, cover_illustration, status, ai_generated, generation_prompt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review', 1, ?)`
  )
    .bind(id, slug, draft.title, draft.excerpt, draft.content, pillar.id, coverKey, prompt)
    .run();

  return { id, slug, title: draft.title, coverKey };
}

/** Runs generateDraft() for every active pillar — called from the cron handler. */
export async function generateWeeklyDrafts(env) {
  const { results: pillars } = await env.DB.prepare("SELECT * FROM blog_pillars WHERE active = 1").all();
  const results = [];
  for (const pillar of pillars) {
    try {
      results.push(await generateDraft(env, pillar));
    } catch (err) {
      console.error(`[blog] draft generation failed for pillar ${pillar.slug}`, err.message);
      results.push({ pillar: pillar.slug, error: err.message });
    }
  }
  return results;
}
