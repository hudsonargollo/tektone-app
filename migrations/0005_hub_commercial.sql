-- Phase 4 — customer-facing commercial module: contracts (self-built
-- click-to-sign first, per approved plan) and invoices (manual creation,
-- Stripe wiring is Phase 5). Both scoped by project_id; access enforced at
-- the API layer (functions/api/projects/[[path]].js), not by any DB
-- constraint — matches this stack's existing convention (see users/tasks).
CREATE TABLE IF NOT EXISTS contracts (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE', -- DRAFT | PENDING_SIGNATURE | SIGNED | VOID
  signature_hash    TEXT,          -- sha256(content + signer email + timestamp) — self-sign audit trail
  signer_ip         TEXT,
  signer_user_agent TEXT,
  signed_at         TEXT,
  signed_by         TEXT,          -- user_email
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  description  TEXT,
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'BRL',
  status       TEXT NOT NULL DEFAULT 'UNPAID',  -- UNPAID | PAID | OVERDUE | VOID
  due_date     TEXT,
  paid_at      TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
