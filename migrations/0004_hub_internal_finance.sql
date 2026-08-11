-- Phase 3 — internal cost/budget tracking per project. STAFF/ADMIN only,
-- gated by rbac.hasFinanceAccess — must never be reachable from any
-- CUSTOMER-facing view (see functions/api/finances/[[path]].js).
CREATE TABLE IF NOT EXISTS project_finances (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL UNIQUE,
  total_internal_budget REAL NOT NULL DEFAULT 0,
  current_costs         REAL NOT NULL DEFAULT 0,
  notes                 TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by            TEXT
);
