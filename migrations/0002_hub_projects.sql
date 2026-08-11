-- Phase 1 — projects + membership. client_ref traces back to the legacy
-- kanban:clients.id (KV) for the Phase 2 task migration; not a foreign key,
-- just a migration breadcrumb.
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  client_ref  TEXT,
  status      TEXT NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | ARCHIVED
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A row here is also the CUSTOMER invitation record: an admin/staff member
-- adds a client's email before that person ever has an account, and signup
-- checks for this row instead of a hardcoded allowlist (see rbac.js).
CREATE TABLE IF NOT EXISTS project_users (
  project_id  TEXT NOT NULL,
  user_email  TEXT NOT NULL,
  role        TEXT NOT NULL,   -- ADMIN | STAFF | CUSTOMER — role WITHIN this project
  invited_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_email)
);
