-- Separate the landing-page qualification-form answers from staff-authored
-- `notes` (migration 0009_hub_crm.sql). The public intake route originally
-- stuffed a JSON blob into `notes` — that collides with CrmLeadDetail's
-- free-text notes textarea, which does a blind overwrite on save and would
-- silently destroy the structured qualification data the first time a
-- closer edits their own notes. `score`/`tier` are pulled out as real
-- columns (not just nested in JSON) so the CRM can filter/sort by them later
-- without a full-table JSON scan.
ALTER TABLE leads ADD COLUMN qualification TEXT; -- JSON: raw answers from the landing form
ALTER TABLE leads ADD COLUMN score INTEGER;
ALTER TABLE leads ADD COLUMN tier TEXT; -- 'hot' | 'warm' | 'cold'
