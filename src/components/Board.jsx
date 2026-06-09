import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, Trash2, CornerDownLeft } from "lucide-react";
import { COLUMNS, today, fmtDate } from "@/lib/constants";
import { Avatar, PriorityBadge } from "@/components/ui";

// ── Card ────────────────────────────────────────────────────────────────────
function Card({ card, client, onEdit, onDelete, onDragStart, onDragEnd, dragging }) {
  const overdue = card.dueDate && card.dueDate < today() && card.columnId !== "done";

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
        className="absolute right-2 top-2 rounded-md p-1 text-zinc-600 opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        title="Excluir"
      >
        <Trash2 size={12} />
      </button>

      {card.labelColor && (
        <div className="mb-3 h-1 w-10 rounded-full" style={{ background: card.labelColor }} />
      )}

      <p className="mb-2 pr-5 text-sm font-semibold leading-snug text-white">{card.title}</p>
      {card.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-500">
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
        <PriorityBadge priority={card.priority} />
        <div className="flex items-center gap-2">
          {card.dueDate && (
            <span
              className={`flex items-center gap-1 font-mono text-[10px] font-semibold ${
                overdue ? "text-danger" : "text-zinc-500"
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
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-action/40 hover:text-action"
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
        className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[10px] text-zinc-600">
          <CornerDownLeft size={10} className="inline" /> criar
        </span>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
          className="rounded-md bg-action px-2.5 py-1 text-[11px] font-bold text-ink-base"
        >
          Criar
        </button>
      </div>
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
  draggingId,
  ...handlers
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-300">
            {col.title}
          </span>
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-500 tnum">
            {cards.length}
          </span>
        </div>
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
            : "border-white/[0.04] bg-white/[0.015]"
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
          <div className="flex h-16 items-center justify-center font-mono text-[11px] text-zinc-700">
            arraste cards aqui
          </div>
        )}

        <QuickAdd columnId={col.id} onAdd={onQuickAdd} />
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function Board({
  cards,
  clients,
  onEdit,
  onDelete,
  onQuickAdd,
  onMove,
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  function handleDrop(targetColId) {
    if (!draggingId) return;
    const card = cards.find((c) => c.id === draggingId);
    if (card && card.columnId !== targetColId) onMove(draggingId, targetColId);
    setDraggingId(null);
  }

  return (
    <div className="flex flex-1 gap-5 overflow-x-auto pb-4" style={{ minHeight: 0 }}>
      {COLUMNS.map((col) => (
        <Column
          key={col.id}
          col={col}
          cards={cards.filter((c) => c.columnId === col.id)}
          clients={clients}
          isOver={overCol === col.id}
          setOver={setOverCol}
          onDrop={handleDrop}
          onQuickAdd={onQuickAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
          draggingId={draggingId}
        />
      ))}
    </div>
  );
}
