import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
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
import { hashColor } from "@/lib/constants";

// Hero day/month split for the oversized date numeral.
function dateParts(d) {
  if (!d) return null;
  try {
    const dt = new Date(d + "T12:00:00");
    return {
      day: dt.toLocaleDateString("pt-BR", { day: "2-digit" }),
      month: dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  } catch {
    return null;
  }
}

// Carousel item width as a fraction of the viewport — leaves a coverflow
// peek of the neighboring meeting cards on either side.
const PEEK_RATIO = 0.86;

export default function ReviewPopup({
  reviews,
  cards,
  avatarByName,
  activeId,
  onActiveChange,
  onClose,
  onAck,
  onAckOne,
  onEditTask,
  onDismissTask,
}) {
  const [busy, setBusy] = useState(false);
  const viewportRef = useRef(null);
  const [w, setW] = useState(0); // measured viewport width → px-based track animation

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

  // Keep the slide width in sync so the filmstrip slides exactly one panel.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  const itemWidth = w * PEEK_RATIO;
  const centerOffset = (w - itemWidth) / 2;

  function goTo(i) {
    if (i < 0 || i >= count || i === index) return;
    onActiveChange?.(liveReviews[i].id);
  }
  const go = (delta) => goTo(index + delta);

  async function ackAll() {
    setBusy(true);
    try {
      await onAck(reviews.map((r) => r.id));
    } finally {
      setBusy(false);
    }
  }

  async function ackThis() {
    if (count <= 1 || !current) return ackAll(); // single meeting → same as "all"
    setBusy(true);
    try {
      await onAckOne?.(current.id);
    } finally {
      setBusy(false);
    }
  }

  function renderSlide(r) {
    const accent = hashColor(r.project);
    const dp = dateParts(r.date);
    return (
      <>
        <div className="mb-4 flex items-start gap-4">
          {dp && (
            <div
              className="flex shrink-0 flex-col items-center border-b-2 pb-1.5"
              style={{ borderColor: accent }}
            >
              <span className="serif text-4xl font-bold leading-none text-ink">{dp.day}</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-stone-500">
                {dp.month}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate text-lg font-bold text-ink">{r.project}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold"
                style={{ background: `${accent}22`, color: accent }}
              >
                {r.projectCreated ? <FolderPlus size={11} /> : <Folder size={11} />}
                {r.projectCreated ? "novo projeto" : "projeto"}
              </span>
              {r.meetingTitle && (
                <span className="truncate font-mono text-[10px] text-stone-400">
                  {r.meetingTitle}
                </span>
              )}
            </div>
          </div>
        </div>

        <ul className="space-y-1.5">
          {r.tasks.map((card) => {
            const assignees = card.assignees?.length
              ? card.assignees
              : card.assignee
                ? [card.assignee]
                : [];
            return (
              <li
                key={card.id}
                className="group flex items-center gap-2 rounded-lg surface-3 py-1.5 pl-3 pr-1.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
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
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{card.title}</span>
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
      </>
    );
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
        className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl surface-2 shadow-[0_24px_70px_-16px_rgba(20,22,24,0.4)]"
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
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => go(-1)}
              disabled={index === 0}
              title="Reunião anterior"
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={18} />
            </motion.button>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                {liveReviews.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => goTo(i)}
                    title={r.project}
                    className="relative flex h-4 w-5 items-center justify-center"
                  >
                    {i === index ? (
                      <motion.span
                        layoutId="review-dot"
                        className="h-1.5 w-4 rounded-full"
                        style={{ background: hashColor(r.project) }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-ink/20 transition-colors hover:bg-ink/40" />
                    )}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] text-stone-400">
                {index + 1}/{count}
              </span>
            </div>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => go(1)}
              disabled={index === count - 1}
              title="Próxima reunião"
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight size={18} />
            </motion.button>
          </div>
        )}

        {/* Body — filmstrip: one meeting per slide */}
        {total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
              <Check size={18} />
            </span>
            <p className="text-sm font-semibold text-ink">Tudo revisado</p>
            <p className="text-xs text-stone-500">Nenhuma tarefa pendente de revisão.</p>
          </div>
        ) : count > 1 ? (
          <div
            ref={viewportRef}
            className="relative h-[min(58vh,26rem)] overflow-hidden surface-1"
          >
            {w > 0 && (
              <motion.div
                className="absolute inset-y-0 left-0 flex items-stretch py-3"
                style={{ width: count * itemWidth }}
                animate={{ x: centerOffset - index * itemWidth }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(e, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -400) go(1);
                  else if (info.offset.x > 60 || info.velocity.x > 400) go(-1);
                }}
              >
                {liveReviews.map((r, i) => {
                  const isActive = i === index;
                  return (
                    <div key={r.id} style={{ width: itemWidth }} className="shrink-0 px-2">
                      <motion.div
                        animate={{ scale: isActive ? 1 : 0.94, opacity: isActive ? 1 : 0.45 }}
                        transition={{ type: "spring", stiffness: 320, damping: 34 }}
                        className={`h-full overflow-y-auto rounded-xl border border-ink/10 bg-paper px-4 py-5 shadow-[0_10px_30px_-8px_rgba(20,22,24,0.28)] ${
                          isActive ? "" : "pointer-events-none"
                        }`}
                      >
                        {renderSlide(r)}
                      </motion.div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="max-h-[60vh] flex-1 overflow-y-auto px-6 py-5">{renderSlide(current)}</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink"
          >
            Depois
          </button>
          <div className="flex items-center gap-1.5">
            {count > 1 && (
              <button
                onClick={ackAll}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink disabled:opacity-50"
              >
                Validar todas
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={ackThis}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action disabled:opacity-50"
            >
              {busy ? <Spinner /> : <Check size={14} />}{" "}
              {count > 1 ? "Validar esta" : "Validar e dispensar"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
