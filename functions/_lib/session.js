// Shared session helpers for the password gate.
// Token is a deterministic HMAC of a constant, signed with SESSION_SECRET —
// unforgeable without the secret, which is enough for a single shared password.

const enc = new TextEncoder();
const TOKEN_PAYLOAD = "tektone-session-v1";

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeToken(secret) {
  return hmacHex(secret, TOKEN_PAYLOAD);
}

export async function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const expected = await makeToken(secret);
  return timingSafeEqual(token, expected);
}

export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `tk_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
