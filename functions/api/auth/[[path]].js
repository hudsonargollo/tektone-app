// Auth endpoints: /api/auth/login (POST), /api/auth/me (GET), /api/auth/logout (POST)
import {
  makeToken,
  verifyToken,
  getCookie,
  timingSafeEqual,
  sessionCookie,
} from "../../_lib/session.js";

const jsonHeaders = { "Content-Type": "application/json" };
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extra } });

export async function onRequest(context) {
  const { request, env, params } = context;
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const action = seg[0];
  const method = request.method;

  if (action === "me" && method === "GET") {
    const authed = await verifyToken(env.SESSION_SECRET, getCookie(request, "tk_session"));
    return json({ authed, configured: Boolean(env.APP_PASSWORD) });
  }

  if (action === "login" && method === "POST") {
    if (!env.APP_PASSWORD || !env.SESSION_SECRET) {
      return json({ error: "Autenticação não configurada no servidor." }, 500);
    }
    const { password } = await request.json().catch(() => ({}));
    if (!password || !timingSafeEqual(String(password), env.APP_PASSWORD)) {
      return json({ error: "Senha incorreta." }, 401);
    }
    const token = await makeToken(env.SESSION_SECRET);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
  }

  if (action === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
  }

  return json({ error: "Not found" }, 404);
}
