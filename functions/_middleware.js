// Guards the kanban API: every /api/kanban/* request must carry a valid
// session (cookie for web, bearer token for the mobile client) whose email
// is on the allowlist. Everything else passes through.

import { getSessionEmail } from "./_lib/session.js";
import { isAllowed } from "./_lib/allowlist.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/kanban") && request.method !== "OPTIONS") {
    const email = await getSessionEmail(request, env);
    if (!email || !isAllowed(email)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return next();
}
