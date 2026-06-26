// Email-first auth backed by Cloudflare KV.
//   POST /api/auth/check    { email }            → { allowed, exists }
//   POST /api/auth/signup   { email, password }  → first-access account creation
//   POST /api/auth/login    { email, password }
//   GET  /api/auth/me
//   POST /api/auth/logout
//   GET  /api/auth/admin/users                   → admin only
//   POST /api/auth/admin/reset { email }         → admin only (clears an account)
import {
  randomSaltHex,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  getCookie,
  sessionCookie,
} from "../../_lib/session.js";
import { ALLOWED_EMAILS, isAllowed, isAdmin } from "../../_lib/allowlist.js";

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

// Editable profile fields (never expose salt/hash).
const PROFILE_FIELDS = ["name", "role", "phone", "location", "bio", "avatar"];
const MAX_AVATAR_LEN = 700000; // ~512 KB image as a data URL
const publicProfile = (u) => ({
  email: u.email,
  name: u.name ?? "",
  role: u.role ?? "",
  phone: u.phone ?? "",
  location: u.location ?? "",
  bio: u.bio ?? "",
  avatar: u.avatar ?? "",
  admin: isAdmin(u.email),
  createdAt: u.createdAt ?? null,
});

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
    const authed = Boolean(email) && isAllowed(email);
    let name = null;
    let avatar = null;
    if (authed) {
      const users = await getUsers(kv);
      const u = users.find((x) => x.email === email);
      name = u?.name ?? null;
      avatar = u?.avatar ?? null;
    }
    return json({
      authed,
      email: authed ? email : null,
      admin: authed && isAdmin(email),
      name,
      avatar,
    });
  }

  // ── directory (teammates: name + email + avatar) ─────────────────────────
  if (action === "directory" && method === "GET") {
    const email = await verifySession(secret, getCookie(request, "tk_session"));
    if (!email || !isAllowed(email)) return json({ error: "unauthorized" }, 401);
    const users = await getUsers(kv);
    return json({
      users: users.map((u) => ({
        email: u.email,
        name: u.name ?? "",
        avatar: u.avatar ?? "",
      })),
    });
  }

  // ── profile (current user) ────────────────────────────────────────────────
  if (action === "profile") {
    const email = await verifySession(secret, getCookie(request, "tk_session"));
    if (!email || !isAllowed(email)) return json({ error: "unauthorized" }, 401);
    const users = await getUsers(kv);
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) return json({ error: "Conta não encontrada." }, 404);

    if (method === "GET") return json({ profile: publicProfile(users[idx]) });

    if (method === "PUT") {
      const body = await request.json().catch(() => ({}));
      if (typeof body.avatar === "string" && body.avatar.length > MAX_AVATAR_LEN)
        return json({ error: "Imagem muito grande. Use uma menor." }, 413);
      for (const f of PROFILE_FIELDS) {
        if (f in body) users[idx][f] = typeof body[f] === "string" ? body[f] : users[idx][f];
      }
      await saveUsers(kv, users);
      return json({ profile: publicProfile(users[idx]) });
    }

    return json({ error: "Not found" }, 404);
  }

  // ── logout ──────────────────────────────────────────────────────────────
  if (action === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  // ── check (email-first branch) ────────────────────────────────────────────
  if (action === "check" && method === "POST") {
    const { email } = await request.json().catch(() => ({}));
    const e = normEmail(email);
    if (!isAllowed(e)) return json({ allowed: false, exists: false });
    const users = await getUsers(kv);
    return json({ allowed: true, exists: users.some((u) => u.email === e) });
  }

  // ── signup (first access) ─────────────────────────────────────────────────
  if (action === "signup" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    if (!isAllowed(email)) return json({ error: "Este e-mail não tem acesso." }, 403);
    if (!validPassword(body.password))
      return json({ error: "A senha precisa ter ao menos 8 caracteres." }, 400);

    const users = await getUsers(kv);
    if (users.some((u) => u.email === email))
      return json({ error: "Conta já existe. Faça login." }, 409);

    const salt = randomSaltHex();
    const hash = await hashPassword(body.password, salt);
    users.push({
      email,
      name: (body.name || email.split("@")[0]).trim(),
      salt,
      hash,
      createdAt: new Date().toISOString(),
    });
    await saveUsers(kv, users);
    const token = await signSession(secret, email);
    return json({ ok: true, email }, 201, { "Set-Cookie": sessionCookie(token) });
  }

  // ── login ─────────────────────────────────────────────────────────────────
  if (action === "login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    if (!isAllowed(email)) return json({ error: "Credenciais inválidas." }, 401);
    const users = await getUsers(kv);
    const user = users.find((u) => u.email === email);
    const ok = user
      ? await verifyPassword(body.password, user)
      : (await hashPassword(body.password || "", "00"), false);
    if (!ok) return json({ error: "Credenciais inválidas." }, 401);
    const token = await signSession(secret, email);
    return json({ ok: true, email, name: user.name }, 200, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  // ── admin (Hudson) ────────────────────────────────────────────────────────
  if (action === "admin") {
    const sessionEmail = await verifySession(secret, getCookie(request, "tk_session"));
    if (!sessionEmail || !isAdmin(sessionEmail)) return json({ error: "Acesso negado." }, 403);
    const sub = seg[1];

    if (sub === "users" && method === "GET") {
      const users = await getUsers(kv);
      const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
      return json({
        users: ALLOWED_EMAILS.map((e) => ({
          email: e,
          registered: Boolean(byEmail[e]),
          name: byEmail[e]?.name ?? null,
          createdAt: byEmail[e]?.createdAt ?? null,
          admin: isAdmin(e),
        })),
      });
    }

    if (sub === "reset" && method === "POST") {
      const { email } = await request.json().catch(() => ({}));
      const target = normEmail(email);
      if (!isAllowed(target)) return json({ error: "E-mail inválido." }, 400);
      const users = await getUsers(kv);
      await saveUsers(kv, users.filter((u) => u.email !== target));
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }

  return json({ error: "Not found" }, 404);
}
