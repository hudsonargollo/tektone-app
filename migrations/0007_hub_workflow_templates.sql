-- Phase 7 — admin-authored task templates (PRD §5.4: "Admins trigger
-- standard workflows... that auto-populate the Task Module"). tasks_json is
-- a JSON array of [{title, description, columnId, priority, dueOffsetDays}]
-- — applied by bulk-inserting rows into `tasks` for a target project,
-- due_date computed as today + dueOffsetDays.
CREATE TABLE IF NOT EXISTS workflow_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  tasks_json  TEXT NOT NULL,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
