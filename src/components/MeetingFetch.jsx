import { useState, useEffect } from "react";
import { Download, Check, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

export default function MeetingFetch({ onDone }) {
  const [meetings, setMeetings] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  const load = () => {
    setMeetings(null);
    setError("");
    api
      .listMeetings()
      .then(({ meetings, error }) => {
        if (error) return setError(error);
        setMeetings(meetings || []);
        // pre-select the unprocessed ones
        setSelected(new Set((meetings || []).filter((m) => !m.processed).map((m) => m.id)));
      })
      .catch((e) => setError(e.body?.error || "Falha ao listar reuniões."));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  async function run() {
    if (!selected.size) return;
    setBusy(true);
    setError("");
    try {
      const { results, error } = await api.processMeetings([...selected]);
      if (error) return setError(error);
      setResults(results || []);
      onDone?.();
    } catch (e) {
      setError(e.body?.error || "Falha ao buscar reuniões.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <Download size={15} className="text-action" />
          <span className="label-tech">Buscar reuniões</span>
        </div>
        {meetings && !results && (
          <button
            onClick={load}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            title="Atualizar lista"
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="mb-3 flex items-start gap-2 font-mono text-[11px] text-danger">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          {/* Results view */}
          {results ? (
            <div className="space-y-2">
              <p className="mb-2 text-sm text-stone-600">Importação concluída:</p>
              {results.map((r) => {
                const created = r.result?.created?.length || 0;
                const already = r.result?.alreadyProcessed;
                const reason = r.error || r.result?.error || (r.status ? `HTTP ${r.status}` : "erro");
                return (
                  <div
                    key={r.id || r.title}
                    className="rounded-lg surface-3 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.title || r.id}</span>
                      <span className="shrink-0 font-mono text-[11px]">
                        {!r.ok ? (
                          <span className="text-danger">falhou</span>
                        ) : already ? (
                          <span className="text-stone-400">já importada</span>
                        ) : (
                          <span className="text-success">
                            {r.result?.project} · {created} tarefa(s)
                          </span>
                        )}
                      </span>
                    </div>
                    {!r.ok && (
                      <p className="mt-1 break-words font-mono text-[10px] text-danger/80">{reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !meetings ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : meetings.length === 0 ? (
            <p className="py-10 text-center font-mono text-[11px] text-stone-400">
              nenhuma reunião encontrada
            </p>
          ) : (
            <ul className="space-y-1.5">
              {meetings.map((m) => {
                const on = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => toggle(m.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        on ? "border-action/40 surface-3" : "border-ink/10 hover:border-ink/20"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-action bg-action text-clay" : "border-stone-300"
                        }`}
                      >
                        {on && <Check size={11} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{m.title}</span>
                      </span>
                      {m.processed && (
                        <span className="shrink-0 rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-500">
                          já importada
                        </span>
                      )}
                      <span className="shrink-0 font-mono text-[10px] text-stone-400">
                        {fmtDate(m.date)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-4">
          <span className="font-mono text-[10px] text-stone-400">
            {results ? "" : `${selected.size} selecionada(s)`}
          </span>
          {results ? (
            <button
              onClick={() => {
                setResults(null);
                load();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action"
            >
              <CheckCircle2 size={14} /> Concluir
            </button>
          ) : (
            <button
              onClick={run}
              disabled={busy || !selected.size}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Download size={14} />} Buscar selecionadas
            </button>
          )}
        </div>
    </div>
  );
}
