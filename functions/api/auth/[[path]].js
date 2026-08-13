// Email-first auth backed by D1 (Phase 1 of the Hub Tektone migration — was
// KV `auth:users`, see migrations/0001_hub_users.sql). Response shapes are
// UNCHANGED from the KV version so the existing frontend needs no edits yet.
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
  getSessionEmail,
  sessionCookie,
} from "../../_lib/session.js";
import {
  getUserByEmail,
  listUsers,
  createUser,
  completeInvitedSignup,
  touchLastLogin,
  updateUserFields,
  deleteUser,
} from "../../_lib/db.js";
import { canSignUp, isAdmin as checkIsAdmin, hasFinanceAccess as checkHasFinanceAccess } from "../../_lib/rbac.js";

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

const normEmail = (e) => String(e || "").trim().toLowerCase();
const validPassword = (p) => typeof p === "string" && p.length >= 8;

// Editable profile fields, mapped JS-shape → D1 column. "role" here is the
// legacy job-title field (e.g. "CTO") — it maps to the `title` column, NEVER
// to `access_role` (the RBAC field), so a profile edit can't self-elevate
// permissions. access_role is intentionally not in this map at all.
const PROFILE_FIELD_MAP = {
  name: "name",
  role: "title",
  phone: "phone",
  location: "location",
  bio: "bio",
  avatar: "avatar",
  emailNotifications: "email_notifications",
  timezone: "timezone",
};
const MAX_AVATAR_LEN = 700000; // ~512 KB image as a data URL
const publicProfile = (u) => ({
  email: u.email,
  name: u.name ?? "",
  role: u.title ?? "",
  phone: u.phone ?? "",
  location: u.location ?? "",
  bio: u.bio ?? "",
  avatar: u.avatar ?? "",
  emailNotifications: u.email_notifications !== 0,
  timezone: u.timezone || "",
  admin: checkIsAdmin(u),
  createdAt: u.created_at ?? null,
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
  const db = env.DB;
  const secret = env.SESSION_SECRET;
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const action = seg[0];
  const method = request.method;

  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);
  if (!secret) return json({ error: "SESSION_SECRET ausente." }, 500);

  // ── me ──────────────────────────────────────────────────────────────────
  if (action === "me" && method === "GET") {
    const email = await getSessionEmail(request, env);
    const user = email ? await getUserByEmail(db, email) : null;
    const authed = Boolean(user);
    return json({
      authed,
      email: authed ? email : null,
      admin: authed && checkIsAdmin(user),
      accessRole: authed ? user.access_role : null,
      financeAccess: authed && checkHasFinanceAccess(user),
      // NULL unless explicitly granted (migration 0009_hub_crm.sql) —
      // independent of accessRole, gates /crm access specifically.
      crmRole: authed ? (user.crm_role ?? null) : null,
      name: user?.name ?? null,
      avatar: user?.avatar ?? null,
      timezone: user?.timezone || null,
    });
  }

  // ── directory (teammates: name + email + avatar) ─────────────────────────
  if (action === "directory" && method === "GET") {
    const email = await getSessionEmail(request, env);
    const me = email ? await getUserByEmail(db, email) : null;
    if (!me) return json({ error: "unauthorized" }, 401);
    const users = await listUsers(db);
    return json({
      users: users.map((u) => ({ email: u.email, name: u.name ?? "", avatar: u.avatar ?? "" })),
    });
  }

  // ── profile (current user) ────────────────────────────────────────────────
  if (action === "profile") {
    const email = await getSessionEmail(request, env);
    const user = email ? await getUserByEmail(db, email) : null;
    if (!user) return json({ error: "unauthorized" }, 401);

    if (method === "GET") return json({ profile: publicProfile(user) });

    if (method === "PUT") {
      const body = await request.json().catch(() => ({}));
      if (typeof body.avatar === "string" && body.avatar.length > MAX_AVATAR_LEN)
        return json({ error: "Imagem muito grande. Use uma menor." }, 413);
      const fields = {};
      for (const [jsKey, column] of Object.entries(PROFILE_FIELD_MAP)) {
        if (!(jsKey in body)) continue;
        if (jsKey === "emailNotifications") fields[column] = body[jsKey] ? 1 : 0;
        else if (typeof body[jsKey] === "string") fields[column] = body[jsKey];
      }
      const updated = await updateUserFields(db, email, fields);
      return json({ profile: publicProfile(updated) });
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
    const existing = await getUserByEmail(db, e);
    const exists = Boolean(existing?.password_hash);
    const allowed = exists || (await canSignUp(db, e));
    return json({ allowed, exists });
  }

  // ── signup (first access) ─────────────────────────────────────────────────
  if (action === "signup" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    if (!validPassword(body.password))
      return json({ error: "A senha precisa ter ao menos 8 caracteres." }, 400);

    const existing = await getUserByEmail(db, email);
    if (existing?.password_hash) return json({ error: "Conta já existe. Faça login." }, 409);
    if (!(await canSignUp(db, email))) return json({ error: "Este e-mail não tem acesso." }, 403);

    const salt = randomSaltHex();
    const hash = await hashPassword(body.password, salt);
    const name = (body.name || email.split("@")[0]).trim();
    if (existing) await completeInvitedSignup(db, email, { name, salt, hash });
    else await createUser(db, { email, name, salt, hash });

    const token = await signSession(secret, email);
    // token is redundant for the web client (it already has the Set-Cookie),
    // included so a native client can store it and send it as a bearer header.
    return json({ ok: true, email, token }, 201, { "Set-Cookie": sessionCookie(token) });
  }

  // ── login ─────────────────────────────────────────────────────────────────
  if (action === "login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const email = normEmail(body.email);
    const user = await getUserByEmail(db, email);
    const ok = user?.password_hash
      ? await verifyPassword(body.password, { hash: user.password_hash, salt: user.salt })
      : (await hashPassword(body.password || "", "00"), false);
    if (!ok) return json({ error: "Credenciais inválidas." }, 401);
    await touchLastLogin(db, email);
    const token = await signSession(secret, email);
    return json({ ok: true, email, name: user.name, token }, 200, {
      "Set-Cookie": sessionCookie(token),
    });
  }

  // ── admin ────────────────────────────────────────────────────────────────
  if (action === "admin") {
    const sessionEmail = await getSessionEmail(request, env);
    const sessionUser = sessionEmail ? await getUserByEmail(db, sessionEmail) : null;
    if (!checkIsAdmin(sessionUser)) return json({ error: "Acesso negado." }, 403);
    const sub = seg[1];

    if (sub === "users" && method === "GET") {
      const users = await listUsers(db);
      return json({
        users: users.map((u) => ({
          email: u.email,
          registered: Boolean(u.password_hash),
          name: u.name ?? null,
          createdAt: u.created_at ?? null,
          admin: checkIsAdmin(u),
          accessRole: u.access_role,
          financeAuthorized: Boolean(u.finance_authorized),
        })),
      });
    }

    if (sub === "reset" && method === "POST") {
      const { email } = await request.json().catch(() => ({}));
      const target = normEmail(email);
      if (!(await getUserByEmail(db, target))) return json({ error: "E-mail inválido." }, 400);
      await deleteUser(db, target);
      return json({ ok: true });
    }

    // STAFF-only opt-in for internal financial visibility (PRD §4 — "internal
    // financial metrics only if explicitly authorized"). ADMIN already has
    // finance access unconditionally via rbac.hasFinanceAccess, so this is a
    // no-op for admin targets.
    if (sub === "finance-access" && method === "POST") {
      const { email, authorized } = await request.json().catch(() => ({}));
      const target = normEmail(email);
      const targetUser = await getUserByEmail(db, target);
      if (!targetUser) return json({ error: "E-mail inválido." }, 400);
      await updateUserFields(db, target, { finance_authorized: authorized ? 1 : 0 });
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }

  return json({ error: "Not found" }, 404);
}
