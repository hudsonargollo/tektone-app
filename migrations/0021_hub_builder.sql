-- Block-based page/form/quiz/funnel builder (Blog panel's new tab set).
-- A "Document" is an ordered array of typed Blocks (JSON) — one Render
-- component per block type, used identically by the builder's live canvas
-- and by the public route in marketing/, so editor and published output can
-- never drift apart. See docs/ARCHITECTURE.md and
-- ~/.claude/plans/tektone-block-builder.md for the full design.
--
-- blog_posts (migration 0011) is untouched — Posts keeps its own markdown
-- column for now; this table is only for the three genuinely new kinds
-- (page/form/quiz — a funnel references those, it isn't its own content).

CREATE TABLE IF NOT EXISTS builder_documents (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,       -- 'page' | 'form' | 'quiz' | 'funnel'
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  blocks       TEXT NOT NULL DEFAULT '[]',     -- JSON array of {id, type, props}
  meta         TEXT,                -- JSON: SEO title/description, funnel step config, quiz scoring rules
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_documents_kind_slug ON builder_documents(kind, slug);
CREATE INDEX IF NOT EXISTS idx_builder_documents_kind_status ON builder_documents(kind, status);

-- Funnels are an ordered sequence of other documents (pages/forms/quizzes),
-- not a new block type — a funnel IS its steps, referenced by id. Unused
-- until Phase D (funnels); created now so the schema ships as one unit.
CREATE TABLE IF NOT EXISTS builder_funnel_steps (
  funnel_id    TEXT NOT NULL REFERENCES builder_documents(id),
  step_index   INTEGER NOT NULL,
  document_id  TEXT NOT NULL REFERENCES builder_documents(id),
  next_rule    TEXT,   -- JSON: {default: stepIndex} | branching by a quiz's tier/answer
  PRIMARY KEY (funnel_id, step_index)
);
