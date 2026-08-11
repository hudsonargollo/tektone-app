-- Phase 10 — Business Specialist Copilot's knowledge base + question log
-- (plan Phase 7). Same shape as growth/apps/codigo-internacional's CI CRM
-- (kb_documents + customer_questions), re-scoped: Tektone's own service
-- catalog / pricing / case studies instead of legal source-of-truth
-- material, and grounded in a lead's profile instead of a live-call
-- transcript. Starts EMPTY — needs Hudson's real service-catalog content
-- seeded before it's useful (see plan's open questions).

CREATE TABLE IF NOT EXISTS kb_documents (
  id          TEXT PRIMARY KEY,
  tier        TEXT NOT NULL, -- 'source_of_truth' | 'case_study' | 'faq'
  topic       TEXT,
  title       TEXT NOT NULL,
  content     TEXT,
  status      TEXT NOT NULL DEFAULT 'ready', -- 'ready' | 'archive'
  promoted_from_question_id TEXT,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_kb_documents_tier_status ON kb_documents(tier, status);

-- One row per copilot interaction — either a free-text question (ask mode)
-- or NULL question_text (suggest-directions mode, profile-only prompt).
CREATE TABLE IF NOT EXISTS lead_questions (
  id                TEXT PRIMARY KEY,
  lead_id           TEXT NOT NULL,
  asked_by_email    TEXT NOT NULL,
  question_text     TEXT, -- NULL for suggest-directions mode
  ai_draft_answer   TEXT,
  ai_citations      TEXT, -- JSON array of {kb_document_id, title, tier}
  ai_confidence     TEXT, -- 'alta' | 'media' | 'baixa'
  ai_latency_ms     INTEGER,
  status            TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'approved' — approving promotes to kb_documents (faq tier)
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_questions_lead ON lead_questions(lead_id);
