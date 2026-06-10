// Guards the kanban API: every /api/kanban/* request must carry a valid
// session cookie whose email is on the allowlist. Everything else passes through.

import { getCookie, verifySession } from "./_lib/session.js";
import { isAllowed } from "./_lib/allowlist.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/kanban") && request.method !== "OPTIONS") {
    const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
    if (!email || !isAllowed(email)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return next();
}
