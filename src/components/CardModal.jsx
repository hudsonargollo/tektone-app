import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Check } from "lucide-react";
import { COLUMNS, PRIORITY, LABEL_COLORS } from "@/lib/constants";

const labelCls =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500";
const inputCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action";

export default function CardModal({ card, clients, members, onSave, onDelete, onClose }) {
  const [d, setD] = useState({ ...card });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        onSave(d);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d, onClose, onSave]);

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
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
          <span className="label-tech">Editar card</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (window.confirm("Excluir este card?")) {
                  onDelete(card.id);
                  onClose();
                }
              }}
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-danger/10 hover:text-danger"
              title="Excluir"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className={labelCls}>Título</label>
            <input
              autoFocus
              value={d.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              className={`${inputCls} font-semibold`}
            />
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <textarea
              rows={3}
              value={d.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Detalhes da tarefa…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Coluna</label>
              <select
                value={d.columnId}
                onChange={(e) => set("columnId", e.target.value)}
                className={inputCls}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id} className="bg-paper">
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Prioridade</label>
              <select
                value={d.priority}
                onChange={(e) => set("priority", e.target.value)}
                className={inputCls}
              >
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k} className="bg-paper">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Projeto</label>
              <select
                value={d.clientId ?? ""}
                onChange={(e) => set("clientId", e.target.value)}
                className={inputCls}
              >
                <option value="" className="bg-paper">— Nenhum —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-paper">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Responsável</label>
              <select
                value={d.assignee ?? ""}
                onChange={(e) => set("assignee", e.target.value)}
                className={inputCls}
              >
                <option value="" className="bg-paper">— Nenhum —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.name} className="bg-paper">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Prazo</label>
            <input
              type="date"
              value={d.dueDate ?? ""}
              onChange={(e) => set("dueDate", e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Etiqueta</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => set("labelColor", null)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  !d.labelColor ? "border-zinc-400" : "border-ink/20"
                }`}
              >
                <X size={10} className="text-stone-500" />
              </button>
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set("labelColor", c)}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    d.labelColor === c ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-clay" : ""
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-ink/15 px-6 py-4">
          <span className="font-mono text-[10px] tracking-wide text-stone-400">
            ⌘+↵ salvar · esc fechar
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-stone-500 transition-colors hover:text-ink"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onSave(d);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-action px-5 py-2 text-sm font-bold text-clay transition-all hover:brightness-110 ring-action"
            >
              <Check size={14} /> Salvar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
