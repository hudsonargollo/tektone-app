// Entry point for the tektone-portal Worker (tektone.com.br/portal/*).
//
// Reuses the SAME compiled Pages Functions backend as tektone-hub
// (dist/_worker.js/index.js, built once from functions/) — the customer
// portal doesn't need its own copy of the auth/projects/contracts/invoices
// routes, and per-route rbac checks (isProjectMember / isStaffOrAdmin in
// functions/_lib/rbac.js) already gate every request server-side regardless
// of which Worker it arrived through, so exposing the full route surface
// here isn't a new attack surface — see CustomerShell.jsx's own
// defense-in-depth comment. Only the FRONTEND bundle differs (dist-portal,
// built from portal.html via vite.portal.config.js), because it's a
// deliberately separate customer-facing product, not a hidden tab of the
// staff app.
import pagesHandler from "../dist/_worker.js/index.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/portal" || url.pathname.startsWith("/portal/")) {
      url.pathname = url.pathname.slice("/portal".length) || "/";
    }
    return pagesHandler.fetch(new Request(url, request), env, ctx);
  },
};
