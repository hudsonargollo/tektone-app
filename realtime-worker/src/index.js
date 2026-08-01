/**
 * TEKTONE realtime broadcast Worker.
 *
 * Cloudflare Pages Functions can't define Durable Object classes themselves —
 * only consume one bound from a separately deployed Worker. This tiny Worker
 * exists solely to host BoardRoom, a single-instance DO ("main") that fans
 * out board events (currently just "card:reviewed", for the confetti
 * celebration) to every connected browser tab over WebSockets.
 *
 * The Pages app (tektone-app) binds to this via `script_name` in its
 * wrangler.toml — see functions/api/realtime/[[path]].js (connect) and
 * functions/api/kanban/[[path]].js (broadcast on review).
 */
import { DurableObject } from "cloudflare:workers";

export class BoardRoom extends DurableObject {
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // Clients only listen — no inbound messages are expected.
  async webSocketMessage() {}
  async webSocketClose() {}
  async webSocketError() {}

  // RPC, called by the kanban Pages Function after a card is reviewed.
  async broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        /* dead socket — ignore, hibernation API cleans these up */
      }
    }
  }
}

// This Worker is only ever reached through the BOARD_ROOM binding; it has no
// public routes of its own.
export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
