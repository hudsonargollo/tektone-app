// Email/password auth primitives for the KV-backed user store.
// - Passwords: PBKDF2-HMAC-SHA256, per-user random salt (Workers-native crypto).
// - Sessions: signed token  base64url({email,exp}).hmac  using SESSION_SECRET.

const enc = new TextEncoder();
const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers hard-caps PBKDF2 at 100k

// ── hex helpers ─────────────────────────────────────────────────────────────
function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// ── base64url ───────────────────────────────────────────────────────────────
function b64urlEncode(str) {
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(str) {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  return atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

// ── password hashing ────────────────────────────────────────────────────────
export function randomSaltHex(bytes = 16) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifyPassword(password, user) {
  if (!user?.hash || !user?.salt) return false;
  const computed = await hashPassword(password, user.salt, user.iter ?? PBKDF2_ITERATIONS);
  return timingSafeEqual(computed, user.hash);
}

// ── HMAC ────────────────────────────────────────────────────────────────────
async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToHex(new Uint8Array(sig));
}

// ── sessions ────────────────────────────────────────────────────────────────
export async function signSession(secret, email, ttlSeconds = 60 * 60 * 24 * 30) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64urlEncode(JSON.stringify({ email, exp }));
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySession(secret, token) {
  if (!secret || !token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = await hmacHex(secret, payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const { email, exp } = JSON.parse(b64urlDecode(payload));
    if (!email || typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) return null;
    return email;
  } catch {
    return null;
  }
}

// ── misc ────────────────────────────────────────────────────────────────────
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
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
