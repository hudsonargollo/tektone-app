// Guards the kanban API: every /api/kanban/* request must carry a valid
// session (cookie for web, bearer token for the mobile client) belonging to
// a STAFF/ADMIN account. A CUSTOMER-role account (Phase 4) authenticates
// fine but must never reach internal task detail or staff workload — that's
// the whole point of CustomerShell.jsx being a separate view — so this is
// checked here too, not just left to the frontend not rendering a link to it.

import { getSessionEmail } from "./_lib/session.js";
import { getUserByEmail } from "./_lib/db.js";
import { isStaffOrAdmin } from "./_lib/rbac.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/kanban") && request.method !== "OPTIONS") {
    const email = await getSessionEmail(request, env);
    const user = email && env.DB ? await getUserByEmail(env.DB, email) : null;
    if (!user || !isStaffOrAdmin(user)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return next();
}
