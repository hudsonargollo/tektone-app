import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Plus, Square, CheckSquare, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const todayLabel = () => {
  const d = new Date();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

function Row({ item, onToggle, onEdit, onRemove }) {
  const [text, setText] = useState(item.text);
  useEffect(() => setText(item.text), [item.text]);

  return (
    <div className="group/item flex items-start gap-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={`mt-0.5 shrink-0 transition-colors ${
          item.done ? "text-success" : "text-stone-400 hover:text-ink"
        }`}
      >
        {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
      </button>
      <textarea
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const t = text.trim();
          if (t && t !== item.text) onEdit(t);
          else setText(item.text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={`min-h-[22px] flex-1 resize-none overflow-hidden bg-transparent text-sm leading-snug outline-none ${
          item.done ? "text-stone-400 line-through" : "text-ink"
        }`}
        onInput={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-0.5 shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/item:opacity-100"
        title="Remover"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export default function PersonalTodoPanel({ onClose }) {
  const [items, setItems] = useState(null); // null = loading
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api
      .listTodos()
      .then(({ items }) => setItems(items))
      .catch(() => setError("Não foi possível carregar suas tarefas."));
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = (items ?? []).filter((i) => i.done).length;
  const pct = items?.length ? Math.round((done / items.length) * 100) : 0;

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      const { item } = await api.createTodo(t);
      setItems((p) => [...(p ?? []), item]);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    }
  }

  async function toggle(item) {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await api.updateTodo(item.id, { done: !item.done });
    } catch {
      setItems((p) => p.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
    }
  }

  async function edit(item, nextText) {
    setItems((p) => p.map((i) => (i.id === item.id ? { ...i, text: nextText } : i)));
    api.updateTodo(item.id, { text: nextText }).catch(() => {});
  }

  async function remove(item) {
    setItems((p) => p.filter((i) => i.id !== item.id));
    api.deleteTodo(item.id).catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-clay shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-ink/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Minhas tarefas</h2>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-stone-500">
              <Lock size={10} /> {todayLabel()} · só você vê isto
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-ink/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <Plus size={15} className="shrink-0 text-stone-400" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Adicionar tarefa do dia…"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
            />
          </div>
          {items?.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="font-mono text-[11px] font-semibold text-stone-500 tnum">
                {done}/{items.length}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {items === null ? (
            <div className="flex items-center gap-2 py-6 text-stone-500">
              <Spinner /> <span className="font-mono text-xs">carregando…</span>
            </div>
          ) : error ? (
            <p className="py-6 text-sm text-danger">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">
              Nada por aqui ainda. Adicione o que precisa fazer hoje.
            </p>
          ) : (
            <div className="divide-y divide-ink/[0.06]">
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={() => toggle(item)}
                  onEdit={(t) => edit(item, t)}
                  onRemove={() => remove(item)}
                />
              ))}
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  );
}
