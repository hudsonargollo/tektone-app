/**
 * Realtime board events (Pages Function) — proxies a WebSocket upgrade to the
 * BoardRoom Durable Object in the sibling `tektone-realtime` Worker.
 *
 * GET /api/realtime/connect  → upgrades to a WebSocket; the client then just
 * listens for broadcast events (e.g. { type: "card:reviewed", ... }) pushed
 * by functions/api/kanban/[[path]].js after a review action.
 */
import { getSessionEmail } from "../../_lib/session.js";
import { isAllowed } from "../../_lib/allowlist.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);

  if (seg[0] !== "connect") return new Response("Not found", { status: 404 });

  const email = await getSessionEmail(request, env);
  if (!email || !isAllowed(email)) return new Response("Unauthorized", { status: 401 });

  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 426 });
  }
  if (!env.BOARD_ROOM) return new Response("Realtime not configured", { status: 503 });

  return env.BOARD_ROOM.getByName("main").fetch(request);
}
