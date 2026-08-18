// Role-based access control — Phase 1 foundation. Replaces the old hardcoded
// ALLOWED_EMAILS array with D1-backed checks. Phase 1 ships no invite UI yet,
// so the *effective* set of who can create an account is still just
// pre-provisioned rows (today: the 2 seeded admins, migrated verbatim from
// KV) — no behavior change for end users, just a storage/mechanism swap that
// Phase 3/4 (staff + customer invites) build on without another auth rework.
import { getUserByEmail } from "./db.js";

// An email may complete signup if either:
//  (a) a row already exists for it with no password yet (admin pre-created
//      the account — a "staff invite", not built until a later phase), or
//  (b) it has a project_users row (a "customer invite" — an admin/staff
//      member added this email to a project before the person ever signed up).
// Neither mechanism has an admin UI yet in Phase 1, so this stays a no-op
// gate for new emails until that ships — existing accounts are unaffected.
export async function canSignUp(db, email) {
  const existing = await getUserByEmail(db, email);
  if (existing) return !existing.password_hash;
  const invited = await db
    .prepare("SELECT 1 FROM project_users WHERE user_email = ? LIMIT 1")
    .bind(email)
    .first();
  return Boolean(invited);
}

export function isAdmin(user) {
  return user?.access_role === "ADMIN";
}

export function isStaffOrAdmin(user) {
  return user?.access_role === "ADMIN" || user?.access_role === "STAFF";
}

export function hasFinanceAccess(user) {
  return isAdmin(user) || (user?.access_role === "STAFF" && Number(user?.finance_authorized) === 1);
}

export function hasPlusAccess(user) {
  return isAdmin(user) || Number(user?.plus_enabled) === 1;
}

// Unlike isProjectMember below, staff do NOT get an implicit pass — Boards sits
// behind the extra plus_enabled gate already, so access is admin-override or
// explicit board_users membership only, never role-based.
export async function isBoardMember(db, user, boardId) {
  if (isAdmin(user)) return true;
  const row = await db
    .prepare("SELECT 1 FROM board_users WHERE board_id = ? AND user_email = ?")
    .bind(boardId, user.email)
    .first();
  return Boolean(row);
}

export async function isProjectMember(db, user, projectId) {
  if (isStaffOrAdmin(user)) return true; // staff/admin implicitly pass, per PRD §4
  const row = await db
    .prepare("SELECT 1 FROM project_users WHERE project_id = ? AND user_email = ?")
    .bind(projectId, user.email)
    .first();
  return Boolean(row);
}
