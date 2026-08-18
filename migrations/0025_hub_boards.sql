-- Boards: collaborative Notion+Miro-style docs/canvas (BlockSuite), gated behind
-- users.plus_enabled (admin-toggled, no real billing — see functions/_lib/rbac.js
-- hasPlusAccess). A board is private to its owner + explicit collaborators in
-- board_users, mirroring project_users rather than the flat role-gating
-- Financeiro/Comercial use — see isBoardMember in rbac.js for why staff don't get
-- an implicit pass here the way they do for projects.
ALTER TABLE users ADD COLUMN plus_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS boards (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Sem título',
  owner_email TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'page', -- 'page' | 'edgeless' — last-used view, cosmetic only
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS board_users (
  board_id   TEXT NOT NULL,
  user_email TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'editor', -- 'owner' | 'editor' | 'viewer'
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (board_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_board_users_email ON board_users(user_email);
