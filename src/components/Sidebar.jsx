import { useState } from "react";
import { LayoutGrid, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { PARTNER_COLORS } from "@/lib/constants";

export default function Sidebar({ clients, activeId, counts, onSelect, onAdd, onRename, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PARTNER_COLORS[0]);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  function submitAdd() {
    const n = name.trim();
    if (!n) return setAdding(false);
    onAdd(n, color);
    setName("");
    setAdding(false);
  }
  function submitRename(id) {
    const n = renameVal.trim();
    if (n) onRename(id, n);
    setRenaming(null);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink/10 pr-4">
      <p className="mb-3 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-stone-500">
        Projetos
      </p>

      <button
        onClick={() => onSelect(null)}
        className={`mb-1 flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          !activeId ? "bg-action text-clay" : "text-stone-600 hover:bg-ink/[0.05]"
        }`}
      >
        <span className="flex items-center gap-2.5">
          <LayoutGrid size={14} /> Todos
        </span>
        <span className={`font-mono text-[11px] tnum ${!activeId ? "text-clay/70" : "text-stone-500"}`}>
          {total}
        </span>
      </button>

      <div className="flex flex-col gap-0.5">
        {clients.map((c) => {
          const active = activeId === c.id;
          if (renaming === c.id) {
            return (
              <div key={c.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(c.id);
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="flex-1 rounded-lg border border-action/40 bg-ink/[0.03] px-2 py-1.5 text-xs text-ink outline-none focus:border-action"
                />
                <button onClick={() => submitRename(c.id)} className="p-1 text-success">
                  <Check size={12} />
                </button>
                <button onClick={() => setRenaming(null)} className="p-1 text-stone-500">
                  <X size={12} />
                </button>
              </div>
            );
          }
          return (
            <div
              key={c.id}
              className={`group flex items-center rounded-xl transition-colors ${
                active ? "" : "hover:bg-ink/[0.05]"
              }`}
              style={active ? { background: c.color + "22" } : {}}
            >
              <button
                onClick={() => onSelect(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold"
                style={{ color: active ? "#141618" : "#57534e" }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[11px] tnum text-stone-500">{counts[c.id] ?? 0}</span>
              </button>
              <div className="flex items-center gap-0.5 pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => {
                    setRenaming(c.id);
                    setRenameVal(c.name);
                  }}
                  className="rounded p-1 text-stone-500 hover:text-ink"
                  title="Renomear"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir "${c.name}" e todos os seus cards?`)) onDelete(c.id);
                  }}
                  className="rounded p-1 text-stone-500 hover:text-danger"
                  title="Excluir"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-2 space-y-2 px-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nome do projeto"
            className="w-full rounded-lg border border-action/40 bg-ink/[0.03] px-2 py-1.5 text-xs text-ink outline-none focus:border-action"
          />
          <div className="flex flex-wrap gap-1.5">
            {PARTNER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-clay" : ""
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={submitAdd}
              className="flex-1 rounded-lg bg-action py-1.5 text-xs font-bold text-clay"
            >
              Adicionar
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg px-2 text-xs text-stone-500 hover:bg-ink/[0.05]"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-action"
        >
          <Plus size={13} /> Novo projeto
        </button>
      )}
    </aside>
  );
}
