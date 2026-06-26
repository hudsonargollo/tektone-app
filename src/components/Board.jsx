import { useState } from "react";
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
} from "lucide-react";
import { COLUMNS, today, fmtDate } from "@/lib/constants";
import { Avatar, PriorityBadge } from "@/components/ui";

const COLLAPSE_KEY = "tk_collapsed_cols";

// ── Card ────────────────────────────────────────────────────────────────────
function Card({ card, client, onEdit, onDelete, onDragStart, onDragEnd, dragging }) {
  const overdue = card.dueDate && card.dueDate < today() && card.columnId !== "done";
  const checklist = card.checklist ?? [];
  const checkTotal = checklist.length;
  const checkDone = checklist.filter((i) => i.done).length;
  const allDone = checkTotal > 0 && checkDone === checkTotal;
  const linkCount = (card.links ?? []).length;

  return (
    <motion.div
      layout
      layoutId={card.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dragging ? 0.4 : 1, y: 0, scale: dragging ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card.id);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(card)}
      className="group relative cursor-pointer rounded-xl surface-2 p-3.5 transition-colors hover:border-action/30"
    >
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
          {card.assignee && <Avatar name={card.assignee} />}
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
      className={`group flex w-12 shrink-0 cursor-pointer flex-col items-center gap-3 rounded-2xl border py-3 transition-colors ${
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
  isOver,
  setOver,
  onDrop,
  onQuickAdd,
  onCollapse,
  draggingId,
  ...handlers
}) {
  return (
    <div className="flex min-w-[15rem] flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
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
        className={`flex-1 space-y-2.5 rounded-2xl border p-2 transition-colors ${
          isOver
            ? "border-action/40 bg-action/[0.04]"
            : "border-ink/[0.06] bg-ink/[0.025]"
        }`}
        style={{ minHeight: 120 }}
      >
        <AnimatePresence mode="popLayout">
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              client={clients.find((c) => c.id === card.clientId)}
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

// ── Mobile board (tabbed, one column at a time) ───────────────────────────────
function MobileBoard({ cards, clients, onEdit, onDelete, onQuickAdd }) {
  const [active, setActive] = useState("todo");
  const colCards = cards.filter((c) => c.columnId === active);
  const noop = () => {};

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:hidden">
      {/* Column tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3">
        {COLUMNS.map((col) => {
          const n = cards.filter((c) => c.columnId === col.id).length;
          const overdue = cards.filter(
            (c) => c.columnId === col.id && col.id !== "done" && c.dueDate && c.dueDate < today()
          ).length;
          const isActive = active === col.id;
          return (
            <button
              key={col.id}
              onClick={() => setActive(col.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive ? "border-transparent bg-ink text-clay" : "border-ink/15 text-stone-600"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
              {col.title}
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

      {/* Active column */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pb-6">
        <AnimatePresence mode="popLayout">
          {colCards.map((card) => (
            <Card
              key={card.id}
              card={card}
              client={clients.find((c) => c.id === card.clientId)}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={noop}
              onDragEnd={noop}
              dragging={false}
            />
          ))}
        </AnimatePresence>
        {colCards.length === 0 && (
          <div className="flex h-20 items-center justify-center font-mono text-[11px] text-stone-300">
            nenhum card aqui
          </div>
        )}
        <QuickAdd columnId={active} onAdd={onQuickAdd} />
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function Board({ cards, clients, onEdit, onDelete, onQuickAdd, onMove }) {
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
        onEdit={onEdit}
        onDelete={onDelete}
        onQuickAdd={onQuickAdd}
      />
    </>
  );
}
