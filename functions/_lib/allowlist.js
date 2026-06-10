// Only these emails may register / sign in. Enforced at signup, login,
// check, and on every guarded API request (defense in depth).
export const ALLOWED_EMAILS = [
  "hudson@tektone.com.br",
  "pedrosilvestrini@tektone.com.br",
  "alison@tektone.com.br",
];

// Admins can reset other users' accounts (no email infra → admin-assisted reset).
export const ADMIN_EMAILS = ["hudson@tektone.com.br"];

const norm = (e) => String(e || "").trim().toLowerCase();

export const isAllowed = (email) => ALLOWED_EMAILS.includes(norm(email));
export const isAdmin = (email) => ADMIN_EMAILS.includes(norm(email));
