// Guards the kanban API: every /api/kanban/* request must carry a valid
// session cookie. Auth endpoints and static assets pass through untouched.

import { getCookie, verifyToken } from "./_lib/session.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/kanban")) {
    if (request.method !== "OPTIONS") {
      const ok = await verifyToken(env.SESSION_SECRET, getCookie(request, "tk_session"));
      if (!ok) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  return next();
}
