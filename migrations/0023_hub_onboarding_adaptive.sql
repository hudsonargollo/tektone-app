-- Adaptive customer onboarding (Phase 1 — rule-based, no AI yet). See
-- ~/.claude/plans/tektone-adaptive-onboarding.md for the full design.
--
-- Replaces the single static "Onboarding padrão" workflow_template with a
-- per-project onboarding_plans/onboarding_steps pair, so each won lead can
-- get a checklist shaped by its project_type instead of one universal list.
-- workflow_templates and the existing "Onboarding padrão" mechanism stay
-- untouched as the deliberate fallback when there's no project_type match.

ALTER TABLE projects ADD COLUMN project_type TEXT; -- captured at won-time; e.g. site_institucional | loja_virtual | sistema_interno | app_mobile | automacao | outro

-- One row per won-lead onboarding process. Holds the "guidelines" input and
-- generation provenance, and (from Phase 2 on) gates whether steps are
-- customer-visible yet.
CREATE TABLE IF NOT EXISTS onboarding_plans (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  lead_id      TEXT,
  project_type TEXT,
  brief        TEXT,               -- free-text guidelines the closer/admin typed at won-time
  source       TEXT NOT NULL,      -- 'ai_generated' | 'rule_based' | 'static_template' | 'manual'
  template_id  TEXT,               -- workflow_templates.id, when source = 'static_template'
  status       TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | approved
  ai_raw_json  TEXT,               -- raw AI proposal, kept even after edits, for audit (Phase 2)
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  approved_by  TEXT,
  approved_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_onboarding_plans_project ON onboarding_plans(project_id);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id               TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL,
  project_id       TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  owner            TEXT NOT NULL DEFAULT 'tektone', -- 'tektone' | 'customer'
  category         TEXT,             -- kickoff | access | content | technical | design | training | launch
  order_index      REAL NOT NULL DEFAULT 0,
  due_offset_days  INTEGER,
  due_date         TEXT,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped
  linked_task_id   TEXT,             -- tasks.id, set when mirrored into the internal Kanban
  completed_at     TEXT,
  completed_by     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_project ON onboarding_steps(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_plan ON onboarding_steps(plan_id);
