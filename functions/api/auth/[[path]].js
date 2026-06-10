// Email/password auth backed by Cloudflare KV.
//   POST /api/auth/signup   { email, password, name? }
//   POST /api/auth/login    { email, password }
//   GET  /api/auth/me
//   POST /api/auth/logout
import {
  randomSaltHex,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  getCookie,
  sessionCookie,
} from "../../_lib/session.js";
import { isAllowed } from "../../_lib/allowlist.js";

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

const USERS_KEY = "auth:users";
async function getUsers(kv) {
  const raw = await kv.get(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
const saveUsers = (kv, users) => kv.put(USERS_KEY, JSON.stringify(users));

const normEmail = (e) => String(e || "").trim().toLowerCase();
const validPassword = (p) => typeof p === "string" && p.length >= 8;

export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    console.error("auth error:", e && e.stack);
    return json({ error: "Erro no servidor." }, 500);
  }
}

async function handle(context) {
  const { request, env, params } = context;
  const kv = env.KANBAN;
  const secret = env.SESSION_SECRET;
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const action = seg[0];
  const method = request.method;

  if (!kv) return json({ error: "KV (KANBAN) não vinculado." }, 500);
  if (!secret) return json({ error: "SESSION_SECRET ausente." }, 500);

  // ── me ──────────────────────────────────────────────────────────────────
  if (action === "me" && method === "GET") {
    const email = await verifySession(secret, getCookie(request, "tk_session"));
    return json({ authed: Boolean(email) && isAllowed(email), email: email || null });
  }

  // ── logout ──────────────────────────────────────────────────────────────
  if (action === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  // ── signup ──────────────────────────────────────────────────────────────
  if (action === "signup" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    const password = body.password;
    if (!isAllowed(email)) return json({ error: "Este e-mail não tem acesso." }, 403);
    if (!validPassword(password))
      return json({ error: "A senha precisa ter ao menos 8 caracteres." }, 400);

    const users = await getUsers(kv);
    if (users.some((u) => u.email === email))
      return json({ error: "Conta já existe. Faça login." }, 409);

    const salt = randomSaltHex();
    const hash = await hashPassword(password, salt);
    const user = {
      email,
      name: (body.name || email.split("@")[0]).trim(),
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await saveUsers(kv, users);

    const token = await signSession(secret, email);
    return json({ ok: true, email }, 201, { "Set-Cookie": sessionCookie(token) });
  }

  // ── login ───────────────────────────────────────────────────────────────
  if (action === "login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    const password = body.password;
    if (!isAllowed(email)) return json({ error: "Credenciais inválidas." }, 401);

    const users = await getUsers(kv);
    const user = users.find((u) => u.email === email);
    // Run a hash even when user missing to blunt timing/enumeration.
    const ok = user
      ? await verifyPassword(password, user)
      : (await hashPassword(password || "", "00"), false);
    if (!ok) return json({ error: "Credenciais inválidas." }, 401);

    const token = await signSession(secret, email);
    return json({ ok: true, email, name: user.name }, 200, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  return json({ error: "Not found" }, 404);
}
