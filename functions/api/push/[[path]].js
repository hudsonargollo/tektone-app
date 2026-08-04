/**
 * Push subscription registry (Pages Function). Bound to the same KANBAN KV
 * namespace as functions/api/kanban/[[path]].js, which reads these keys to
 * actually send pushes (sendWebPush/sendExpoPush) at each notification event.
 *
 * KV keys:
 *   push:web   → { [email]: [{ endpoint, expirationTime, keys }, ...] }
 *   push:expo  → { [email]: [expoPushToken, ...] }
 *
 * Routes (relative to /api/push):
 *   POST /subscribe        — { endpoint, expirationTime, keys } (browser PushSubscription.toJSON())
 *   POST /unsubscribe      — { endpoint }
 *   POST /register-expo    — { token } (Expo push token, mobile)
 */
import { getSessionEmail } from "../../_lib/session.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function kvGet(kv, key, fallback = {}) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const kvSet = (kv, key, value) => kv.put(key, JSON.stringify(value));

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (method !== "POST") return json({ error: "Not found" }, 404);

  const kv = env.KANBAN;
  if (!kv) return json({ error: "KV namespace KANBAN not bound" }, 500);

  const email = await getSessionEmail(request, env);
  if (!email) return json({ error: "unauthorized" }, 401);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const route = seg[0];

  try {
    if (route === "subscribe") {
      const body = await request.json().catch(() => ({}));
      if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return json({ error: "Assinatura de push inválida." }, 400);
      }
      const all = await kvGet(kv, "push:web", {});
      const existing = all[email] || [];
      // dedupe by endpoint — resubscribing (e.g. new browser tab) replaces the old entry
      all[email] = [
        ...existing.filter((s) => s.endpoint !== body.endpoint),
        { endpoint: body.endpoint, expirationTime: body.expirationTime ?? null, keys: body.keys },
      ];
      await kvSet(kv, "push:web", all);
      return json({ ok: true });
    }

    if (route === "unsubscribe") {
      const body = await request.json().catch(() => ({}));
      const all = await kvGet(kv, "push:web", {});
      if (all[email]) {
        all[email] = all[email].filter((s) => s.endpoint !== body.endpoint);
        await kvSet(kv, "push:web", all);
      }
      return json({ ok: true });
    }

    if (route === "register-expo") {
      const body = await request.json().catch(() => ({}));
      if (!body.token) return json({ error: "Token ausente." }, 400);
      const all = await kvGet(kv, "push:expo", {});
      const existing = all[email] || [];
      all[email] = existing.includes(body.token) ? existing : [...existing, body.token];
      await kvSet(kv, "push:expo", all);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
