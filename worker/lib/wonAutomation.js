// Won-lead automation (plan Phase 6) — runs once, when a lead's status
// transitions to 'won'. Four side effects, each logged to lead_events so
// the audit trail shows exactly what happened (or didn't):
//   1. Create the `projects` row + a CUSTOMER `project_users` invite — the
//      hand-off from /crm into /hub (same D1, no cross-system sync needed).
//   2. Apply the default onboarding `workflow_template` (see
//      functions/api/workflow-templates/[[path]].js's `apply` action —
//      duplicated here rather than imported since that file is gated by a
//      Pages Functions `context` shape this Worker doesn't have) — bulk
//      seeds the internal onboarding checklist into the new project's tasks.
//      Only runs when neither the AI nor the rule-based path below applies.
//   3. Build the adaptive onboarding_plans/onboarding_steps rows (see
//      onboardingService.js and ~/.claude/plans/tektone-adaptive-onboarding.md).
//      Priority order: a brief present -> ask Claude for a plan grounded in
//      the lead's qualification data + the brief (Phase 2 — lands
//      `pending_review`, doesn't touch `tasks` until an admin approves it
//      in the Hub); no brief or AI failed open -> a project_type rule match
//      (Phase 1, auto-approved, mirrored into `tasks` immediately); neither
//      -> the static template from step 2, mirrored into the same shape
//      purely so the Portal has a checklist to render.
//   4. Commission generation already happens at sale-creation time (see
//      worker/lib/crmDb.js's createCommissionForSale, called from
//      worker/crm-entry.js's POST /leads/:id/sales) — not repeated here.
import { buildPlan, generateAiPlan, buildAiPendingPlan } from "./onboardingService.js";
import { ONBOARDING_RULES } from "./onboardingRules.js";

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

// Which workflow_template counts as "the" onboarding checklist is an open
// question (see plan's "Open questions" section) — resolved by convention
// instead of a schema flag: an admin authors a template with this exact
// name via the existing admin UI, and it's picked up automatically. No
// matching template → the automation still runs (project + invite), just
// logs that this step was skipped rather than failing the whole thing.
const ONBOARDING_TEMPLATE_NAME = "Onboarding padrão";

async function applyWorkflowTemplate(db, template, projectId) {
  const tasks = JSON.parse(template.tasks_json || "[]");
  if (!tasks.length) return 0;
  const maxRow = await db
    .prepare("SELECT COALESCE(MAX(order_index), -1) AS m FROM tasks WHERE project_id = ? AND column_id = ?")
    .bind(projectId, tasks[0]?.columnId || "todo")
    .first();
  let orderIndex = Number(maxRow?.m ?? -1) + 1;
  const stmts = tasks.map((t) => {
    const dueDate = Number.isFinite(t.dueOffsetDays)
      ? new Date(Date.now() + t.dueOffsetDays * 86400000).toISOString().slice(0, 10)
      : null;
    return db
      .prepare(
        `INSERT INTO tasks (id, project_id, column_id, title, description, priority, assignees, due_date, order_index, comments, created_at)
         VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, '[]', datetime('now'))`
      )
      .bind(uid(), projectId, t.columnId || "todo", t.title || "Tarefa", t.description || null, t.priority || "medium", dueDate, orderIndex++);
  });
  await db.batch(stmts);
  return tasks.length;
}

async function logEvent(db, leadId, type, payload, actorEmail) {
  await db
    .prepare(`INSERT INTO lead_events (id, lead_id, type, payload, actor_email) VALUES (?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), leadId, type, payload ? JSON.stringify(payload) : null, actorEmail || null)
    .run();
}

export async function runWonAutomation(db, lead, actorEmail, opts = {}) {
  if (lead.converted_project_id) return { skipped: "already_converted" };

  const projectType = opts.projectType || null;
  const brief = opts.brief || null;
  const env = opts.env || null;
  // A project_type with a known rule set replaces the static template for
  // this project instead of stacking both checklists onto the board — see
  // onboardingService.buildPlan.
  const hasRule = Boolean(projectType && ONBOARDING_RULES[projectType]?.length);

  const projectId = uid();
  const projectName = lead.company || lead.name || `Lead ${lead.id.slice(0, 8)}`;
  await db
    .prepare(`INSERT INTO projects (id, name, client_ref, status, project_type) VALUES (?, ?, ?, 'ACTIVE', ?)`)
    .bind(projectId, projectName, lead.id, projectType)
    .run();
  await logEvent(db, lead.id, "project_created", { projectId, name: projectName, projectType }, actorEmail);

  if (lead.email) {
    await db
      .prepare(
        `INSERT INTO project_users (project_id, user_email, role) VALUES (?, ?, 'CUSTOMER')
         ON CONFLICT(project_id, user_email) DO UPDATE SET role = excluded.role`
      )
      .bind(projectId, lead.email.trim().toLowerCase())
      .run();
    await logEvent(db, lead.id, "customer_invited", { email: lead.email }, actorEmail);
  } else {
    await logEvent(db, lead.id, "customer_invite_skipped", { reason: "lead has no email" }, actorEmail);
  }

  // Phase 2 — a brief is the strongest adaptation signal: try an
  // AI-generated plan before falling back to the rule-based/static path.
  // Fails open (aiResult stays null) on any error, missing key, or a
  // response that doesn't parse into usable steps — generateAiPlan() never
  // throws on its own, but this is wrapped anyway for defense in depth.
  let aiResult = null;
  if (brief && env) {
    try {
      aiResult = await generateAiPlan(env, { lead, projectType, brief });
    } catch (e) {
      await logEvent(db, lead.id, "onboarding_ai_failed", { error: e.message }, actorEmail);
    }
  }

  let template = null;
  let onboardingPlan = null;
  if (aiResult) {
    // Lands `pending_review` — does NOT touch `tasks`/the Portal until an
    // admin approves it in the Hub, so skip the rule-based/static path
    // entirely here (no stacking two checklists while one awaits review).
    try {
      onboardingPlan = await buildAiPendingPlan(db, { projectId, leadId: lead.id, projectType, brief, aiResult });
      await logEvent(
        db,
        lead.id,
        "onboarding_plan_created",
        { planId: onboardingPlan.planId, source: onboardingPlan.source, stepCount: onboardingPlan.stepCount, status: onboardingPlan.status },
        actorEmail
      );
    } catch (e) {
      await logEvent(db, lead.id, "onboarding_plan_failed", { error: e.message }, actorEmail);
    }
  } else {
    if (!hasRule) {
      template = await db
        .prepare("SELECT * FROM workflow_templates WHERE name = ? ORDER BY created_at DESC LIMIT 1")
        .bind(ONBOARDING_TEMPLATE_NAME)
        .first();
      if (template) {
        const created = await applyWorkflowTemplate(db, template, projectId);
        await logEvent(db, lead.id, "onboarding_applied", { templateId: template.id, tasksCreated: created }, actorEmail);
      } else {
        await logEvent(
          db,
          lead.id,
          "onboarding_skipped",
          { reason: `no workflow_template named "${ONBOARDING_TEMPLATE_NAME}" exists yet` },
          actorEmail
        );
      }
    }

    // Builds onboarding_plans/onboarding_steps — a rule match here also
    // mirrors its steps into `tasks` (see onboardingService.js); the
    // static template branch above already inserted into `tasks` itself,
    // so its buildPlan call below only records the matching Portal-facing
    // rows. Wrapped so a failure here can never block project
    // creation/invite, same fail-open discipline as the template lookup.
    try {
      onboardingPlan = await buildPlan(db, { projectId, leadId: lead.id, projectType, brief, template });
      if (onboardingPlan) {
        await logEvent(
          db,
          lead.id,
          "onboarding_plan_created",
          { planId: onboardingPlan.planId, source: onboardingPlan.source, stepCount: onboardingPlan.stepCount },
          actorEmail
        );
      }
    } catch (e) {
      await logEvent(db, lead.id, "onboarding_plan_failed", { error: e.message }, actorEmail);
    }
  }

  await db.prepare(`UPDATE leads SET converted_project_id = ? WHERE id = ?`).bind(projectId, lead.id).run();

  return { projectId, onboardingApplied: Boolean(template) || hasRule, onboardingPlan };
}
