/**
 * Meeting Intelligence — Cloudflare Pages Function (KV + Gemini).
 *
 * Runs a "best of BrassTranscripts" executive-business analysis over a meeting
 * transcript and saves action items + a summary card to the relevant project.
 *
 * Interactive (session auth — the Inteligência page):
 *   POST /api/analyze/meeting  { transcript, title? }
 *       → { analysis: { project, summary, decisions[], risks[], actionItems[] } }
 *   POST /api/analyze/commit   { projectName, meetingTitle?, summary, decisions[],
 *                                risks[], actionItems[], saveSummaryCard }
 *       → { ok, project, projectCreated, created: [...] }
 *
 * Automatic (bearer INGEST_TOKEN — called by the Apps Script for every new doc):
 *   POST /api/analyze/auto     { transcript, title?, date? }
 *       → analyzes + saves + records a review batch, deduped. Headless.
 */

import { getSessionEmail } from "../../_lib/session.js";
import { isAllowed } from "../../_lib/allowlist.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function kvGet(kv, key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
const kvSet = (kv, key, value) => kv.put(key, JSON.stringify(value));

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const CLIENT_COLORS = [
  "#2E4A43", "#9B3D2E", "#B8862F", "#4C6B7A",
  "#7A5A6E", "#5B7A4E", "#C7B79C", "#8A8579",
];
const PRIORITIES = new Set(["high", "medium", "low"]);
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

function matchMember(token, members) {
  const t = String(token || "").trim().toLowerCase();
  if (!t) return null;
  let m = members.find((x) => String(x.name).toLowerCase() === t);
  if (m) return m.name;
  const first = t.split(/\s+/)[0];
  m = members.find((x) => String(x.name).toLowerCase().split(/\s+/)[0] === first);
  return m ? m.name : null;
}

// ── Gemini ───────────────────────────────────────────────────────────────────
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    project: { type: "string" },
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: { risk: { type: "string" }, mitigation: { type: "string" } },
        required: ["risk"],
      },
    },
    actionItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          assignees: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          dueDate: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["project", "summary", "actionItems"],
};

function buildPrompt(transcript, title, clients, members) {
  const projectList = clients.map((c) => `- ${c.name}`).join("\n") || "(nenhum)";
  const memberList = members.map((m) => `- ${m.name}`).join("\n") || "(nenhum)";
  return `Você analisa transcrições/anotações de reuniões da equipe TEKTONE e devolve JSON estruturado em português do Brasil.

PROJETOS EXISTENTES (associe a reunião a UM destes pelo nome quando fizer sentido; caso nenhum sirva, proponha um nome de projeto curto e claro):
${projectList}

MEMBROS DA EQUIPE (atribua responsáveis APENAS desta lista, usando o nome exato; deixe vazio quando a tarefa for do grupo ou não tiver dono claro):
${memberList}

Gere:
- project: o nome do projeto existente mais adequado, ou um novo nome curto se nenhum servir.
- summary: resumo executivo conciso (~150-200 palavras), em pt-BR.
- decisions: lista de decisões-chave tomadas (frases curtas).
- risks: lista de objetos {risk, mitigation} para riscos/bloqueios relevantes.
- actionItems: TODAS as tarefas e compromissos. Para cada um: title (curto, no imperativo), description (1-2 frases de contexto), assignees (nomes exatos da lista ou vazio), priority (high|medium|low), dueDate (YYYY-MM-DD se houver data dita ou claramente inferível, senão vazio).

Seja abrangente nos action items — capture até compromissos mencionados de passagem. Nunca invente responsáveis; use somente os nomes fornecidos.

Reunião: ${title || "(sem título)"}

Transcrição:
"""
${transcript.slice(0, 120000)}
"""`;
}

// Anthropic Messages API with forced tool use → guaranteed structured JSON.
// Shared by meeting analysis (single-turn) and the task-interview wizard
// (multi-turn, reconstructed fresh on every stateless request).
async function callClaudeTool(env, { system, messages, tool, maxTokens = 8000 }) {
  const model = env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === "tool_use");
  if (!block?.input) throw new Error("Anthropic: resposta sem tool_use.");
  return block.input;
}

// Run the model and normalise action items against known members.
async function analyze(env, transcript, title, clients, members) {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurado.");
  const analysis = await callClaudeTool(env, {
    messages: [{ role: "user", content: buildPrompt(transcript, title, clients, members) }],
    tool: {
      name: "emit_analysis",
      description: "Devolve a análise estruturada da reunião.",
      input_schema: ANALYSIS_SCHEMA,
    },
    maxTokens: 8000,
  });
  analysis.actionItems = (analysis.actionItems || [])
    .map((it) => {
      const assignees = [];
      for (const a of it.assignees || []) {
        const name = matchMember(a, members);
        if (name && !assignees.includes(name)) assignees.push(name);
      }
      return {
        title: String(it.title || "").trim(),
        description: String(it.description || "").trim(),
        assignees,
        priority: PRIORITIES.has(it.priority) ? it.priority : "medium",
        dueDate: isISODate(it.dueDate) ? it.dueDate : "",
      };
    })
    .filter((it) => it.title);
  return analysis;
}

// ── Task creation wizard — multi-turn AI interview ──────────────────────────
const INTERVIEW_SECTIONS = ["challenge", "method", "quest", "victory", "checklist", "other"];
const MAX_INTERVIEW_TURNS = 10; // ⇒ ≤ 21 messages (1 kickoff + 2×10)
const MAX_FIELD_CHARS = 4000;

const INTERVIEW_TOOL = {
  name: "interview_turn",
  description:
    "Emite a próxima pergunta da entrevista (done=false) ou o resultado final da tarefa " +
    "depois de reunir informação suficiente (done=true).",
  input_schema: {
    type: "object",
    properties: {
      done: {
        type: "boolean",
        description: "true quando já há informação suficiente para produzir a descrição final e o checklist.",
      },
      question: {
        type: "string",
        description: "A próxima pergunta a fazer, em português, uma de cada vez. Obrigatório quando done=false.",
      },
      section: {
        type: "string",
        enum: INTERVIEW_SECTIONS,
        description: "A qual seção esta pergunta se refere principalmente.",
      },
      description: {
        type: "string",
        description:
          "Texto final em quatro seções (O DESAFIO, O MÉTODO, A JORNADA, A VITÓRIA), sem markdown. Obrigatório quando done=true.",
      },
      checklist: {
        type: "array",
        items: { type: "string" },
        description: "Itens de checklist acionáveis extraídos da conversa. Obrigatório quando done=true.",
      },
    },
    required: ["done"],
  },
};

const INTERVIEW_SYSTEM_PROMPT = `Você conduz uma entrevista curta e focada, em português do Brasil, para ajudar um profissional da TEKTONE a documentar uma tarefa concluída ou em andamento. Seu objetivo final é produzir:

1. Uma descrição em texto simples (sem markdown, sem #, sem **, sem listas com "-") dividida em quatro seções, cada uma introduzida por um cabeçalho em maiúsculas:
   - O DESAFIO: qual bug ou nova funcionalidade está sendo resolvido/construído.
   - O MÉTODO: a abordagem, ferramentas ou processo usados — pode ser copywriting, edição de vídeo, software, uma campanha de marketing, o que for; é obrigatório nomear um método concreto.
   - A JORNADA: detalhes, novas ideias, descobertas, obstáculos técnicos encontrados pelo caminho.
   - A VITÓRIA: como o resultado nasceu e como ele fortalece o negócio.
2. Uma lista de itens de checklist acionáveis, curtos e no imperativo, extraídos da conversa.

Regras da entrevista:
- Faça UMA pergunta por vez, sempre em português. Nunca faça duas perguntas na mesma mensagem.
- Adapte a próxima pergunta com base na resposta anterior — não use um roteiro fixo.
- Cubra as quatro seções ao longo da conversa, mais itens de checklist concretos.
- Use entre 4 e 8 perguntas no total. Se já houver informação suficiente para as quatro seções e para um checklist útil, finalize antes disso.
- Se a resposta do usuário for vaga, faça uma pergunta de acompanhamento mais específica antes de avançar de seção.

Quando tiver informação suficiente — ou ao receber o marcador [FINALIZAR_AGORA] em uma resposta — pare de perguntar e responda com done=true, preenchendo description (as quatro seções concatenadas, com cabeçalho em maiúsculas e uma linha em branco entre seções) e checklist (itens específicos; se a conversa não sugerir itens claros, gere itens razoáveis a partir do que foi dito, não deixe vazio). Ao receber [FINALIZAR_AGORA], preencha lacunas restantes com suposições razoáveis, sem mencionar isso ao usuário.

Sempre responda usando a ferramenta interview_turn — nunca em texto livre.`;

// No server-side session for this stateless endpoint — the frontend resends
// the full running conversation every turn, and we synthesize our own
// tool_use/tool_result ids fresh each time. Anthropic only requires the
// resent array to be internally consistent, not that ids match a prior real
// response, so this is safe.
function buildInterviewMessages(seedTitle, turns, finalize) {
  const messages = [
    {
      role: "user",
      content: `Título da tarefa: ${String(seedTitle || "(sem título)").slice(0, 300)}\n\nVamos começar a entrevista.`,
    },
  ];
  turns.forEach((t, i) => {
    const section = INTERVIEW_SECTIONS.includes(t.section) ? t.section : "other";
    messages.push({
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: `turn_${i}`,
          name: "interview_turn",
          input: { done: false, question: t.question, section },
        },
      ],
    });
    let answer = t.answer;
    if (finalize && i === turns.length - 1) {
      answer +=
        "\n\n[FINALIZAR_AGORA] O usuário pediu para finalizar agora. Pare de perguntar — " +
        "responda imediatamente com done=true, usando o que já foi coletado e completando " +
        "lacunas com suposições razoáveis.";
    }
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: `turn_${i}`, content: answer }],
    });
  });
  return messages;
}

function summaryDescription(summary, decisions, risks) {
  const parts = [];
  if (summary) parts.push(String(summary).trim());
  if (decisions?.length) parts.push("Decisões:\n" + decisions.map((d) => `• ${d}`).join("\n"));
  if (risks?.length)
    parts.push(
      "Riscos:\n" +
        risks.map((r) => `• ${r.risk}${r.mitigation ? ` → ${r.mitigation}` : ""}`).join("\n")
    );
  return parts.join("\n\n");
}

// Create the summary card + action-item cards under a (found or created) project.
async function saveAnalysis(kv, payload) {
  const { projectName, meetingTitle, summary, decisions, risks, actionItems, saveSummaryCard } =
    payload;
  const clients = await kvGet(kv, "kanban:clients", []);
  const members = await kvGet(kv, "kanban:members", []);
  const cards = await kvGet(kv, "kanban:cards", []);

  let client = clients.find((c) => String(c.name).toLowerCase() === projectName.toLowerCase());
  let projectCreated = false;
  if (!client) {
    client = { id: uid(), name: projectName, color: CLIENT_COLORS[clients.length % CLIENT_COLORS.length] };
    clients.push(client);
    projectCreated = true;
  }

  const meta = meetingTitle ? String(meetingTitle) : "";
  const created = [];
  const detail = [];

  if (saveSummaryCard) {
    const desc = summaryDescription(summary, decisions, risks);
    if (desc) {
      const card = {
        id: uid(),
        columnId: "backlog",
        title: `📝 Resumo: ${meta || "reunião"}`,
        description: desc,
        priority: "low",
        clientId: client.id,
        assignee: "",
        assignees: [],
        dueDate: "",
        labelColor: "#7A5A6E",
        source: "meeting-analysis",
        isSummary: true,
        createdAt: new Date().toISOString(),
      };
      cards.push(card);
      created.push("📝 Resumo");
      detail.push({ id: card.id, title: card.title, assignees: [] });
    }
  }

  for (const it of actionItems || []) {
    const title = String(it.title || "").trim();
    if (!title) continue;
    const assignees = [];
    for (const a of it.assignees || []) {
      const name = matchMember(a, members);
      if (name && !assignees.includes(name)) assignees.push(name);
    }
    const extra = [];
    if (it.description) extra.push(it.description);
    if (assignees.length > 1) extra.push(`👥 ${assignees.join(", ")}`);
    if (meta) extra.push(`— ${meta}`);
    const card = {
      id: uid(),
      columnId: "todo",
      title,
      description: extra.join("\n\n"),
      priority: PRIORITIES.has(it.priority) ? it.priority : "medium",
      clientId: client.id,
      assignee: assignees[0] || "",
      assignees,
      dueDate: isISODate(it.dueDate) ? it.dueDate : "",
      labelColor: null,
      source: "meeting-analysis",
      createdAt: new Date().toISOString(),
    };
    cards.push(card);
    created.push(title);
    detail.push({ id: card.id, title, assignees });
  }

  if (projectCreated) await kvSet(kv, "kanban:clients", clients);
  if (created.length) await kvSet(kv, "kanban:cards", cards);

  return { client, projectCreated, created, detail };
}

// ── handler ──────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const kv = env.KANBAN;
  if (!kv) return json({ error: "KV namespace KANBAN not bound" }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const action = seg[0];

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const sessionAuth = async () => {
    const email = await getSessionEmail(request, env);
    return Boolean(email) && isAllowed(email);
  };

  try {
    // ── interactive: analyze only (session) ────────────────────────────────
    if (action === "meeting") {
      if (!(await sessionAuth())) return json({ error: "unauthorized" }, 401);
      const transcript = String(body.transcript || "").trim();
      if (transcript.length < 30) return json({ error: "Transcrição muito curta." }, 400);
      const clients = await kvGet(kv, "kanban:clients", []);
      const members = await kvGet(kv, "kanban:members", []);
      const analysis = await analyze(env, transcript, body.title, clients, members);
      return json({ analysis });
    }

    // ── interactive: commit reviewed analysis (session) ────────────────────
    if (action === "commit") {
      if (!(await sessionAuth())) return json({ error: "unauthorized" }, 401);
      const projectName = String(body.projectName || "").trim();
      if (!projectName) return json({ error: "Projeto obrigatório." }, 400);
      const r = await saveAnalysis(kv, {
        projectName,
        meetingTitle: body.meetingTitle,
        summary: body.summary,
        decisions: body.decisions,
        risks: body.risks,
        actionItems: body.actionItems,
        saveSummaryCard: body.saveSummaryCard !== false,
      });
      return json({ ok: true, project: r.client.name, projectCreated: r.projectCreated, created: r.created });
    }

    // ── automatic: analyze + save headlessly (bearer INGEST_TOKEN) ─────────
    if (action === "auto") {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!env.INGEST_TOKEN || !safeEqual(token, env.INGEST_TOKEN))
        return json({ error: "unauthorized" }, 401);
      const transcript = String(body.transcript || body.text || "").trim();
      if (transcript.length < 30) return json({ error: "Transcrição muito curta." }, 400);

      // doc-level dedup (shared with the simple ingest)
      const docHash = await sha256hex(transcript);
      const docs = await kvGet(kv, "ingest:docs", []);
      if (docs.includes(docHash)) return json({ ok: true, alreadyProcessed: true, created: [] });

      const clients = await kvGet(kv, "kanban:clients", []);
      const members = await kvGet(kv, "kanban:members", []);
      const analysis = await analyze(env, transcript, body.title, clients, members);

      const r = await saveAnalysis(kv, {
        projectName: String(analysis.project || "Reuniões").trim() || "Reuniões",
        meetingTitle: body.title,
        summary: analysis.summary,
        decisions: analysis.decisions,
        risks: analysis.risks,
        actionItems: analysis.actionItems,
        saveSummaryCard: true,
      });

      // review batch for the per-user validation popup
      if (r.created.length) {
        const reviews = await kvGet(kv, "ingest:reviews", []);
        reviews.push({
          id: uid(),
          createdAt: new Date().toISOString(),
          project: r.client.name,
          projectId: r.client.id,
          projectCreated: r.projectCreated,
          meetingTitle: body.title || "",
          date: body.date || "",
          tasks: r.detail,
          seenBy: [],
        });
        await kvSet(kv, "ingest:reviews", reviews.slice(-50));
      }

      docs.push(docHash);
      await kvSet(kv, "ingest:docs", docs.slice(-1000));

      return json({
        ok: true,
        project: r.client.name,
        projectCreated: r.projectCreated,
        created: r.created,
      });
    }

    // ── interactive: task-creation wizard interview (session) ──────────────
    if (action === "task-interview") {
      if (!(await sessionAuth())) return json({ error: "unauthorized" }, 401);
      if (!env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurado." }, 500);

      const seedTitle = String(body.seedTitle || "").slice(0, 300);
      const turnsIn = Array.isArray(body.turns) ? body.turns : [];
      if (turnsIn.length > MAX_INTERVIEW_TURNS) {
        return json({ error: "Conversa muito longa. Clique em 'Finalizar agora'." }, 400);
      }
      const turns = turnsIn.map((t) => ({
        question: String(t?.question || "").slice(0, MAX_FIELD_CHARS),
        section: String(t?.section || "other"),
        answer: String(t?.answer || "").slice(0, MAX_FIELD_CHARS),
      }));
      const finalize = Boolean(body.finalize);

      const result = await callClaudeTool(env, {
        system: INTERVIEW_SYSTEM_PROMPT,
        messages: buildInterviewMessages(seedTitle, turns, finalize),
        tool: INTERVIEW_TOOL,
        maxTokens: 4000,
      });

      if (result.done) {
        const description = String(result.description || "").trim();
        const checklist = Array.isArray(result.checklist)
          ? result.checklist.map((s) => String(s || "").trim()).filter(Boolean)
          : [];
        if (!description) return json({ error: "IA não retornou uma descrição válida." }, 502);
        return json({ done: true, description, checklist });
      }

      const question = String(result.question || "").trim();
      if (!question) return json({ error: "IA não retornou uma pergunta válida." }, 502);
      const section = INTERVIEW_SECTIONS.includes(result.section) ? result.section : "other";
      return json({ done: false, question, section });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message || "Server error" }, 500);
  }
}
