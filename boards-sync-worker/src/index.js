/**
 * TEKTONE Boards realtime sync Worker.
 *
 * Structural sibling of realtime-worker/ (same reason it's a separate Worker:
 * Pages Functions can't define Durable Object classes, only consume one bound
 * from a separately deployed Worker) — but per-document instead of a single
 * broadcast-only room, and bidirectional (it actually reads client messages
 * and applies them) instead of fan-out only.
 *
 * The Pages app binds to this via `script_name` (see wrangler.toml /
 * wrangler.worker.toml `BOARDS_SYNC` binding) — functions/api/boards/[[path]].js
 * proxies GET /api/boards/:id/connect to `env.BOARDS_SYNC.getByName(id).fetch()`,
 * one DO instance per board id.
 *
 * Wire protocol: y-protocols/sync's actual client-server model (verified
 * against its source, not guessed) — the CLIENT initiates with SyncStep1 on
 * connection open (confirmed in y-websocket's WebsocketProvider source: it
 * sends SyncStep1 from its own `websocket.onopen` handler), the SERVER
 * replies with SyncStep2 followed by its own SyncStep1, and ordinary content
 * changes travel as Update messages that get applied locally and rebroadcast
 * to every other connected client (never echoed back to the sender). Message
 * envelope matches y-websocket's own framing (a leading messageSync=0 byte
 * before the y-protocols/sync payload) since the browser client is
 * y-websocket's WebsocketProvider — see src/boards/BoardEditor.jsx.
 */
import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const messageSync = 0;
const FLUSH_ALARM_INTERVAL_MS = 30_000;

function snapshotKey(boardId) {
  return `boards/${boardId}.ydoc`;
}

export class BoardSyncRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.doc = null;
    this.boardId = null;
    this.loadingPromise = null;
    this.dirty = false;
  }

  // Lazy-loaded on first message after every wake-up (including after
  // hibernation — the DO's in-memory fields are gone on each fresh wake, so
  // this must not assume `this.doc` survived from a prior "connection").
  // Two-tier: DO's own storage first (fast, colocated, updated on every
  // local change), R2 as the durable source of truth (written on last
  // disconnect + periodic alarm, read here only on a cold DO with no local
  // storage yet — e.g. right after this board's very first connection ever,
  // or storage was evicted).
  async ensureDoc(boardId) {
    if (this.doc && this.boardId === boardId) return this.doc;
    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        const doc = new Y.Doc();
        const stored = await this.ctx.storage.get("snapshot");
        if (stored) {
          Y.applyUpdate(doc, new Uint8Array(stored));
        } else {
          const obj = await this.env.BOARDS_DATA.get(snapshotKey(boardId));
          if (obj) {
            Y.applyUpdate(doc, new Uint8Array(await obj.arrayBuffer()));
          }
        }
        this.doc = doc;
        this.boardId = boardId;
        return doc;
      })();
    }
    return this.loadingPromise;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 426 });
    }
    const boardId = new URL(request.url).searchParams.get("boardId");
    if (!boardId) return new Response("Missing boardId", { status: 400 });

    await this.ensureDoc(boardId);

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, message) {
    if (!(message instanceof ArrayBuffer)) return; // ignore stray text frames
    const boardId = this.boardId;
    const doc = await this.ensureDoc(boardId);

    const decoder = decoding.createDecoder(new Uint8Array(message));
    const outerType = decoding.readVarUint(decoder);
    if (outerType !== messageSync) return; // awareness/auth messages: not implemented yet, ignore gracefully

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    // readSyncMessage applies SyncStep2/Update directly to `doc`; for an
    // incoming SyncStep1 it writes a SyncStep2 reply into `encoder` (this is
    // the "reply with SyncStep2" half of the client-server model).
    const innerType = syncProtocol.readSyncMessage(decoder, encoder, doc, ws);

    if (innerType === syncProtocol.messageYjsSyncStep1) {
      // Complete the client-server handshake: after SyncStep2, also send our
      // own SyncStep1 so the client can tell us about any state we don't
      // have yet (mirrors y-websocket's reference server behavior exactly).
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, doc);
    }

    if (encoding.length(encoder) > 0) {
      try {
        ws.send(encoding.toUint8Array(encoder));
      } catch {
        /* dead socket — hibernation API cleans these up */
      }
    }

    if (innerType === syncProtocol.messageYjsUpdate || innerType === syncProtocol.messageYjsSyncStep2) {
      this.dirty = true;
      this.scheduleStorageFlush();
      this.broadcastExcept(ws, new Uint8Array(message));
    }
  }

  broadcastExcept(sender, rawMessage) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === sender) continue;
      try {
        ws.send(rawMessage);
      } catch {
        /* dead socket — ignore, hibernation API cleans these up */
      }
    }
  }

  // Debounced DO-storage flush (cheap, colocated) — not the R2 durability
  // flush, which only happens on last-disconnect + the periodic alarm below.
  async scheduleStorageFlush() {
    if (this._flushing) return;
    this._flushing = true;
    await new Promise((r) => setTimeout(r, 500));
    this._flushing = false;
    if (this.doc) {
      await this.ctx.storage.put("snapshot", Y.encodeStateAsUpdate(this.doc));
      this.dirty = false;
    }
    // Keep a safety-net alarm armed while this doc has ever been dirty, in
    // case the DO is evicted before a client disconnects cleanly.
    const current = await this.ctx.storage.getAlarm();
    if (!current) await this.ctx.storage.setAlarm(Date.now() + FLUSH_ALARM_INTERVAL_MS);
  }

  async alarm() {
    await this.flushToR2();
    if (this.ctx.getWebSockets().length > 0) {
      await this.ctx.storage.setAlarm(Date.now() + FLUSH_ALARM_INTERVAL_MS);
    }
  }

  async flushToR2() {
    if (!this.doc || !this.boardId) return;
    await this.env.BOARDS_DATA.put(snapshotKey(this.boardId), Y.encodeStateAsUpdate(this.doc));
  }

  async webSocketClose(ws) {
    if (this.ctx.getWebSockets().length === 0) {
      await this.flushToR2();
    }
  }

  async webSocketError(ws) {
    if (this.ctx.getWebSockets().length === 0) {
      await this.flushToR2().catch(() => {});
    }
  }
}

// Only ever reached through the BOARDS_SYNC binding; no public routes of its own.
export default {
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};
