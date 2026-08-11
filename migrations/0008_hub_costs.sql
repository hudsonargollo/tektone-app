-- Phase 3.5 — proper cost ledger replacing the single hand-typed
-- current_costs number from project_finances (migration 0004). Individual
-- line items with categories (admin-managed, "we can add categories"),
-- recurrence, and archive-not-delete so history is never lost. Income for
-- the same dashboard comes from the invoices table already built in Phase 4
-- (SUM of status='PAID') — this migration only adds the costs half.
CREATE TABLE IF NOT EXISTS cost_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS costs (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  category_id  TEXT,
  amount       REAL NOT NULL,
  recurrence   TEXT NOT NULL DEFAULT 'once', -- once | monthly
  cost_date    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active', -- active | archived
  created_by   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed categories from the reference sheet's own tool-subscription tab
-- ("CARTÃO ASSINATURA DE FERRAMENTAS") plus the reference Custos page's
-- own example ("Ferramentas") — a starting point, not a fixed enum; admins
-- can add more via the UI.
INSERT INTO cost_categories (id, name, color) VALUES
  ('cat-ferramentas', 'Ferramentas', '#C9A96A'),
  ('cat-marketing', 'Marketing', '#6FA8CF'),
  ('cat-ia', 'IA', '#9B87C4'),
  ('cat-design', 'Design', '#74B79B'),
  ('cat-administrativo', 'Administrativo', '#C57A72'),
  ('cat-operacional', 'Operacional', '#B8862F');
