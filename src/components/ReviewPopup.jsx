import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check, FolderPlus, Folder, X } from "lucide-react";
import { Avatar, Spinner } from "@/components/ui";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return d;
  }
}

export default function ReviewPopup({ reviews, avatarByName, onClose, onAck }) {
  const [busy, setBusy] = useState(false);
  const total = reviews.reduce((n, r) => n + r.tasks.length, 0);

  async function ack() {
    setBusy(true);
    try {
      await onAck(reviews.map((r) => r.id));
    } finally {
      setBusy(false);
    }
  }

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
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/15 px-6 py-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "rgba(122,90,110,0.15)", color: "#7A5A6E" }}
            >
              <Sparkles size={16} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">Tarefas geradas de reuniões</p>
              <p className="mt-0.5 text-xs text-stone-500">
                {total} tarefa{total === 1 ? "" : "s"} criada{total === 1 ? "" : "s"} a partir das
                anotações. Revise antes de seguir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            title="Fechar (mostrar depois)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {reviews.map((r) => (
            <div key={r.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-1 font-mono text-[11px] font-semibold text-stone-600">
                  {r.projectCreated ? <FolderPlus size={12} /> : <Folder size={12} />}
                  {r.project}
                </span>
                {r.projectCreated && (
                  <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
                    novo projeto
                  </span>
                )}
                {(r.meetingTitle || r.date) && (
                  <span className="truncate font-mono text-[10px] text-stone-400">
                    {r.meetingTitle}
                    {r.date ? ` · ${fmtDate(r.date)}` : ""}
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {r.tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-lg surface-3 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                    {t.assignees && t.assignees.length > 0 ? (
                      <span className="flex shrink-0 -space-x-1.5">
                        {t.assignees.map((name) => (
                          <Avatar
                            key={name}
                            name={name}
                            src={avatarByName?.[name?.trim().toLowerCase()]}
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-[10px] text-stone-400">
                        sem responsável
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink"
          >
            Depois
          </button>
          <button
            onClick={ack}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
          >
            {busy ? <Spinner /> : <Check size={14} />} Validar e dispensar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
