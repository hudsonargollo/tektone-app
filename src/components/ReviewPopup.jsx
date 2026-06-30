import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Check,
  FolderPlus,
  Folder,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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

const slideVariants = {
  enter: (dir) => ({ x: dir >= 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir >= 0 ? -48 : 48, opacity: 0 }),
};

export default function ReviewPopup({
  reviews,
  cards,
  avatarByName,
  activeId,
  onActiveChange,
  onClose,
  onAck,
  onEditTask,
  onDismissTask,
}) {
  const [busy, setBusy] = useState(false);
  const [dir, setDir] = useState(0); // slide direction for the animation

  // Render from the LIVE board so edits show instantly and dismissed (deleted)
  // cards drop out on their own. Each review task's id IS the real card id.
  const cardById = useMemo(() => {
    const m = {};
    for (const c of cards || []) m[c.id] = c;
    return m;
  }, [cards]);

  // One slide per meeting batch; drop batches whose cards are all gone.
  const liveReviews = useMemo(
    () =>
      (reviews || [])
        .map((r) => ({
          ...r,
          tasks: (r.tasks || []).map((t) => cardById[t.id]).filter(Boolean),
        }))
        .filter((r) => r.tasks.length > 0),
    [reviews, cardById]
  );

  const total = liveReviews.reduce((n, r) => n + r.tasks.length, 0);
  const count = liveReviews.length;

  // Current slide derived from the lifted activeId (falls back to the first).
  const index = Math.max(
    0,
    liveReviews.findIndex((r) => r.id === activeId)
  );
  const current = liveReviews[index];

  function goTo(i, direction) {
    if (i < 0 || i >= count || i === index) return;
    setDir(direction);
    onActiveChange?.(liveReviews[i].id);
  }
  const go = (delta) => goTo(index + delta, delta);

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
                {count > 1
                  ? `${count} reuniões · ${total} tarefa${total === 1 ? "" : "s"}. Deslize entre elas, toque para editar ou dispense.`
                  : `${total} tarefa${total === 1 ? "" : "s"} criada${total === 1 ? "" : "s"} a partir das anotações. Toque para editar ou dispense as que não quiser.`}
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

        {/* Carousel nav (only when there's more than one meeting) */}
        {count > 1 && (
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-4 py-2.5">
            <button
              onClick={() => go(-1)}
              disabled={index === 0}
              title="Reunião anterior"
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                {liveReviews.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => goTo(i, i > index ? 1 : -1)}
                    title={r.project}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-4 bg-action" : "w-1.5 bg-ink/20 hover:bg-ink/40"
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-stone-400">
                {index + 1}/{count}
              </span>
            </div>

            <button
              onClick={() => go(1)}
              disabled={index === count - 1}
              title="Próxima reunião"
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Body — one meeting per slide */}
        <div className="relative flex-1 overflow-hidden">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={18} />
              </span>
              <p className="text-sm font-semibold text-ink">Tudo revisado</p>
              <p className="text-xs text-stone-500">Nenhuma tarefa pendente de revisão.</p>
            </div>
          ) : (
            <AnimatePresence initial={false} mode="wait" custom={dir}>
              <motion.div
                key={current.id}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
                drag={count > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(e, info) => {
                  if (info.offset.x < -60) go(1);
                  else if (info.offset.x > 60) go(-1);
                }}
                className="h-full overflow-y-auto px-6 py-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.05] px-2 py-1 font-mono text-[11px] font-semibold text-stone-600">
                    {current.projectCreated ? <FolderPlus size={12} /> : <Folder size={12} />}
                    {current.project}
                  </span>
                  {current.projectCreated && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
                      novo projeto
                    </span>
                  )}
                  {(current.meetingTitle || current.date) && (
                    <span className="truncate font-mono text-[10px] text-stone-400">
                      {current.meetingTitle}
                      {current.date ? ` · ${fmtDate(current.date)}` : ""}
                    </span>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {current.tasks.map((card) => {
                    const assignees = card.assignees?.length
                      ? card.assignees
                      : card.assignee
                        ? [card.assignee]
                        : [];
                    return (
                      <li
                        key={card.id}
                        className="group flex items-center gap-2 rounded-lg surface-3 py-1.5 pl-3 pr-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => onEditTask?.(card)}
                          title="Editar tarefa"
                          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                        >
                          <Pencil
                            size={12}
                            className="shrink-0 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">
                            {card.title}
                          </span>
                          {assignees.length > 0 ? (
                            <span className="flex shrink-0 -space-x-1.5">
                              {assignees.map((name) => (
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
                        </button>
                        <button
                          type="button"
                          onClick={() => onDismissTask?.(card.id)}
                          title="Dispensar (remover do quadro)"
                          className="shrink-0 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </AnimatePresence>
          )}
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
