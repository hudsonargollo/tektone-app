/**
 * Admin meeting fetcher — proxies the Apps Script Web App so superadmins can
 * list and on-demand import meeting notes from the frontend.
 *
 *   GET  /api/meetings/list      → { meetings: [{ id, title, date, processed }] }
 *   POST /api/meetings/process   { ids: [...] } → { results: [...] }
 *
 * Drive access lives in Apps Script (Google), so this just forwards to its
 * Web App (MEETINGS_WEBAPP_URL) with the shared MEETINGS_WEBAPP_TOKEN. Admin only.
 */
import { verifySession, getCookie } from "../../_lib/session.js";
import { isAdmin } from "../../_lib/allowlist.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  const email = await verifySession(env.SESSION_SECRET, getCookie(request, "tk_session"));
  if (!email || !isAdmin(email)) return json({ error: "forbidden" }, 403);

  const url = env.MEETINGS_WEBAPP_URL;
  const token = env.MEETINGS_WEBAPP_TOKEN;
  if (!url || !token) return json({ error: "Web App de reuniões não configurado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const action = seg[0];
  const q = (extra) =>
    `${url}?token=${encodeURIComponent(token)}${extra}`;

  try {
    if (action === "list" && request.method === "GET") {
      const r = await fetch(q("&action=list"), { redirect: "follow" });
      return json(await r.json());
    }
    if (action === "process" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const ids = (Array.isArray(body.ids) ? body.ids : []).join(",");
      if (!ids) return json({ error: "Nenhuma reunião selecionada." }, 400);
      const r = await fetch(q(`&action=process&ids=${encodeURIComponent(ids)}`), {
        method: "POST",
        redirect: "follow",
      });
      return json(await r.json());
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message || "Falha ao contatar o Web App." }, 502);
  }
}
