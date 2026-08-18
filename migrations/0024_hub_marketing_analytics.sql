-- Marketing site funnel tracking: page_view (homepage load) -> form_start
-- (first advance past the qualificação form's gate question) -> form_complete
-- (successful POST to /crm/api/public/leads). No PII beyond an anonymous
-- per-tab session id (crypto.randomUUID, sessionStorage — not a long-lived
-- cookie) so visits/starts/completes can be correlated into a real funnel
-- without identifying anyone before they submit the form themselves.
CREATE TABLE IF NOT EXISTS marketing_events (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL,
  event_type    TEXT NOT NULL, -- 'page_view' | 'form_start' | 'form_complete'
  path          TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  referrer      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_marketing_events_type ON marketing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_marketing_events_session ON marketing_events(session_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_created ON marketing_events(created_at);
