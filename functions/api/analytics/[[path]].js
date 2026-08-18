// Marketing site funnel tracking — see migrations/0024_hub_marketing_analytics.sql.
//
//   POST /api/analytics/event    — public, { type, sessionId, path?, utmSource?, utmMedium?, utmCampaign?, referrer? }
//   GET  /api/analytics/summary  — admin, ?days=30 — visits/starts/completes + daily breakdown
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const EVENT_TYPES = new Set(["page_view", "form_start", "form_complete"]);

async function requireAdmin(request, env) {
  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(env.DB, email) : null;
  return user && isAdmin(user) ? user : null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    // ── public: record an event ─────────────────────────────────────────
    if (seg[0] === "event" && !seg[1] && method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (!EVENT_TYPES.has(body.type)) return json({ error: "type inválido" }, 400);
      if (!body.sessionId || typeof body.sessionId !== "string") {
        return json({ error: "sessionId obrigatório" }, 400);
      }
      await db
        .prepare(
          `INSERT INTO marketing_events (id, session_id, event_type, path, utm_source, utm_medium, utm_campaign, referrer)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          uid(),
          body.sessionId,
          body.type,
          body.path || null,
          body.utmSource || null,
          body.utmMedium || null,
          body.utmCampaign || null,
          body.referrer || null
        )
        .run();
      return json({ ok: true }, 201);
    }

    // ── admin: funnel summary ───────────────────────────────────────────
    if (seg[0] === "summary" && !seg[1] && method === "GET") {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: "forbidden" }, 403);

      const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 365);
      const since = `-${days} days`;

      // Distinct sessions per event type, not raw row counts — a page
      // refresh or a double-click shouldn't inflate the funnel.
      const totalsRows = await db
        .prepare(
          `SELECT event_type, COUNT(DISTINCT session_id) as sessions
             FROM marketing_events
            WHERE created_at >= datetime('now', ?)
            GROUP BY event_type`
        )
        .bind(since)
        .all();
      const totals = { page_view: 0, form_start: 0, form_complete: 0 };
      for (const r of totalsRows.results) totals[r.event_type] = r.sessions;

      const dailyRows = await db
        .prepare(
          `SELECT date(created_at) as day, event_type, COUNT(DISTINCT session_id) as sessions
             FROM marketing_events
            WHERE created_at >= datetime('now', ?)
            GROUP BY day, event_type
            ORDER BY day ASC`
        )
        .bind(since)
        .all();

      return json({ days, totals, daily: dailyRows.results });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("analytics error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
