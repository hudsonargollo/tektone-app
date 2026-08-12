-- Extends the AI Instagram post generator (migration 0014) to support
-- carousels and stories, not just single feed posts. A carousel is
-- multiple social_posts rows sharing a group_id, ordered by slide_index —
-- kept as one-row-per-image (not a JSON array column) so each slide still
-- gets its own r2_key, master_prompt, export status, and delete-ability,
-- consistent with how a single feed post already works. A story is just a
-- feed post with a taller forced aspect ratio (1080x1920); it doesn't need
-- group_id/slide_index.
ALTER TABLE social_posts ADD COLUMN post_format TEXT NOT NULL DEFAULT 'feed'; -- 'feed' | 'carousel' | 'story'
ALTER TABLE social_posts ADD COLUMN group_id TEXT; -- ties carousel slides together; NULL for feed/story
ALTER TABLE social_posts ADD COLUMN slide_index INTEGER; -- 0-based order within a carousel; NULL otherwise

CREATE INDEX IF NOT EXISTS idx_social_posts_group ON social_posts(group_id);
