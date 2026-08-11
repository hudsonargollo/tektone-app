-- Phase 1 — migrates KV auth:users wholesale into D1, adds RBAC.
-- "title" replaces the old free-text "role" (job title, e.g. "CTO") to avoid
-- colliding with the new access_role. "role" values already stored in KV
-- (users JSON) get copied into title during the data migration script.
CREATE TABLE IF NOT EXISTS users (
  email               TEXT PRIMARY KEY,
  name                TEXT,
  title               TEXT,
  access_role         TEXT NOT NULL DEFAULT 'CUSTOMER',  -- ADMIN | STAFF | CUSTOMER
  finance_authorized  INTEGER NOT NULL DEFAULT 0,        -- STAFF-only opt-in, admin-toggled
  phone               TEXT,
  location            TEXT,
  bio                 TEXT,
  avatar              TEXT,
  email_notifications INTEGER NOT NULL DEFAULT 1,
  password_hash       TEXT,
  salt                TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  last_login          TEXT
);
