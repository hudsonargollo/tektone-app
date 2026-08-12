import { useEffect, useRef, useState } from "react";
import { X, Plus, Square, CheckSquare, Lock, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
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
const RECURRENCE_LABEL = { daily: "todo dia", weekdays: "dias úteis", weekly: "toda semana" };

const isoOf = (d) => d.toISOString().slice(0, 10);
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const dayLabel = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};

function Row({ item, onToggle, onEdit, onRemove }) {
  const [text, setText] = useState(item.text);
  const [confirming, setConfirming] = useState(false);
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
      {item.recurrence && (
        <span
          title={`Repete: ${RECURRENCE_LABEL[item.recurrence] || item.recurrence}`}
          className="mt-0.5 shrink-0 text-stone-400"
        >
          <Repeat size={12} />
        </span>
      )}
      {confirming ? (
        <div className="mt-0.5 flex shrink-0 items-center gap-1 font-mono text-[10px]">
          <button type="button" onClick={() => onRemove(false)} className="rounded px-1.5 py-0.5 text-stone-500 hover:bg-ink/[0.06] hover:text-ink">
            só hoje
          </button>
          <button type="button" onClick={() => onRemove(true)} className="rounded px-1.5 py-0.5 text-danger hover:bg-danger/10">
            série toda
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded px-1 py-0.5 text-stone-400 hover:text-ink">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (item.recurrence ? setConfirming(true) : onRemove(false))}
          className="mt-0.5 shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/item:opacity-100"
          title="Remover"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export default function PersonalTodoPanel() {
  const [viewDate, setViewDate] = useState(todayISO());
  const [items, setItems] = useState(null); // null = loading
  const [text, setText] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function load(date) {
    setItems(null);
    api
      .listTodos(date)
      .then(({ items }) => setItems(items))
      .catch(() => setError("Não foi possível carregar suas tarefas."));
  }

  useEffect(() => {
    load(viewDate);
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

  const done = (items ?? []).filter((i) => i.done).length;
  const pct = items?.length ? Math.round((done / items.length) * 100) : 0;
  const isToday = viewDate === todayISO();

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    const usedRecurrence = recurrence;
    setRecurrence("");
    try {
      const { item } = await api.createTodo(t, viewDate, usedRecurrence || undefined);
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

  async function remove(item, series) {
    setItems((p) => p.filter((i) => i.id !== item.id));
    api.deleteTodo(item.id, series).catch(() => {});
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="border-b border-ink/10 px-5 py-4">
        <h2 className="text-lg font-bold text-ink">Minhas tarefas</h2>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewDate((d) => addDays(d, -1))}
              className="rounded p-1 text-stone-400 hover:bg-ink/[0.06] hover:text-ink"
              title="Dia anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-[11px] tracking-wide text-stone-500">
              {dayLabel(viewDate)}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addDays(d, 1))}
              className="rounded p-1 text-stone-400 hover:bg-ink/[0.06] hover:text-ink"
              title="Próximo dia"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setViewDate(todayISO())}
              className="rounded-md bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] font-semibold text-ink transition-colors hover:bg-ink/[0.1]"
            >
              hoje
            </button>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-stone-400">
          <Lock size={9} /> só você vê isto
        </p>
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
              placeholder={isToday ? "Adicionar tarefa do dia…" : `Adicionar tarefa para ${dayLabel(viewDate).split(",")[0]}…`}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
            />
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              title="Repetir"
              className="shrink-0 rounded-md border border-ink/10 bg-transparent px-1.5 py-1 font-mono text-[10px] text-stone-500 outline-none"
            >
              <option value="">não repete</option>
              <option value="daily">todo dia</option>
              <option value="weekdays">dias úteis</option>
              <option value="weekly">toda semana</option>
            </select>
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
              {isToday ? "Nada por aqui ainda. Adicione o que precisa fazer hoje." : "Nada agendado para este dia."}
            </p>
          ) : (
            <div className="divide-y divide-ink/[0.06]">
              {items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  onToggle={() => toggle(item)}
                  onEdit={(t) => edit(item, t)}
                  onRemove={(series) => remove(item, series)}
                />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
