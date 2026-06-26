import { useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, Check, ArrowLeft, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, Spinner, PriorityBadge } from "@/components/ui";

const labelCls =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500";
const inputCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action";

export default function MeetingIntelligence({ clients, members, avatarByName, onClose, onSaved }) {
  const [phase, setPhase] = useState("input"); // input | review
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [excluded, setExcluded] = useState(new Set());
  const [saveSummary, setSaveSummary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const { analysis } = await api.analyzeMeeting({ transcript, title });
      setAnalysis(analysis);
      setProjectName(analysis.project || "");
      setExcluded(new Set());
      setPhase("review");
    } catch (e) {
      setError(e.body?.error || "Falha ao analisar. Verifique a chave do Gemini.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const actionItems = analysis.actionItems.filter((_, i) => !excluded.has(i));
      await api.commitAnalysis({
        projectName,
        meetingTitle: title,
        summary: analysis.summary,
        decisions: analysis.decisions,
        risks: analysis.risks,
        actionItems,
        saveSummaryCard: saveSummary,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (i) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const existingNames = clients.map((c) => c.name);
  const projectExists = existingNames.some((n) => n.toLowerCase() === projectName.toLowerCase());
  const keptCount = analysis ? analysis.actionItems.length - excluded.size : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-ink/15 px-6 py-4">
          <div className="flex items-center gap-2.5">
            {phase === "review" && (
              <button
                onClick={() => setPhase("input")}
                className="rounded-lg p-1 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                title="Voltar"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "rgba(122,90,110,0.15)", color: "#7A5A6E" }}
            >
              <Sparkles size={15} />
            </span>
            <span className="text-sm font-bold text-ink">Inteligência de Reuniões</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && <p className="font-mono text-[11px] text-danger">{error}</p>}

          {phase === "input" && (
            <>
              <div>
                <label className={labelCls}>Reunião (título)</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Reunião com advogada parceira"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Transcrição / anotações</label>
                <textarea
                  rows={12}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Cole aqui a transcrição ou as anotações da reunião…"
                  className={`${inputCls} resize-none font-mono text-xs leading-relaxed`}
                />
                <p className="mt-1.5 text-[11px] text-stone-400">
                  O Gemini extrai resumo, decisões, riscos e tarefas — e sugere o projeto.
                </p>
              </div>
            </>
          )}

          {phase === "review" && analysis && (
            <>
              <div>
                <label className={labelCls}>Projeto</label>
                <input
                  list="mi-projects"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={inputCls}
                />
                <datalist id="mi-projects">
                  {existingNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-stone-400">
                  {projectExists ? "Projeto existente." : `Novo projeto "${projectName}" será criado.`}
                </p>
              </div>

              {analysis.summary && (
                <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <FileText size={11} /> Resumo executivo
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                    {analysis.summary}
                  </p>
                </div>
              )}

              {analysis.decisions?.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <CheckCircle2 size={11} className="text-success" /> Decisões
                  </p>
                  <ul className="space-y-1">
                    {analysis.decisions.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-stone-700">
                        <span className="text-success">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.risks?.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <AlertTriangle size={11} className="text-warning" /> Riscos
                  </p>
                  <ul className="space-y-1">
                    {analysis.risks.map((r, i) => (
                      <li key={i} className="text-sm text-stone-700">
                        <span className="text-warning">•</span> {r.risk}
                        {r.mitigation && (
                          <span className="text-stone-500"> → {r.mitigation}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                  Tarefas ({keptCount}/{analysis.actionItems.length})
                </p>
                <div className="space-y-1.5">
                  {analysis.actionItems.map((it, i) => {
                    const off = excluded.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggle(i)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                          off ? "border-ink/10 bg-ink/[0.01] opacity-50" : "border-ink/10 surface-3"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            off ? "border-stone-300" : "border-action bg-action text-clay"
                          }`}
                        >
                          {!off && <Check size={11} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${off ? "line-through" : "text-ink"}`}>
                            {it.title}
                          </span>
                        </span>
                        <PriorityBadge priority={it.priority} />
                        {it.assignees?.length > 0 ? (
                          <span className="flex shrink-0 -space-x-1.5">
                            {it.assignees.map((n) => (
                              <Avatar key={n} name={n} src={avatarByName?.[n?.trim().toLowerCase()]} />
                            ))}
                          </span>
                        ) : (
                          <span className="shrink-0 font-mono text-[9px] text-stone-400">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={saveSummary}
                  onChange={(e) => setSaveSummary(e.target.checked)}
                  className="accent-action"
                />
                Salvar card de resumo (📝) no Backlog do projeto
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-4">
          <span className="font-mono text-[10px] text-stone-400">
            {phase === "input" ? "Powered by Gemini" : projectName || "—"}
          </span>
          {phase === "input" ? (
            <button
              onClick={analyze}
              disabled={busy || transcript.trim().length < 30}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Sparkles size={14} />} Analisar
            </button>
          ) : (
            <button
              onClick={save}
              disabled={busy || !projectName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Check size={14} />} Salvar no quadro
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
