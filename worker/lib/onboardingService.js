// Builds the per-project onboarding plan when a lead is won (Phase 1 —
// rule-based only, no AI yet — see ~/.claude/plans/tektone-adaptive-onboarding.md).
// Two sources, in priority order:
//   1. ONBOARDING_RULES[projectType] — a known project type -> its static
//      step set, auto-approved (pre-vetted, admin-authored-equivalent
//      content, same trust level as a workflow_template). Mirrored into
//      `tasks` so staff see it on the existing Kanban board.
//   2. No match -> the "Onboarding padrão" workflow_template (already
//      applied to `tasks` by wonAutomation.js's existing applyWorkflowTemplate,
//      called BEFORE this) is mirrored into the same onboarding_plans/
//      onboarding_steps shape too, purely so the Portal has a checklist to
//      render for legacy/no-signal won-leads. Not re-inserted into `tasks`
//      — those rows already exist from the template application.
// Phase 2 adds a third source (AI-generated from the closer's brief) that
// lands as `pending_review` and does NOT touch `tasks`/the Portal until a
// human approves it — everything built here is auto-approved by design.
import { ONBOARDING_RULES } from "./onboardingRules.js";

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function dueDateFromOffset(days) {
  return Number.isFinite(days) ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : null;
}

async function insertPlan(db, { projectId, leadId, projectType, brief, source, templateId, status }) {
  const planId = uid();
  const approvedAt = status === "approved" ? new Date().toISOString() : null;
  await db
    .prepare(
      `INSERT INTO onboarding_plans (id, project_id, lead_id, project_type, brief, source, template_id, status, approved_by, approved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
 *  existing Kanban board unchanged. Sets linked_task_id on each step. */
async function mirrorStepsToTasks(db, projectId, steps) {
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
