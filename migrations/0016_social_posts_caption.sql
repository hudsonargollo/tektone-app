-- Adds an AI-authored overlay caption to social_posts. Previously the
-- overlay text drawn onto each generated image (SocialPostGenerator.jsx's
-- canvas step) was whatever the human typed into a blank "legenda
-- sobreposta (opcional)" field — nothing tied it to brand voice or the
-- business proposal. generateCaption() in socialPostService.js now drafts
-- it from brand_kb (voice + positioning matched to the chosen objective),
-- kept short by design (it renders inside a ~16%-height overlay band).
-- Nullable: caption generation is best-effort and must never block image
-- generation if the Anthropic call fails (see generateCaption's try/catch).
ALTER TABLE social_posts ADD COLUMN caption TEXT;
