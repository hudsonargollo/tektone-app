-- Phase 9 — CRM: Tektone's own lead pipeline and sales tracking, separate
-- from `projects` (which is post-sale delivery — see plan at
-- ~/.claude/plans/wise-riding-wirth.md, "Phase 5: Build /crm core"). Pattern
-- borrowed from growth/apps/codigo-internacional's CI CRM
-- (leads/lead_events/sales), scoped down to what Tektone's business actually
-- needs: no partner/referral system yet (confirmed no affiliates as of now),
-- so `commissions` is a single-beneficiary ledger (Hudson, 10% per sale),
-- not a multi-party payout engine — schema stays extensible if that changes.

-- crm_role is independent of access_role (STAFF/ADMIN/CUSTOMER, migration
-- 0001) — a user can be STAFF with no crm_role (no CRM access at all), or
-- STAFF + crm_role='closer' (works leads). Mirrors CI's partner<closer<admin
-- ladder, just as a column instead of a parallel roles table/system.
ALTER TABLE users ADD COLUMN crm_role TEXT; -- NULL | 'partner' | 'closer' | 'admin'

CREATE TABLE IF NOT EXISTS leads (
  id                     TEXT PRIMARY KEY,
  name                   TEXT,
  email                  TEXT,
  phone                  TEXT,
  company                TEXT,
  segmento               TEXT,
  utm_source             TEXT,
  utm_medium             TEXT,
  utm_campaign           TEXT,
  referrer               TEXT,
  status                 TEXT NOT NULL DEFAULT 'new', -- new | contacted | qualified | won | lost | incomplete
  assigned_closer_email  TEXT,
  lost_reason            TEXT,
  notes                  TEXT,
  -- Set by the won-lead automation (see migration 0010 / phase 6) when this
  -- lead converts into a real project — the hand-off point into /hub.
  converted_project_id   TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Append-only audit trail on every lead mutation (status change, assignment,
-- note added, etc.) — mirrors CI's lead_events pattern exactly.
CREATE TABLE IF NOT EXISTS lead_events (
  id          TEXT PRIMARY KEY,
  lead_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     TEXT, -- JSON
  actor_email TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);

CREATE TABLE IF NOT EXISTS sales (
  id           TEXT PRIMARY KEY,
  lead_id      TEXT NOT NULL,
  closer_email TEXT,
  amount       REAL NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'BRL',
  status       TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment | paid | onboarding | completed | refunded
  payment_ref  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_lead ON sales(lead_id);

-- One row auto-generated per sale (rate 0.10, beneficiary hudson@tektone.com.br)
-- by the sales-creation route — see worker/src/services/crm/salesService.js.
CREATE TABLE IF NOT EXISTS commissions (
  id                 TEXT PRIMARY KEY,
  sale_id            TEXT NOT NULL,
  beneficiary_email  TEXT NOT NULL,
  rate               REAL NOT NULL,
  amount             REAL NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending', -- pending | paid
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commissions_sale ON commissions(sale_id);
