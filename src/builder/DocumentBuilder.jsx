import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, ClipboardPaste, X } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { BLOCK_LIST, BLOCK_REGISTRY, ALLOWED_BLOCKS_BY_KIND, createBlock } from "./registry";
import BlockRenderer from "./BlockRenderer";
import PropertyPanel from "./PropertyPanel";
import RichtextEditor from "./RichtextEditor";
import { buildAiPrompt, applyAiJson } from "./aiJson";

const STATUS_LABEL = { draft: "rascunho", published: "publicado", archived: "arquivado" };

function AiJsonModal({ mod, mode, onClose, onApply }) {
  const [text, setText] = useState(mode === "copy" ? buildAiPrompt(mod) : "");
  const [error, setError] = useState("");

  function apply() {
    try {
      onApply(applyAiJson(mod, text));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl surface-1 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 font-semibold text-ink">
          {mode === "copy" ? "Copiar prompt para a IA" : "Colar resposta da IA"}
        </p>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={mode === "paste" ? "Cole aqui o JSON retornado pela IA…" : ""}
          className="w-full rounded-lg border border-ink/15 bg-transparent p-3 font-mono text-xs text-ink"
        />
        {error && <p className="mt-2 font-mono text-[11px] text-danger">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg surface-2 px-3 py-1.5 font-mono text-[11px] text-stone-500">
            fechar
          </button>
          {mode === "copy" ? (
            <button
              onClick={() => navigator.clipboard?.writeText(text)}
              className="rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay"
            >
              copiar
            </button>
          ) : (
            <button onClick={apply} className="rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay">
              aplicar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic builder for any single-content-type document kind (page today;
// form/quiz reuse this same shell in wizard mode, see Phase C). List view →
// canvas+block-list+property-panel edit view, mirrors the CI-inspired
// pattern documented in ~/.claude/plans/tektone-block-builder.md.
export default function DocumentBuilder({ kind, newPlaceholder, emptyText }) {
  const [docs, setDocs] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [doc, setDoc] = useState(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [aiModal, setAiModal] = useState(null);
  const saveTimerRef = useRef(null);
  const pendingPatchRef = useRef({});

  function load() {
    api
      .listBuilderDocuments(kind)
      .then(({ documents }) => setDocs(documents))
      .catch((e) => setError(e.body?.error || "Falha ao carregar."));
  }
  useEffect(load, [kind]);

  async function openDoc(id) {
    setError("");
    try {
      const { document } = await api.getBuilderDocument(id);
      setDoc(document);
      setActiveId(id);
      setSelectedBlockId(document.blocks[0]?.id || null);
    } catch (e) {
      setError(e.body?.error || "Falha ao abrir.");
    }
  }

  async function closeDoc() {
    await flushPendingSave();
    setActiveId(null);
    setDoc(null);
    setSelectedBlockId(null);
    load();
  }

  async function createDoc() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { document } = await api.createBuilderDocument({ kind, title: newTitle.trim() });
      setNewTitle("");
      await openDoc(document.id);
    } catch (e) {
      setError(e.body?.error || "Falha ao criar.");
    } finally {
      setCreating(false);
    }
  }

  // Debounced: PropertyPanel fires a change on every keystroke, and an
  // undebounced PATCH-per-keystroke lets responses race and arrive
  // out of order, silently overwriting a later keystroke with an earlier
  // one's (already-observed truncating a typed value mid-word). Only the
  // last change in a burst is ever sent, and it always carries the fully
  // merged patch accumulated since the previous flush.
  function saveDoc(patch) {
    if (!doc) return;
    const next = { ...doc, ...patch };
    setDoc(next);
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
    setSaving(true);
    setError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSave(next), 500);
  }

  async function flushSave(next) {
    saveTimerRef.current = null;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!next || !Object.keys(patch).length) {
      setSaving(false);
      return;
    }
    try {
      const body = {};
      if ("title" in patch) body.title = next.title;
      if ("slug" in patch) body.slug = next.slug;
      if ("blocks" in patch) body.blocks = next.blocks;
      await api.updateBuilderDocument(next.id, body);
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingSave() {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    await flushSave(doc);
  }

  async function publish() {
    if (!doc) return;
    await flushPendingSave();
    setSaving(true);
    try {
      await api.publishBuilderDocument(doc.id);
      setDoc((d) => ({ ...d, status: "published" }));
    } catch (e) {
      setError(e.body?.error || "Falha ao publicar.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!doc) return;
    setSaving(true);
    try {
      await api.archiveBuilderDocument(doc.id);
      setDoc((d) => ({ ...d, status: "archived" }));
    } catch (e) {
      setError(e.body?.error || "Falha ao arquivar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Excluir este documento?")) return;
    try {
      await api.deleteBuilderDocument(id);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao excluir.");
    }
  }

  function addBlock(type) {
    const block = createBlock(type);
    setSelectedBlockId(block.id);
    saveDoc({ blocks: [...doc.blocks, block] });
  }

  function updateBlockProps(blockId, props) {
    saveDoc({ blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, props } : b)) });
  }

  function moveBlock(blockId, dir) {
    const i = doc.blocks.findIndex((b) => b.id === blockId);
    const j = i + dir;
    if (j < 0 || j >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    saveDoc({ blocks });
  }

  function removeBlock(blockId) {
    const blocks = doc.blocks.filter((b) => b.id !== blockId);
    if (selectedBlockId === blockId) setSelectedBlockId(blocks[0]?.id || null);
    saveDoc({ blocks });
  }

  function duplicateBlock(blockId) {
    const i = doc.blocks.findIndex((b) => b.id === blockId);
    if (i < 0) return;
    const copy = { ...doc.blocks[i], id: crypto.randomUUID(), props: structuredClone(doc.blocks[i].props) };
    setSelectedBlockId(copy.id);
    saveDoc({ blocks: [...doc.blocks.slice(0, i + 1), copy, ...doc.blocks.slice(i + 1)] });
  }

  // ── list view ────────────────────────────────────────────────────────
  if (!activeId) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-5">
        {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}
        <div className="mb-4 flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDoc()}
            placeholder={newPlaceholder}
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            onClick={createDoc}
            disabled={creating || !newTitle.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            {creating ? <Spinner /> : <Plus size={12} />} novo
          </button>
        </div>

        {!docs ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-stone-500">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl surface-3 px-4 py-3">
                <button onClick={() => openDoc(d.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold text-ink">{d.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    /{d.slug} · {STATUS_LABEL[d.status]}
                  </p>
                </button>
                <button onClick={() => remove(d.id)} className="rounded-lg p-1.5 text-stone-400 hover:bg-danger/10 hover:text-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── edit view ────────────────────────────────────────────────────────
  const selectedBlock = doc?.blocks.find((b) => b.id === selectedBlockId) || null;
  const selectedMod = selectedBlock ? BLOCK_REGISTRY[selectedBlock.type] : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button onClick={closeDoc} className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink">
            <X size={16} />
          </button>
          <input
            value={doc.title}
            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
            onBlur={() => saveDoc({ title: doc.title })}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
          />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-400">
            {STATUS_LABEL[doc.status]}
            {saving && " · salvando…"}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {doc.status !== "published" ? (
            <button onClick={publish} className="rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay">
              publicar
            </button>
          ) : (
            <button onClick={archive} className="rounded-lg surface-2 px-3 py-1.5 font-mono text-[11px] text-stone-600">
              arquivar
            </button>
          )}
        </div>
      </div>

      {error && <p className="px-6 pt-2 font-mono text-[11px] text-danger">{error}</p>}

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-ink/15 p-3 lg:flex">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-stone-400">Blocos</p>
          <div className="mb-3 space-y-1">
            {doc.blocks.map((b, i) => {
              const mod = BLOCK_REGISTRY[b.type];
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedBlockId(b.id)}
                  className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                    b.id === selectedBlockId ? "bg-action/10 text-action" : "text-stone-600 hover:bg-ink/[0.04]"
                  }`}
                >
                  <span className="truncate">{mod?.label || b.type}</span>
                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(b.id, -1);
                      }}
                      disabled={i === 0}
                      className="p-0.5 disabled:opacity-30"
                    >
                      <ChevronUp size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(b.id, 1);
                      }}
                      disabled={i === doc.blocks.length - 1}
                      className="p-0.5 disabled:opacity-30"
                    >
                      <ChevronDown size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateBlock(b.id);
                      }}
                      className="p-0.5"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(b.id);
                      }}
                      className="p-0.5 hover:text-danger"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-stone-400">Adicionar</p>
          <div className="space-y-1">
            {BLOCK_LIST.filter((b) => !ALLOWED_BLOCKS_BY_KIND[kind] || ALLOWED_BLOCKS_BY_KIND[kind].includes(b.key)).map((b) => (
              <button
                key={b.key}
                onClick={() => addBlock(b.key)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left font-mono text-[11px] text-stone-500 hover:bg-ink/[0.04] hover:text-ink"
              >
                <Plus size={11} /> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            {doc.blocks.length === 0 ? (
              <p className="py-12 text-center text-sm text-stone-400">Adicione um bloco para começar.</p>
            ) : (
              <BlockRenderer blocks={doc.blocks} />
            )}
          </div>
        </div>

        <div className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-ink/15 p-4 xl:flex">
          {!selectedBlock ? (
            <p className="text-sm text-stone-400">Selecione um bloco.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">{selectedMod.label}</p>
                <div className="flex gap-1">
                  <button
                    title="copiar prompt para IA"
                    onClick={() => setAiModal({ mode: "copy" })}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-ink/[0.05] hover:text-ink"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    title="colar resposta da IA"
                    onClick={() => setAiModal({ mode: "paste" })}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-ink/[0.05] hover:text-ink"
                  >
                    <ClipboardPaste size={13} />
                  </button>
                </div>
              </div>

              {selectedBlock.type === "richtext" ? (
                <RichtextEditor
                  value={selectedBlock.props.markdown}
                  onChange={(markdown) => updateBlockProps(selectedBlock.id, { markdown })}
                />
              ) : (
                <PropertyPanel
                  schema={selectedMod.schema}
                  values={selectedBlock.props}
                  onChange={(props) => updateBlockProps(selectedBlock.id, props)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {aiModal && selectedBlock && (
        <AiJsonModal
          mod={selectedMod}
          mode={aiModal.mode}
          onClose={() => setAiModal(null)}
          onApply={(props) => {
            updateBlockProps(selectedBlock.id, { ...selectedBlock.props, ...props });
            setAiModal(null);
          }}
        />
      )}
    </div>
  );
}
