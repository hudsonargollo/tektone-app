// Builds the per-project onboarding plan when a lead is won. See
// ~/.claude/plans/tektone-adaptive-onboarding.md for the full design.
// Three sources, in priority order:
//   1. A brief present on the won lead -> generateAiPlan() asks Claude to
//      propose steps grounded in the lead's qualification data + the
//      closer's free-text brief (Phase 2 — the real "adapts to this
//      project" case). Lands as `pending_review` and is NOT mirrored into
//      `tasks` until a human approves it via approvePlan() below.
//   2. No brief (or AI generation failed open) + ONBOARDING_RULES[projectType]
//      matches -> its static step set, auto-approved (pre-vetted,
//      admin-authored-equivalent content, same trust level as a
//      workflow_template). Mirrored into `tasks` immediately.
//   3. Neither -> the "Onboarding padrão" workflow_template (already
//      applied to `tasks` by wonAutomation.js's existing applyWorkflowTemplate,
//      called BEFORE this) is mirrored into the same onboarding_plans/
//      onboarding_steps shape too, purely so the Portal has a checklist to
//      render for legacy/no-signal won-leads. Not re-inserted into `tasks`
//      — those rows already exist from the template application.
import { ONBOARDING_RULES } from "./onboardingRules.js";
import { fetchWithRetry } from "./retry.js";

const DEFAULT_MODEL = "claude-sonnet-5";
const CATEGORY_VALUES = ["kickoff", "access", "content", "technical", "design", "training", "launch"];

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function dueDateFromOffset(days) {
  return Number.isFinite(days) ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : null;
}

async function insertPlan(db, { projectId, leadId, projectType, brief, source, templateId, status, aiRawJson }) {
  const planId = uid();
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  await db
    .prepare(
      `INSERT INTO onboarding_plans (id, project_id, lead_id, project_type, brief, source, template_id, status, ai_raw_json, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      planId,
      projectId,
      leadId || null,
      projectType || null,
      brief || null,
      source,
      templateId || null,
      status,
      aiRawJson || null,
      status === "approved" ? "system" : null,
      approvedAt
    )
    .run();
  return planId;
}

async function insertSteps(db, planId, projectId, steps) {
  const rows = [];
  const stmts = steps.map((s, i) => {
    const id = uid();
    const dueDate = dueDateFromOffset(s.dueOffsetDays);
    rows.push({ id, ...s, due_date: dueDate });
    return db
      .prepare(
        `INSERT INTO onboarding_steps (id, plan_id, project_id, title, description, owner, category, order_index, due_offset_days, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(id, planId, projectId, s.title, s.description || null, s.owner || "tektone", s.category || null, i, Number.isFinite(s.dueOffsetDays) ? s.dueOffsetDays : null, dueDate);
  });
  await db.batch(stmts);
  return rows;
}

/** Mirrors approved onboarding_steps into `tasks` — same insert shape as
 *  wonAutomation.js's applyWorkflowTemplate, so staff see them on the
 *  existing Kanban board unchanged. Sets linked_task_id on each step.
 *  Exported so approvePlan() (Phase 2) can reuse it for a plan that was
 *  built as pending_review and is only now being mirrored on approval. */
export async function mirrorStepsToTasks(db, projectId, steps) {
  if (!steps.length) return;
  const maxRow = await db
    .prepare("SELECT COALESCE(MAX(order_index), -1) AS m FROM tasks WHERE project_id = ? AND column_id = 'todo'")
    .bind(projectId)
    .first();
  let orderIndex = Number(maxRow?.m ?? -1) + 1;
  const stmts = [];
  for (const step of steps) {
    const taskId = uid();
    stmts.push(
      db
        .prepare(
          `INSERT INTO tasks (id, project_id, column_id, title, description, priority, assignees, due_date, order_index, comments, created_at)
           VALUES (?, ?, 'todo', ?, ?, 'medium', '[]', ?, ?, '[]', datetime('now'))`
        )
        .bind(taskId, projectId, step.title, step.description || null, step.due_date, orderIndex++)
    );
    stmts.push(db.prepare(`UPDATE onboarding_steps SET linked_task_id = ? WHERE id = ?`).bind(taskId, step.id));
  }
  await db.batch(stmts);
}

/** Phase 1 entry point — called from wonAutomation.js right after the
 *  project/invite are created and the existing template lookup runs. Never
 *  throws on its own logic errors reaching the caller unhandled is fine —
 *  wonAutomation.js wraps this call in try/catch so a failure here can
 *  never block the rest of won-automation, same fail-open discipline as
 *  the pre-existing workflow_template lookup. */
export async function buildPlan(db, { projectId, leadId, projectType, brief, template }) {
  const ruleSteps = projectType ? ONBOARDING_RULES[projectType] : null;

  if (ruleSteps && ruleSteps.length) {
    const planId = await insertPlan(db, { projectId, leadId, projectType, brief, source: "rule_based", status: "approved" });
    const steps = await insertSteps(db, planId, projectId, ruleSteps);
    await mirrorStepsToTasks(db, projectId, steps);
    return { planId, source: "rule_based", stepCount: steps.length };
  }

  if (template) {
    const templateTasks = JSON.parse(template.tasks_json || "[]");
    if (!templateTasks.length) return null;
    const planId = await insertPlan(db, {
      projectId,
      leadId,
      projectType,
      brief,
      source: "static_template",
      templateId: template.id,
      status: "approved",
    });
    const steps = templateTasks.map((t) => ({
      title: t.title || "Tarefa",
      description: t.description || null,
      owner: "tektone",
      category: null,
      dueOffsetDays: t.dueOffsetDays,
    }));
    const inserted = await insertSteps(db, planId, projectId, steps);
    return { planId, source: "static_template", stepCount: inserted.length };
  }

  return null;
}

// ── Phase 2 — AI generation ─────────────────────────────────────────────────

function buildAiPrompt({ lead, projectType, brief }) {
  let qualification = null;
  try {
    qualification = lead.qualification ? JSON.parse(lead.qualification) : null;
  } catch {
    qualification = null;
  }

  const profile = [
    lead.name ? `Nome do cliente: ${lead.name}` : null,
    lead.company ? `Empresa: ${lead.company}` : null,
    lead.segmento ? `Segmento: ${lead.segmento}` : null,
    projectType ? `Tipo de projeto (categoria escolhida pelo closer): ${projectType}` : null,
    qualification?.teamSize ? `Tamanho da equipe: ${qualification.teamSize}` : null,
    qualification?.revenue ? `Faturamento mensal: ${qualification.revenue}` : null,
    qualification?.moment ? `Momento atual do negócio: ${qualification.moment}` : null,
    qualification?.urgency ? `Urgência: ${qualification.urgency}` : null,
    qualification?.investment ? `Capacidade de investimento: ${qualification.investment}` : null,
    Array.isArray(qualification?.goals) && qualification.goals.length ? `Objetivos declarados: ${qualification.goals.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n") || "(sem perfil adicional além do brief abaixo)";

  return `Você monta o checklist de onboarding de um cliente que acabou de fechar contrato com a Tektone (estúdio que constrói produtos, sites e sistemas digitais sob medida).

PERFIL DO CLIENTE E DO PROJETO:
${profile}

DIRETRIZES ESCRITAS PELO CLOSER SOBRE ESTE PROJETO ESPECÍFICO:
${brief}

Gere uma lista de etapas de onboarding adaptada a ESTE projeto específico — use as diretrizes acima para decidir quais etapas fazem sentido, pule etapas óbvias que as diretrizes já resolvem (ex: se o cliente já tem catálogo pronto, não peça o catálogo), e adicione etapas específicas que as diretrizes sugerem. Cada etapa tem um responsável: "tektone" (a equipe da Tektone executa) ou "customer" (o cliente precisa fazer ou entregar algo). Categorize cada etapa em uma destas categorias: ${CATEGORY_VALUES.join(", ")}. Estime dueOffsetDays (dias corridos a partir de hoje) para cada etapa, em ordem crescente e realista.

Responda APENAS com JSON válido (sem markdown, sem texto fora do JSON):
{
  "steps": [
    { "title": "...", "description": "...", "owner": "tektone|customer", "category": "kickoff|access|content|technical|design|training|launch", "dueOffsetDays": 3 }
  ]
}`;
}

async function callAnthropicForPlan(env, prompt) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[onboarding] ANTHROPIC_API_KEY not set — skipping AI onboarding generation");
    return null;
  }
  const model = env.CRM_AI_MODEL || DEFAULT_MODEL;
  try {
    const res = await fetchWithRetry(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
      },
      { tries: 2, baseMs: 400 }
    );
    if (!res.ok) {
      console.warn("[onboarding] API error", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json().catch(() => null);
    const text = (Array.isArray(data?.content) ? data.content.find((b) => b?.type === "text") : null)?.text;
    if (!text) return null;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : null;
    if (!rawSteps || !rawSteps.length) return null;
    // Never trust the model's owner/category enums blindly — sanitize
    // against the fixed vocabulary before this ever reaches the DB.
    const steps = rawSteps
      .map((s) => ({
        title: String(s?.title || "").trim(),
        description: s?.description ? String(s.description).trim() : null,
        owner: s?.owner === "customer" ? "customer" : "tektone",
        category: CATEGORY_VALUES.includes(s?.category) ? s.category : null,
        dueOffsetDays: Number.isFinite(s?.dueOffsetDays) ? s.dueOffsetDays : null,
      }))
      .filter((s) => s.title);
    if (!steps.length) return null;
    return { steps, raw: text };
  } catch (err) {
    console.warn("[onboarding]", err.message);
    return null;
  }
}

/** Phase 2 — proposes an onboarding step set from the closer's brief + the
 *  lead's qualification data. Fails open (returns null) on any error —
 *  missing key, API/network failure, or a response that doesn't parse into
 *  usable steps. The caller (wonAutomation.js) falls back to the Phase 1
 *  rule-based/static path when this returns null. */
export async function generateAiPlan(env, { lead, projectType, brief }) {
  const prompt = buildAiPrompt({ lead, projectType, brief });
  return callAnthropicForPlan(env, prompt);
}

/** Inserts an AI-generated plan as `pending_review` — NOT mirrored into
 *  `tasks`, not visible in the Portal, until a human calls approvePlan(). */
export async function buildAiPendingPlan(db, { projectId, leadId, projectType, brief, aiResult }) {
  const planId = await insertPlan(db, {
    projectId,
    leadId,
    projectType,
    brief,
    source: "ai_generated",
    status: "pending_review",
    aiRawJson: aiResult.raw,
  });
  const steps = await insertSteps(db, planId, projectId, aiResult.steps);
  return { planId, source: "ai_generated", stepCount: steps.length, status: "pending_review" };
}

// ── Phase 2 — review queue CRUD, used by worker/crm-entry.js's
//    /crm/api/onboarding/plans/* routes ───────────────────────────────────

const PLAN_SELECT = `SELECT op.*, p.name AS project_name FROM onboarding_plans op LEFT JOIN projects p ON p.id = op.project_id`;

export async function listPlans(db, { status } = {}) {
  const stmt = status
    ? db.prepare(`${PLAN_SELECT} WHERE op.status = ? ORDER BY op.created_at DESC`).bind(status)
    : db.prepare(`${PLAN_SELECT} ORDER BY op.created_at DESC`);
  const { results } = await stmt.all();
  return results;
}

export async function getPlanWithSteps(db, planId) {
  const plan = await db.prepare(`${PLAN_SELECT} WHERE op.id = ?`).bind(planId).first();
  if (!plan) return null;
  const { results: steps } = await db
    .prepare("SELECT * FROM onboarding_steps WHERE plan_id = ? ORDER BY order_index")
    .bind(planId)
    .all();
  return { plan, steps };
}

export async function addStep(db, planId, { title, description, owner, category, dueOffsetDays }) {
  const plan = await db.prepare("SELECT * FROM onboarding_plans WHERE id = ?").bind(planId).first();
  if (!plan) return null;
  const maxRow = await db
    .prepare("SELECT COALESCE(MAX(order_index), -1) AS m FROM onboarding_steps WHERE plan_id = ?")
    .bind(planId)
    .first();
  const orderIndex = Number(maxRow?.m ?? -1) + 1;
  const id = uid();
  const dueDate = dueDateFromOffset(dueOffsetDays);
  await db
    .prepare(
      `INSERT INTO onboarding_steps (id, plan_id, project_id, title, description, owner, category, order_index, due_offset_days, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .bind(
      id,
      planId,
      plan.project_id,
      title,
      description || null,
      owner === "customer" ? "customer" : "tektone",
      category || null,
      orderIndex,
      Number.isFinite(dueOffsetDays) ? dueOffsetDays : null,
      dueDate
    )
    .run();
  return db.prepare("SELECT * FROM onboarding_steps WHERE id = ?").bind(id).first();
}

const STEP_EDITABLE_FIELDS = ["title", "description", "owner", "category"];

export async function updateStep(db, planId, stepId, patch) {
  const step = await db.prepare("SELECT * FROM onboarding_steps WHERE id = ? AND plan_id = ?").bind(stepId, planId).first();
  if (!step) return null;
  const fields = {};
  for (const f of STEP_EDITABLE_FIELDS) if (f in patch) fields[f] = patch[f];
  if (fields.owner) fields.owner = fields.owner === "customer" ? "customer" : "tektone";
  if ("dueOffsetDays" in patch) {
    const days = Number.isFinite(patch.dueOffsetDays) ? patch.dueOffsetDays : null;
    fields.due_offset_days = days;
    fields.due_date = dueDateFromOffset(days);
  }
  const keys = Object.keys(fields);
  if (!keys.length) return step;
  await db
    .prepare(`UPDATE onboarding_steps SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .bind(...keys.map((k) => fields[k]), stepId)
    .run();
  return db.prepare("SELECT * FROM onboarding_steps WHERE id = ?").bind(stepId).first();
}

export async function deleteStep(db, planId, stepId) {
  await db.prepare("DELETE FROM onboarding_steps WHERE id = ? AND plan_id = ?").bind(stepId, planId).run();
}

/** Approves a pending_review plan — mirrors its current steps into `tasks`
 *  (whatever an admin edited them to be, not the raw AI output) and flips
 *  status so the Portal's GET /projects/:id/onboarding starts returning it. */
export async function approvePlan(db, planId, approverEmail) {
  const plan = await db.prepare("SELECT * FROM onboarding_plans WHERE id = ?").bind(planId).first();
  if (!plan) return null;
  if (plan.status === "approved") return { plan, alreadyApproved: true };
  const { results: steps } = await db
    .prepare("SELECT * FROM onboarding_steps WHERE plan_id = ? ORDER BY order_index")
    .bind(planId)
    .all();
  await mirrorStepsToTasks(db, plan.project_id, steps);
  await db
    .prepare(`UPDATE onboarding_plans SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?`)
    .bind(approverEmail || null, new Date().toISOString(), planId)
    .run();
  const updated = await db.prepare("SELECT * FROM onboarding_plans WHERE id = ?").bind(planId).first();
  return { plan: updated, alreadyApproved: false };
}
