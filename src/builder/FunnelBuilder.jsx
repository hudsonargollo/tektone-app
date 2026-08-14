import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const STATUS_LABEL = { draft: "rascunho", published: "publicado", archived: "arquivado" };
const KIND_LABEL = { page: "página", form: "formulário", quiz: "quiz" };
const CANDIDATE_KINDS = [
  { kind: "page", label: "Páginas" },
  { kind: "form", label: "Formulários" },
  { kind: "quiz", label: "Quizzes" },
];

// A funnel is an ordered sequence of existing page/form/quiz documents —
// not its own block list, so this is a dedicated (smaller) editor rather
// than DocumentBuilder in a different mode. See
// ~/.claude/plans/tektone-block-builder.md's Funis section: a step list +
// a lightweight branching-rule editor for quiz-driven forks, not a full
// visual flow-chart editor.
export default function FunnelBuilder() {
  const [funnels, setFunnels] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [steps, setSteps] = useState([]);
  const [candidates, setCandidates] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const saveTimerRef = useRef(null);

  function load() {
    api
      .listBuilderDocuments("funnel")
      .then(({ documents }) => setFunnels(documents))
      .catch((e) => setError(e.body?.error || "Falha ao carregar."));
  }
  useEffect(load, []);

  async function loadCandidates() {
    const results = await Promise.all(CANDIDATE_KINDS.map((c) => api.listBuilderDocuments(c.kind)));
    setCandidates(
      CANDIDATE_KINDS.map((c, i) => ({ kind: c.kind, label: c.label, documents: results[i].documents }))
    );
  }

  async function openFunnel(id) {
    setError("");
    try {
      const [{ document }, { steps: rawSteps }] = await Promise.all([
        api.getBuilderDocument(id),
        api.listBuilderSteps(id),
      ]);
      setFunnel(document);
      setSteps(
        rawSteps.map((s) => ({
          documentId: s.document_id,
          nextRule: s.next_rule,
          kind: s.kind,
          slug: s.slug,
          title: s.title,
          status: s.status,
        }))
      );
      setActiveId(id);
      loadCandidates();
    } catch (e) {
      setError(e.body?.error || "Falha ao abrir.");
    }
  }

  function closeFunnel() {
    setActiveId(null);
    setFunnel(null);
    setSteps([]);
    setCandidates(null);
    load();
  }

  async function createFunnel() {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError("");
    try {
      const { document } = await api.createBuilderDocument({ kind: "funnel", title: newTitle.trim() });
      setNewTitle("");
      await openFunnel(document.id);
    } catch (e) {
      setError(e.body?.error || "Falha ao criar.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Excluir este funil?")) return;
    try {
      await api.deleteBuilderDocument(id);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao excluir.");
    }
  }

  // Debounced for the same reason DocumentBuilder debounces block saves —
  // avoid a PATCH-per-click race corrupting step order.
  function persistSteps(nextSteps) {
    setSteps(nextSteps);
    setSaving(true);
    setError("");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushSteps(nextSteps), 400);
  }

  async function flushSteps(nextSteps) {
    saveTimerRef.current = null;
    try {
      await api.setBuilderSteps(activeId, nextSteps.map((s) => ({ documentId: s.documentId, nextRule: s.nextRule })));
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar etapas.");
    } finally {
      setSaving(false);
    }
  }

  async function flushPendingSteps() {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    await flushSteps(steps);
  }

  function addStep(doc) {
    persistSteps([...steps, { documentId: doc.id, nextRule: null, kind: doc.kind, slug: doc.slug, title: doc.title, status: doc.status }]);
  }

  function removeStep(i) {
    persistSteps(steps.filter((_, j) => j !== i));
  }

  function moveStep(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    persistSteps(next);
  }

  function updateNextRule(i, nextRule) {
    persistSteps(steps.map((s, j) => (j === i ? { ...s, nextRule } : s)));
  }

  async function saveTitle(title) {
    setFunnel((f) => ({ ...f, title }));
    try {
      await api.updateBuilderDocument(activeId, { title });
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    }
  }

  async function publish() {
    await flushPendingSteps();
    setSaving(true);
    try {
      await api.publishBuilderDocument(activeId);
      setFunnel((f) => ({ ...f, status: "published" }));
    } catch (e) {
      setError(e.body?.error || "Falha ao publicar.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    setSaving(true);
    try {
      await api.archiveBuilderDocument(activeId);
      setFunnel((f) => ({ ...f, status: "archived" }));
    } catch (e) {
      setError(e.body?.error || "Falha ao arquivar.");
    } finally {
      setSaving(false);
    }
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
            onKeyDown={(e) => e.key === "Enter" && createFunnel()}
            placeholder="Título do novo funil…"
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            onClick={createFunnel}
            disabled={creating || !newTitle.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            {creating ? <Spinner /> : <Plus size={12} />} novo
          </button>
        </div>

        {!funnels ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : funnels.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum funil criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {funnels.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl surface-3 px-4 py-3">
                <button onClick={() => openFunnel(f.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold text-ink">{f.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    /{f.slug} · {STATUS_LABEL[f.status]}
                  </p>
                </button>
                <button onClick={() => remove(f.id)} className="rounded-lg p-1.5 text-stone-400 hover:bg-danger/10 hover:text-danger">
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
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button onClick={closeFunnel} className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink">
            <X size={16} />
          </button>
          <input
            value={funnel.title}
            onChange={(e) => setFunnel({ ...funnel, title: e.target.value })}
            onBlur={() => saveTitle(funnel.title)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
          />
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone-400">
            {STATUS_LABEL[funnel.status]}
            {saving && " · salvando…"}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          {funnel.status !== "published" ? (
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

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-stone-400">Etapas</p>
        {steps.length === 0 && <p className="mb-4 text-sm text-stone-400">Nenhuma etapa ainda — adicione uma abaixo.</p>}
        <div className="mb-6 space-y-2">
          {steps.map((s, i) => (
            <div key={`${s.documentId}-${i}`} className="rounded-xl surface-3 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    etapa {i + 1} · {KIND_LABEL[s.kind]} · {STATUS_LABEL[s.status] || s.status}
                  </p>
                  <p className="truncate font-semibold text-ink">{s.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="rounded p-1 text-stone-400 hover:bg-ink/5 hover:text-ink disabled:opacity-30">
                    <ChevronUp size={13} />
                  </button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="rounded p-1 text-stone-400 hover:bg-ink/5 hover:text-ink disabled:opacity-30">
                    <ChevronDown size={13} />
                  </button>
                  <button onClick={() => removeStep(i)} className="rounded p-1 text-stone-400 hover:bg-danger/10 hover:text-danger">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {i < steps.length - 1 && (
                <BranchEditor step={s} stepIndex={i} totalSteps={steps.length} onChange={(rule) => updateNextRule(i, rule)} />
              )}
            </div>
          ))}
        </div>

        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-stone-400">Adicionar etapa</p>
        {!candidates ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {candidates.map((group) => (
              <div key={group.kind}>
                <p className="mb-1 font-mono text-[10px] text-stone-400">{group.label}</p>
                {group.documents.length === 0 ? (
                  <p className="text-xs text-stone-400">nenhum documento ainda</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {group.documents.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => addStep(d)}
                        className="flex items-center gap-1 rounded-lg surface-2 px-2.5 py-1 font-mono text-[11px] text-stone-600 hover:bg-ink/[0.06]"
                      >
                        <Plus size={11} /> {d.title}
                        <span className="text-stone-400">({STATUS_LABEL[d.status]})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Only quiz steps branch (the plan's "quiz tier → different next step" case)
// — every other step just falls through to "default". Targets are step
// indexes into this same funnel's own steps array; no target = funnel ends
// here.
function BranchEditor({ step, stepIndex, totalSteps, onChange }) {
  const rule = step.nextRule || { default: stepIndex + 1, branches: [] };

  function set(patch) {
    onChange({ ...rule, ...patch });
  }

  function setBranch(i, patch) {
    const branches = rule.branches.map((b, j) => (j === i ? { ...b, ...patch } : b));
    set({ branches });
  }

  function addBranch() {
    set({ branches: [...(rule.branches || []), { tier: "", goto: stepIndex + 1 }] });
  }

  function removeBranch(i) {
    set({ branches: rule.branches.filter((_, j) => j !== i) });
  }

  const stepOptions = Array.from({ length: totalSteps }, (_, i) => i).filter((i) => i !== stepIndex);

  return (
    <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
      {step.kind === "quiz" &&
        (rule.branches || []).map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
            <span>se tier =</span>
            <input
              value={b.tier}
              onChange={(e) => setBranch(i, { tier: e.target.value })}
              placeholder="hot"
              className="w-20 rounded border border-ink/15 bg-transparent px-1.5 py-1 text-ink"
            />
            <span>vai para</span>
            <select
              value={b.goto}
              onChange={(e) => setBranch(i, { goto: Number(e.target.value) })}
              className="rounded border border-ink/15 bg-transparent px-1.5 py-1 text-ink"
            >
              {stepOptions.map((i2) => (
                <option key={i2} value={i2}>
                  etapa {i2 + 1}
                </option>
              ))}
            </select>
            <button onClick={() => removeBranch(i)} className="text-stone-400 hover:text-danger">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      {step.kind === "quiz" && (
        <button onClick={addBranch} className="flex items-center gap-1 font-mono text-[11px] text-action">
          <Plus size={11} /> regra de tier
        </button>
      )}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
        <span>senão vai para</span>
        <select
          value={rule.default ?? ""}
          onChange={(e) => set({ default: e.target.value === "" ? null : Number(e.target.value) })}
          className="rounded border border-ink/15 bg-transparent px-1.5 py-1 text-ink"
        >
          <option value="">fim do funil</option>
          {stepOptions.map((i2) => (
            <option key={i2} value={i2}>
              etapa {i2 + 1}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
