-- Phase C of the block builder — form/quiz submissions. See
-- ~/.claude/plans/tektone-block-builder.md and migrations/0021_hub_builder.sql.
CREATE TABLE IF NOT EXISTS builder_submissions (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES builder_documents(id),
  kind         TEXT NOT NULL,       -- 'form' | 'quiz'
  answers      TEXT NOT NULL,       -- JSON: {blockId: value}
  score        INTEGER,             -- quiz only — sum of selected options' scoreWeight
  tier         TEXT,                -- quiz only — matched from meta.scoringRules.tiers
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_builder_submissions_document ON builder_submissions(document_id);
