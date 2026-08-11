// crm_role ladder (migration 0009_hub_crm.sql) — partner < closer < admin,
// mirrors growth/apps/codigo-internacional's CI CRM role shape, but as a
// column on the existing shared `users` table instead of a parallel system.
const LADDER = { partner: 0, closer: 1, admin: 2 };

export function hasCrmAccess(user) {
  return Boolean(user?.crm_role && user.crm_role in LADDER);
}

export function isCrmCloserOrAbove(user) {
  return LADDER[user?.crm_role] >= LADDER.closer;
}

export function isCrmAdmin(user) {
  return user?.crm_role === "admin";
}
