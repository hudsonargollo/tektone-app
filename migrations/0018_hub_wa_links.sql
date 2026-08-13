-- WhatsApp/URL link shortener for the CRM (Phase D of the CI-parity
-- project — see ~/.claude/plans/clever-crunching-raccoon.md). Closers and
-- admins create a slug -> phone+message or slug -> arbitrary URL; the
-- public redirect worker (worker-links/, go.tektone.com.br) counts each
-- click before bouncing. Schema mirrors Código Internacional's own
-- ci_wa_links/ci_wa_numbers (migrations 0022/0023/0036/0037 in their repo),
-- collapsed into one final shape here instead of replaying their ALTER
-- history — Tektone's version never had the whatsapp-only starting shape.
CREATE TABLE IF NOT EXISTS wa_links (
  slug            TEXT PRIMARY KEY,
  title           TEXT,
  type            TEXT NOT NULL DEFAULT 'whatsapp', -- 'whatsapp' | 'url'
  phone           TEXT,
  message         TEXT,
  url             TEXT,
  clicks          INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  last_clicked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wa_links_created ON wa_links(created_at);

-- Saved WhatsApp numbers (e.g. "Hudson", "Pedro") for the link creator's
-- quick-pick chip row.
CREATE TABLE IF NOT EXISTS wa_numbers (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  phone      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
