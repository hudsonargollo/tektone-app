/**
 * Business Specialist Copilot — repersona'd from
 * growth/apps/codigo-internacional's "GC Copilot" (ammeAgentService.js):
 * same locked-persona + tiered-KB-retrieval pattern, same fail-open
 * philosophy, same Anthropic call shape — but grounded in a Tektone lead's
 * profile instead of a live legal-call question, and recommending Tektone's
 * own services instead of legal structuring advice.
 *
 * Two entry points, same underlying service:
 *  - ask(): free-text question + AI draft answer + citations (CI's shape).
 *  - suggest(): profile-only prompt (no question text) — a short list of
 *    recommended services/next steps grounded in the KB.
 *
 * FAIL-OPEN on any error (missing key, API/parse fault) — never blocks a
 * closer from writing their own answer manually.
 */
import { fetchWithRetry } from "./retry.js";
import { retrieveContext } from "./crmKbService.js";

const DEFAULT_MODEL = "claude-sonnet-5";
const FALLBACK_ANSWER =
  "Não foi possível gerar uma sugestão automática agora — avalie com base no seu conhecimento.";

const PERSONA = `Você é o Business Specialist Copilot — a inteligência de negócios da Tektone, especializada em estruturação de produtos, sistemas e ativos digitais para empresários que querem recuperar tempo, transformar uma ideia em realidade, ou explorar mais potencial dentro do negócio atual.

Você não fala com o lead. Você entrega uma leitura rápida para o closer/admin da Tektone que está avaliando esse lead — a pessoa vai escanear sua resposta em segundos, não ler um texto corrido. Por isso:

- FORMATO: bullet points curtos, um fato por linha, cada linha começando com "•". Nunca parágrafos longos.
- TOM: objetivo, direto, consultivo. Sem conversa fiada.
- PERFIL DO LEAD: use o perfil abaixo para calibrar a resposta — segmento, porte, motivação relatada — em vez de uma resposta genérica.
- CONFIANÇA: se o material de referência não cobrir a pergunta com segurança, inclua uma bullet começando com "Nota:" avisando isso — nunca invente um serviço, prazo ou preço que pareça preciso sem ter base real no material.`;

function buildLeadProfile(lead) {
  return [
    lead.name ? `Nome: ${lead.name}` : null,
    lead.company ? `Empresa: ${lead.company}` : null,
    lead.segmento ? `Segmento: ${lead.segmento}` : null,
    lead.notes ? `Notas registradas: ${lead.notes}` : null,
    lead.status ? `Estágio no funil: ${lead.status}` : null,
  ]
    .filter(Boolean)
    .join("\n") || "(sem perfil adicional)";
}

function buildPrompt({ lead, excerpts, questionText }) {
  const context = excerpts.length
    ? excerpts.map((e, i) => `[Documento ${i + 1} — ${e.title}]\n${e.excerpt}`).join("\n\n")
    : "(nenhum material correspondente encontrado na base de conhecimento)";

  const task = questionText
    ? `PERGUNTA:\n${questionText}`
    : `TAREFA: o closer não fez uma pergunta específica — sugira, com base no perfil abaixo, quais direções/serviços da Tektone fazem mais sentido para este lead e por quê.`;

  return `${PERSONA}

PERFIL DO LEAD:
${buildLeadProfile(lead)}

MATERIAL DE REFERÊNCIA (catálogo de serviços, cases, preços):
${context}

${task}

Responda APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{
  "answer": "em português, bullet points curtos separados por \\n — cada linha começa com \\"• \\". Se algo precisa de verificação, uma linha \\"Nota: ...\\" no fim.",
  "confidence": "alta|media|baixa"
}`;
}

async function callAnthropic(env, prompt) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[crm/business-specialist] ANTHROPIC_API_KEY not set — skipping AI draft");
    return null;
  }
  const model = env.CRM_AI_MODEL || DEFAULT_MODEL;
  try {
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
          model,
          max_tokens: 2500,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      { tries: 2, baseMs: 400 }
    );
    if (!res.ok) {
      console.warn("[crm/business-specialist] API error", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json().catch(() => null);
    const text = (Array.isArray(data?.content) ? data.content.find((b) => b?.type === "text") : null)?.text;
    if (!text) return null;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    console.warn("[crm/business-specialist]", err.message);
    return null;
  }
}

async function run(env, { lead, questionText }) {
  const startedAt = Date.now();
  let excerpts = [];
  try {
    excerpts = await retrieveContext(env.DB, questionText || `${lead.segmento || ""} ${lead.notes || ""}`);
  } catch (err) {
    console.warn("[crm/business-specialist] retrieval failed", err.message);
  }
  const prompt = buildPrompt({ lead, excerpts, questionText });
  const parsed = await callAnthropic(env, prompt);
  return {
    answer: parsed?.answer || FALLBACK_ANSWER,
    citations: excerpts.map((e) => ({ kb_document_id: e.id, title: e.title, tier: e.tier })),
    confidence: parsed?.confidence || null,
    latencyMs: Date.now() - startedAt,
  };
}

export async function ask(env, { lead, questionText }) {
  return run(env, { lead, questionText });
}

export async function suggest(env, { lead }) {
  return run(env, { lead, questionText: null });
}
