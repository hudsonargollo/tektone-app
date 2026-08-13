-- Per-user display timezone (e.g. a teammate traveling/based outside
-- São Paulo). NULL means "use the org default" (America/Sao_Paulo) — see
-- src/lib/timezone.js. Every date/time shown in the app should format
-- through that shared helper instead of the browser's local timezone.
ALTER TABLE users ADD COLUMN timezone TEXT;
