// Only these emails may register / sign in. Enforced at signup, login,
// and on every guarded API request (defense in depth).
export const ALLOWED_EMAILS = [
  "hudson@tektone.com.br",
  "pedrosilvestrini@tektone.com.br",
  "alison@tektone.com.br",
];

export function isAllowed(email) {
  return ALLOWED_EMAILS.includes(String(email || "").trim().toLowerCase());
}
