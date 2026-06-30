import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Trash2,
  CornerDownLeft,
  ChevronsRightLeft,
  ChevronsLeftRight,
  CheckSquare,
  Link2,
  Sparkles,
  MessageSquare,
  Package,
} from "lucide-react";
import { COLUMNS, PRIORITY, today, fmtDate } from "@/lib/constants";
import { Avatar, PriorityBadge } from "@/components/ui";

const COLLAPSE_KEY = "tk_collapsed_cols";

// ── Card ────────────────────────────────────────────────────────────────────
function Card({ card, client, avatarByName, onEdit, onDelete, onDragStart, onDragEnd, dragging }) {
  const overdue = card.dueDate && card.dueDate < today() && card.columnId !== "done";
  const assignees = card.assignees?.length ? card.assignees : card.assignee ? [card.assignee] : [];
  const checklist = card.checklist ?? [];
  const checkTotal = checklist.length;
  const checkDone = checklist.filter((i) => i.done).length;
  const allDone = checkTotal > 0 && checkDone === checkTotal;
  const linkCount = (card.links ?? []).length;
  const comments = card.comments ?? [];
  const openRequests = comments.filter((c) => c.kind === "request" && !c.resolvedAt).length;

  // Left accent strip — client colour first, falling back to priority, for fast scanning.
  const accent = client?.color || (PRIORITY[card.priority] ?? PRIORITY.low).color;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dragging ? 0.4 : 1, y: 0, scale: dragging ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={dragging ? undefined : { y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(card)}
      className="group relative cursor-pointer overflow-hidden rounded-xl surface-2 pl-4 pr-3.5 py-3.5 shadow-sm transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(20,22,24,0.10)]"
    >
      <span
        className="absolute inset-y-0 left-0 w-1 transition-all duration-200 group-hover:w-1.5"
        style={{ background: accent, opacity: 0.6 }}
        aria-hidden
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        className="absolute right-2 top-2 rounded-md p-1 text-stone-400 opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        title="Excluir"
      >
        <Trash2 size={12} />
      </button>

      {card.labelColor && (
        <div className="mb-3 h-1 w-10 rounded-full" style={{ background: card.labelColor }} />
      )}

      {card.source?.startsWith("meeting") && (
        <span
          className="mb-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider"
          style={{ background: "rgba(122,90,110,0.14)", color: "#7A5A6E" }}
          title="Criada a partir de anotações de reunião"
        >
          <Sparkles size={9} /> reunião
        </span>
      )}

      <p className="mb-2 pr-5 text-sm font-semibold leading-snug text-ink">{card.title}</p>
      {card.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-stone-500">
          {card.description}
        </p>
      )}

      {client && (
        <span
          className="mb-2.5 inline-block rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold"
          style={{ background: client.color + "1f", color: client.color }}
        >
          {client.name}
        </span>
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={card.priority} />
          {checkTotal > 0 && (
            <span
              className={`flex items-center gap-1 font-mono text-[10px] font-semibold tnum ${
                allDone ? "text-success" : "text-stone-500"
              }`}
              title={`${checkDone} de ${checkTotal} concluído(s)`}
            >
              <CheckSquare size={11} /> {checkDone}/{checkTotal}
            </span>
          )}
          {linkCount > 0 && (
            <span
              className="flex items-center gap-1 font-mono text-[10px] font-semibold text-stone-500"
              title={`${linkCount} link(s)`}
            >
              <Link2 size={11} /> {linkCount}
            </span>
          )}
          {comments.length > 0 && (
            <span
              className="flex items-center gap-1 font-mono text-[10px] font-semibold text-stone-500"
              title={`${comments.length} comentário(s)`}
            >
              <MessageSquare size={11} /> {comments.length}
            </span>
          )}
          {openRequests > 0 && (
            <span
              className="flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] font-semibold text-warning"
              style={{ background: "rgba(184,134,47,0.14)" }}
              title={`${openRequests} solicitação(ões) em aberto`}
            >
              <Package size={11} /> {openRequests}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {card.dueDate && (
            <span
              className={`flex items-center gap-1 font-mono text-[10px] font-semibold ${
                overdue ? "text-danger" : "text-stone-500"
              }`}
            >
              <Calendar size={10} />
              {fmtDate(card.dueDate)}
            </span>
          )}
          {assignees.length > 0 && (
            <span className="flex -space-x-1.5">
              {assignees.slice(0, 3).map((n) => (
                <Avatar key={n} name={n} src={avatarByName?.[n?.trim().toLowerCase()]} />
              ))}
              {assignees.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/10 text-[9px] font-bold text-stone-600 ring-1 ring-ink/10">
                  +{assignees.length - 3}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Inline composer ──────────────────────────────────────────────────────────
function QuickAdd({ columnId, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  function submit() {
    const t = title.trim();
    if (!t) return setOpen(false);
    onAdd(columnId, t);
    setTitle("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-ink/15 px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-action/40 hover:text-action"
      >
        <Plus size={13} /> Adicionar tarefa
      </button>
    );
  }

  return (
    <div className="rounded-lg surface-2 p-2">
      <textarea
        autoFocus
        rows={2}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={submit}
        placeholder="Título da tarefa…"
        className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[10px] text-stone-400">
          <CornerDownLeft size={10} className="inline" /> criar
        </span>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="rounded-md bg-action px-2.5 py-1 text-[11px] font-bold text-clay"
        >
          Criar
        </button>
      </div>
    </div>
  );
}

// ── Collapsed rail (docked column) ────────────────────────────────────────────
function CollapsedColumn({ col, cards, isOver, setOver, onDrop, onExpand }) {
  const overdue = cards.filter(
    (c) => col.id !== "done" && c.dueDate && c.dueDate < today()
  ).length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onExpand()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(col.id);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setOver(null);
      }}
      onDrop={() => {
        onDrop(col.id);
        setOver(null);
      }}
      title={`Expandir ${col.title}`}
      className={`group flex min-h-0 w-12 shrink-0 cursor-pointer flex-col items-center gap-3 overflow-hidden rounded-2xl border py-3 transition-colors ${
        isOver ? "border-action/50 bg-action/[0.06]" : "surface-1 hover:border-action/30"
      }`}
    >
      <ChevronsLeftRight
        size={14}
        className="text-stone-400 transition-colors group-hover:text-action"
      />
      <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />

      {/* Notification badge */}
      <span
        className={`min-w-5 rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] font-bold tnum ${
          overdue > 0 ? "bg-danger text-clay" : "bg-ink/10 text-stone-600"
        }`}
        title={overdue > 0 ? `${overdue} atrasada(s)` : `${cards.length} card(s)`}
      >
        {cards.length}
      </span>
      {overdue > 0 && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
      )}

      {/* Vertical title fills the rest */}
      <span
        className="flex flex-1 items-center justify-center font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500"
        style={{ writingMode: "vertical-rl" }}
      >
        {col.title}
      </span>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────────────────
function Column({
  col,
  cards,
  clients,
  avatarByName,
  isOver,
  setOver,
  onDrop,
  onQuickAdd,
  onCollapse,
  draggingId,
  ...handlers
}) {
  return (
    <div className="flex min-h-0 min-w-[15rem] flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-600">
            {col.title}
          </span>
          <span className="rounded-full bg-ink/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-stone-500 tnum">
            {cards.length}
          </span>
        </div>
        <button
          onClick={onCollapse}
          title={`Minimizar ${col.title}`}
          className="rounded-md p-1 text-stone-400 transition-colors hover:bg-ink/[0.05] hover:text-action"
        >
          <ChevronsRightLeft size={13} />
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(col.id);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setOver(null);
        }}
        onDrop={() => {
          onDrop(col.id);
          setOver(null);
        }}
        className={`min-h-0 flex-1 space-y-2.5 overflow-y-auto rounded-2xl border p-2 transition-colors ${
          isOver
            ? "border-action/40 bg-action/[0.04]"
            : "border-ink/[0.06] bg-ink/[0.025]"
        }`}
      >
        <AnimatePresence initial={false}>
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              client={clients.find((c) => c.id === card.clientId)}
              avatarByName={avatarByName}
              dragging={draggingId === card.id}
              {...handlers}
            />
          ))}
        </AnimatePresence>

        {cards.length === 0 && (
          <div className="flex h-16 items-center justify-center font-mono text-[11px] text-stone-300">
            arraste cards aqui
          </div>
        )}

        <QuickAdd columnId={col.id} onAdd={onQuickAdd} />
      </div>
    </div>
  );
}

// ── Mobile board (one column at a time, swipe to switch) ──────────────────────
const slideVariants = {
  enter: (d) => ({ opacity: 0, x: d > 0 ? 36 : -36 }),
  center: { opacity: 1, x: 0 },
  exit: (d) => ({ opacity: 0, x: d > 0 ? -36 : 36 }),
};

function MobileBoard({ cards, clients, avatarByName, flat, onEdit, onDelete, onQuickAdd }) {
  const [index, setIndex] = useState(() => Math.max(0, COLUMNS.findIndex((c) => c.id === "todo")));
  const [dir, setDir] = useState(0);
  const touch = useRef(null);
  const noop = () => {};

  const col = COLUMNS[index];
  const colCards = cards.filter((c) => c.columnId === col.id);

  // Flat mode (e.g. Solicitações): every matching card across all columns, one list.
  if (flat) {
    return (
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <p className="mb-2 px-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-warning">
          Solicitações · {cards.length}
        </p>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-0.5 pb-28">
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              client={clients.find((c) => c.id === card.clientId)}
              avatarByName={avatarByName}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={noop}
              onDragEnd={noop}
              dragging={false}
            />
          ))}
          {cards.length === 0 && (
            <div className="flex h-24 items-center justify-center font-mono text-[11px] text-stone-300">
              nenhuma solicitação em aberto
            </div>
          )}
        </div>
      </div>
    );
  }

  const go = (step) =>
    setIndex((i) => {
      const ni = Math.max(0, Math.min(COLUMNS.length - 1, i + step));
      if (ni !== i) setDir(step);
      return ni;
    });
  const jump = (i) => {
    setDir(i > index ? 1 : -1);
    setIndex(i);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
      {/* Column tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((c, i) => {
          const n = cards.filter((x) => x.columnId === c.id).length;
          const overdue = cards.filter(
            (x) => x.columnId === c.id && c.id !== "done" && x.dueDate && x.dueDate < today()
          ).length;
          const isActive = i === index;
          return (
            <button
              key={c.id}
              onClick={() => jump(i)}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive ? "border-transparent bg-ink text-clay" : "border-ink/15 text-stone-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.title}
              <span
                className={`rounded-full px-1.5 py-px font-mono text-[10px] font-bold tnum ${
                  overdue > 0
                    ? "bg-danger text-clay"
                    : isActive
                      ? "bg-clay/20 text-clay/80"
                      : "bg-ink/10 text-stone-500"
                }`}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active column — swipe left/right to switch */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onTouchStart={(e) =>
          (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })
        }
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
          touch.current = null;
        }}
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={col.id}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.18 }}
            className="absolute inset-0 space-y-2.5 overflow-y-auto px-0.5 pb-28"
          >
            {colCards.map((card) => (
              <Card
                key={card.id}
                card={card}
                client={clients.find((c) => c.id === card.clientId)}
                avatarByName={avatarByName}
                onEdit={onEdit}
                onDelete={onDelete}
                onDragStart={noop}
                onDragEnd={noop}
                dragging={false}
              />
            ))}
            {colCards.length === 0 && (
              <div className="flex h-20 items-center justify-center font-mono text-[11px] text-stone-300">
                nenhum card aqui
              </div>
            )}
            <QuickAdd columnId={col.id} onAdd={onQuickAdd} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function Board({ cards, clients, avatarByName, requestsOnly, onEdit, onDelete, onQuickAdd, onMove }) {
  const [draggingId, setDraggingId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [collapsed, setCollapsed] = useState(() => {
    // Default: dock Backlog + Concluído so all columns fit one desktop view.
    // A saved preference (even an empty one) always wins.
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      if (stored === null) return new Set(["backlog", "done"]);
      return new Set(JSON.parse(stored));
    } catch {
      return new Set(["backlog", "done"]);
    }
  });

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function handleDrop(targetColId) {
    if (!draggingId) return;
    const card = cards.find((c) => c.id === draggingId);
    if (card && card.columnId !== targetColId) onMove(draggingId, targetColId);
    setDraggingId(null);
  }

  return (
    <>
      {/* Desktop — multi-column with collapse rails */}
      <div
        className="hidden flex-1 gap-4 overflow-x-auto pb-4 lg:flex"
        style={{ minHeight: 0 }}
      >
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.columnId === col.id);
          return collapsed.has(col.id) ? (
            <CollapsedColumn
              key={col.id}
              col={col}
              cards={colCards}
              isOver={overCol === col.id}
              setOver={setOverCol}
              onDrop={handleDrop}
              onExpand={() => toggleCollapse(col.id)}
            />
          ) : (
            <Column
              key={col.id}
              col={col}
              cards={colCards}
              clients={clients}
              avatarByName={avatarByName}
              isOver={overCol === col.id}
              setOver={setOverCol}
              onDrop={handleDrop}
              onQuickAdd={onQuickAdd}
              onCollapse={() => toggleCollapse(col.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              draggingId={draggingId}
            />
          );
        })}
      </div>

      {/* Mobile — tabbed single column */}
      <MobileBoard
        cards={cards}
        clients={clients}
        avatarByName={avatarByName}
        flat={requestsOnly}
        onEdit={onEdit}
        onDelete={onDelete}
        onQuickAdd={onQuickAdd}
      />
    </>
  );
}
