-- Small admin-editable key/value store for the CRM (Phase C of the
-- CI-parity project — see ~/.claude/plans/clever-crunching-raccoon.md).
-- First use: a monthly revenue goal for the dashboard's hero progress bar,
-- mirroring the Hub Financeiro's "Meta de orçamento" pattern.
CREATE TABLE IF NOT EXISTS crm_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
