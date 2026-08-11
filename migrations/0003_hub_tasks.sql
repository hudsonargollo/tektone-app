-- Phase 2 — task storage, migrated from KV kanban:cards. project_id equals
-- the legacy kanban:clients id verbatim (the migration script creates each
-- project with the SAME id as the old client), so no clientId->project_id
-- remapping table is needed anywhere in the app — they're the same string.
-- "extra" is a JSON catch-all for any field the frontend sends that isn't
-- one of the named columns below — the old KV blob was fully schemaless
-- (POST /cards spreads the whole request body onto the stored object), so
-- this keeps that flexibility instead of silently dropping fields.
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  project_id   TEXT,
  column_id    TEXT,
  title        TEXT,
  description  TEXT,
  priority     TEXT,
  assignee     TEXT,             -- legacy singular field, kept for shape fidelity
  assignees    TEXT,             -- JSON array
  due_date     TEXT,
  order_index  REAL,
  label_color  TEXT,
  reviewed     INTEGER NOT NULL DEFAULT 0,
  reviewed_at  TEXT,
  reviewed_by  TEXT,
  comments     TEXT,             -- JSON array, ported verbatim from card.comments
  extra        TEXT,             -- JSON object — any other field the frontend sent
  created_at   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
