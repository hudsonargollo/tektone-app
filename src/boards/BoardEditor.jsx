import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LayoutGrid, FileText } from "lucide-react";
import { effects } from "@blocksuite/presets/effects";
import { AffineSchemas } from "@blocksuite/blocks";
import { DocCollection, Schema, Text } from "@blocksuite/store";
import { MemoryBlobSource } from "@blocksuite/sync";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

// Registers the <page-editor>/<edgeless-editor> custom elements — a required
// module-level side effect, not something called per-mount. @blocksuite/presets,
// @blocksuite/store, @blocksuite/blocks, @blocksuite/sync and yjs are pinned to
// exact versions in package.json (no ^/~) — BlockSuite is pre-1.0 and its own
// package layout has already been reorganized once upstream (a newer
// @blocksuite/affine/* umbrella exists on their master branch); this file's
// API calls were verified against the actual v0.19.5 tag on github.com/
// toeverything/blocksuite (packages/playground/apps/starter/utils/collection.ts
// and data/empty.ts), not guessed from types alone. Bumping these deps needs a
// fresh re-check against whatever tag matches the new version, not a blind
// `npm update`.
effects();

// BlockSuite persists through a DocSource interface (pull/push/subscribe) —
// this implementation backs it with our own REST snapshot endpoints
// (functions/api/boards/[[path]].js) instead of BlockSuite's built-in
// IndexedDB/BroadcastChannel sources. Phase A has no realtime peer, so
// subscribe() is a no-op; Phase B adds a WebSocket-based DocSource for live
// multi-user sync, using this same interface rather than replacing this one.
class RestDocSource {
  name = "tektone-rest";
  constructor(boardId) {
    this.boardId = boardId;
    // Serializes push() calls — the DocEngine can fire several in quick
    // succession (one per local transaction), and each one's read-modify-
    // write against R2 must not race a concurrent one or an earlier update
    // gets silently lost.
    this._pushChain = Promise.resolve();
  }
  async pull() {
    const data = await api.getBoardSnapshot(this.boardId);
    return data ? { data } : null;
  }
  // DocEngine calls push() with an INCREMENTAL Yjs update (the diff since
  // the last sync point), not the full document state — confirmed by
  // reading @blocksuite/sync's own IndexedDBDocSource reference
  // implementation, which appends each update to a list rather than
  // overwriting. A plain R2 .put(data) here silently discarded everything
  // pushed before it (caught live: byte count was shrinking between pushes,
  // and reloading lost all typed content). Merge with whatever's already
  // stored instead, keeping R2 holding one canonical merged snapshot rather
  // than an ever-growing update log.
  async push(_docId, data) {
    this._pushChain = this._pushChain.then(async () => {
      const existing = await api.getBoardSnapshot(this.boardId);
      const merged = existing ? Y.mergeUpdates([existing, data]) : data;
      await api.putBoardSnapshot(this.boardId, merged);
    });
    await this._pushChain;
  }
  subscribe() {
    return () => {};
  }
}

// wss://<host>/hub/api/boards/:id/connect — mirrors src/lib/api.js's
// BASE_URL convention (Vite's import.meta.env.BASE_URL is "/hub/" in
// production, since the Worker route only owns /hub/* and /task/*, not the
// bare domain) and y-websocket's own URL construction (serverUrl + "/" +
// roomname), verified against its actual source rather than guessed.
function boardsWsUrl(boardId) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return {
    serverUrl: `${scheme}://${window.location.host}${base}/api/boards`,
    roomname: `${boardId}/connect`,
  };
}

export default function BoardEditor({ boardId, title, onClose }) {
  const stageRef = useRef(null);
  const collectionRef = useRef(null);
  const docRef = useRef(null);
  const editorElRef = useRef(null);
  const providerRef = useRef(null);
  const [mode, setMode] = useState("page");
  const [ready, setReady] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");

  function mountEditor(currentMode) {
    if (!stageRef.current || !docRef.current) return;
    editorElRef.current?.remove();
    const el = document.createElement(currentMode === "edgeless" ? "edgeless-editor" : "page-editor");
    el.doc = docRef.current;
    el.style.cssText = "display:block;width:100%;height:100%";
    stageRef.current.appendChild(el);
    editorElRef.current = el;
  }

  useEffect(() => {
    let destroyed = false;

    (async () => {
      try {
        const hadExisting = Boolean(await api.getBoardSnapshot(boardId));

        const schema = new Schema();
        schema.register(AffineSchemas);
        const collection = new DocCollection({
          id: boardId,
          schema,
          docSources: { main: new RestDocSource(boardId) },
          blobSources: { main: new MemoryBlobSource() },
        });
        collection.start();
        // Required before the first createDoc() call — it lazily sets up the
        // Yjs-backed proxy array addDocMeta()/getDoc() read and write through.
        // Skipping this doesn't throw; it just makes createDoc()'s internal
        // getDoc(docId) lookup silently return null (confirmed by reading
        // @blocksuite/store's actual collection.js/meta.js, not documented
        // anywhere narrative — the reference starter example gets away
        // without calling this directly in its own init function because its
        // caller (setup-playground.ts) already calls it once beforehand).
        collection.meta.initialize();
        if (destroyed) {
          collection.dispose();
          return;
        }
        collectionRef.current = collection;

        const doc = collection.getDoc(boardId) ?? collection.createDoc({ id: boardId });

        if (hadExisting) {
          doc.load();
        } else {
          // Fresh board — seed the minimal root/surface/note/paragraph structure
          // BlockSuite expects (verified against data/empty.ts at the matching
          // tag), rather than leaving a truly blank doc the editor can't render.
          doc.load(() => {
            const rootId = doc.addBlock("affine:page", { title: new Text() });
            doc.addBlock("affine:surface", {}, rootId);
            const noteId = doc.addBlock("affine:note", {}, rootId);
            doc.addBlock("affine:paragraph", {}, noteId);
          });
        }
        doc.resetHistory();

        if (destroyed) return;
        docRef.current = doc;
        mountEditor(mode);
        setReady(true);

        // Live multi-user sync, layered on top of the REST DocSource above
        // (which stays as the cold-load path and as a fallback if the socket
        // never connects — this never becomes a hard dependency). Operates
        // on the raw Y.Doc (BlockCollection.spaceDoc), not BlockSuite's own
        // Doc wrapper — WebsocketProvider is yjs-level, it doesn't know
        // about BlockSuite's block/schema layer, only the underlying CRDT.
        const blockCollection = collection.getBlockCollection(boardId);
        if (blockCollection && !destroyed) {
          const { serverUrl, roomname } = boardsWsUrl(boardId);
          const provider = new WebsocketProvider(serverUrl, roomname, blockCollection.spaceDoc, {
            connect: true,
          });
          provider.on("sync", (isSynced) => setSynced(Boolean(isSynced)));
          providerRef.current = provider;
        }
      } catch (e) {
        if (!destroyed) setError(e?.message || "Falha ao carregar o board.");
      }
    })();

    return () => {
      destroyed = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      editorElRef.current?.remove();
      collectionRef.current?.dispose();
      collectionRef.current = null;
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  function switchMode(next) {
    setMode(next);
    mountEditor(next);
  }

  return (
    <div className="flex h-full w-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="label-tech truncate max-w-[40vw]">{title || "Board"}</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${synced ? "bg-success" : "bg-stone-400"}`}
            title={synced ? "Sincronizado em tempo real" : "Sincronização em tempo real indisponível — salvando via snapshot"}
          />
        </div>
        <div className="flex gap-1 rounded-lg surface-3 p-1">
          <button
            onClick={() => switchMode("page")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              mode === "page" ? "bg-action text-clay" : "text-stone-500"
            }`}
          >
            <FileText size={12} /> página
          </button>
          <button
            onClick={() => switchMode("edgeless")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              mode === "edgeless" ? "bg-action text-clay" : "text-stone-500"
            }`}
          >
            <LayoutGrid size={12} /> quadro
          </button>
        </div>
      </div>

      {error && <p className="px-6 pt-3 font-mono text-[11px] text-danger">{error}</p>}
      {!ready && !error && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}
      <div ref={stageRef} className="min-h-0 flex-1" style={{ display: ready ? "block" : "none" }} />
    </div>
  );
}
