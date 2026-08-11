// Phase 1 bridge — signup/login/check/directory and the kanban middleware
// have moved to D1-backed checks (see _lib/db.js + _lib/rbac.js). This file
// stays only for the handful of routes not yet cut over (realtime, kanban's
// own author-check, analyze, meetings) — kept in sync with D1's access_role
// by hand for now. Migrate those 4 routes to rbac.isAdmin/isStaffOrAdmin in
// a later phase, then delete this file.
export const ALLOWED_EMAILS = [
  "hudson@tektone.com.br",
  "pedrosilvestrini@tektone.com.br",
];

// Matches D1 users.access_role = 'ADMIN' (both seeded as admin — see PRD §4).
export const ADMIN_EMAILS = [
  "hudson@tektone.com.br",
  "pedrosilvestrini@tektone.com.br",
];

const norm = (e) => String(e || "").trim().toLowerCase();

export const isAllowed = (email) => ALLOWED_EMAILS.includes(norm(email));
export const isAdmin = (email) => ADMIN_EMAILS.includes(norm(email));
