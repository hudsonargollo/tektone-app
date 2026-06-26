import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  Check,
  Plus,
  Square,
  CheckSquare,
  Link2,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Pencil,
  MessageSquare,
  Package,
  Send,
  CheckCircle2,
} from "lucide-react";
import { COLUMNS, PRIORITY, LABEL_COLORS } from "@/lib/constants";
import { Avatar } from "@/components/ui";
import { api } from "@/lib/api";

const labelCls =
  "mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500";
const inputCls =
  "w-full rounded-lg border border-ink/15 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-stone-400 focus:border-action";

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ── Custom dropdown (popover) ─────────────────────────────────────────────────
function Select({ value, onChange, options, placeholder = "— Nenhum —" }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left ${
          open ? "border-action" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.dot && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: current.dot }}
            />
          )}
          {current?.avatar}
          <span className={`truncate ${current ? "text-ink" : "text-stone-400"}`}>
            {current ? current.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-stone-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute z-20 mt-1.5 max-h-44 w-full overflow-y-auto rounded-lg border border-ink/10 bg-paper p-1 shadow-xl"
            >
              {options.map((o) => (
                <li key={o.value || "_none"}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-ink/[0.05] ${
                      o.value === value
                        ? "bg-ink/[0.04] font-semibold text-ink"
                        : "text-stone-600"
                    }`}
                  >
                    {o.dot && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: o.dot }}
                      />
                    )}
                    {o.avatar}
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && (
                      <Check size={14} className="shrink-0 text-action" />
                    )}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────────
function Segmented({ value, onChange, options }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors"
            style={
              active
                ? { background: o.color, borderColor: o.color, color: "#f8f3ea" }
                : { borderColor: "rgba(20,22,24,0.15)", color: "#8A8579" }
            }
          >
            {!active && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: o.color }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Date picker (calendar popover) ────────────────────────────────────────────
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (dt) => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
const parseISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const selected = value ? parseISO(value) : null;
  const [view, setView] = useState(selected ?? new Date());
  const todayISO = toISO(new Date());

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const open_ = () => {
    if (open) return setOpen(false);
    if (selected) setView(selected);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const calW = 256;
      const calH = 332;
      const below = r.bottom + calH + 8 < window.innerHeight;
      const top = below ? r.bottom + 6 : Math.max(8, r.top - calH - 6);
      const left = Math.min(r.left, window.innerWidth - calW - 8);
      setCoords({ top, left });
    }
    setOpen(true);
  };
  const shift = (n) => setView(new Date(year, month + n, 1));

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={open_}
        className={`${inputCls} flex items-center justify-between gap-2 text-left ${
          open ? "border-action" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarIcon size={14} className="shrink-0 text-stone-400" />
          <span className={`truncate ${value ? "text-ink" : "text-stone-400"}`}>
            {value
              ? parseISO(value).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "Sem prazo"}
          </span>
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded p-0.5 text-stone-400 transition-colors hover:text-danger"
            title="Limpar prazo"
          >
            <X size={13} />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && coords && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.12 }}
              style={{ position: "fixed", top: coords.top, left: coords.left }}
              className="z-[60] w-64 rounded-xl border border-ink/10 bg-paper p-3 shadow-2xl"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  className="rounded-md p-1 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono text-[12px] font-semibold text-ink">
                  {MONTHS[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={() => shift(1)}
                  className="rounded-md p-1 text-stone-500 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="text-center font-mono text-[10px] font-semibold text-stone-400"
                  >
                    {w}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const iso = toISO(new Date(year, month, d));
                  const isSel = value === iso;
                  const isToday = todayISO === iso;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onChange(iso);
                        setOpen(false);
                      }}
                      className={`flex h-8 items-center justify-center rounded-md text-[13px] transition-colors ${
                        isSel
                          ? "bg-action font-bold text-clay"
                          : isToday
                            ? "font-bold text-action ring-1 ring-action/40"
                            : "text-stone-600 hover:bg-ink/[0.06]"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange(todayISO);
                    setOpen(false);
                  }}
                  className="font-mono text-[11px] font-semibold text-action hover:underline"
                >
                  Hoje
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="font-mono text-[11px] text-stone-400 transition-colors hover:text-danger"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const genId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/-/g, "")
    .slice(0, 8);

// ── Checklist ─────────────────────────────────────────────────────────────────
function Checklist({ items, onChange }) {
  const [text, setText] = useState("");
  const list = items ?? [];
  const done = list.filter((i) => i.done).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...list, { id: genId(), text: t, done: false }]);
    setText("");
  };
  const toggle = (id) =>
    onChange(list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const edit = (id, t) =>
    onChange(list.map((i) => (i.id === id ? { ...i, text: t } : i)));
  const remove = (id) => onChange(list.filter((i) => i.id !== id));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className={`${labelCls} mb-0`}>Checklist</span>
        {list.length > 0 && (
          <span className="font-mono text-[11px] font-semibold text-stone-500 tnum">
            {done}/{list.length}
          </span>
        )}
      </div>

      {list.length > 0 && (
        <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {list.map((i) => (
          <div key={i.id} className="group/item flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggle(i.id)}
              className={`shrink-0 transition-colors ${
                i.done ? "text-success" : "text-stone-400 hover:text-ink"
              }`}
            >
              {i.done ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <input
              value={i.text}
              onChange={(e) => edit(i.id, e.target.value)}
              className={`flex-1 bg-transparent text-sm outline-none ${
                i.done ? "text-stone-400 line-through" : "text-ink"
              }`}
            />
            <button
              type="button"
              onClick={() => remove(i.id)}
              className="shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/item:opacity-100"
              title="Remover item"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <Plus size={14} className="shrink-0 text-stone-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar item…"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
        />
      </div>
    </div>
  );
}

// ── Links & references ────────────────────────────────────────────────────────
const normalizeUrl = (u) => {
  const t = u.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

function LinkRow({ item, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);

  const start = () => {
    setLabel(item.label);
    setUrl(item.url);
    setEditing(true);
  };
  const save = () => {
    const u = normalizeUrl(url);
    if (!u) return;
    onSave({ ...item, label: label.trim() || u, url: u });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-action/40 bg-ink/[0.02] p-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo (opcional)"
          className={`${inputCls} sm:w-2/5`}
        />
        <div className="flex flex-1 gap-1.5">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="https://…"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={save}
            className="shrink-0 rounded-lg bg-action px-2.5 text-clay transition-colors hover:brightness-110"
            title="Salvar"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="shrink-0 rounded-lg border border-ink/15 px-2.5 text-stone-500 transition-colors hover:text-ink"
            title="Cancelar"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/link flex items-center gap-2 rounded-lg border border-ink/10 bg-ink/[0.02] px-2.5 py-1.5">
      <Link2 size={13} className="shrink-0 text-stone-400" />
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1 text-sm text-action hover:underline"
        title={item.url}
      >
        <span className="truncate">{item.label}</span>
        <ExternalLink size={11} className="shrink-0 opacity-60" />
      </a>
      <button
        type="button"
        onClick={start}
        className="shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-action group-hover/link:opacity-100"
        title="Editar link"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/link:opacity-100"
        title="Remover link"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function Links({ items, onChange }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const list = items ?? [];

  const add = () => {
    const u = normalizeUrl(url);
    if (!u) return;
    onChange([...list, { id: genId(), label: label.trim() || u, url: u }]);
    setLabel("");
    setUrl("");
  };
  const save = (next) => onChange(list.map((i) => (i.id === next.id ? next : i)));
  const remove = (id) => onChange(list.filter((i) => i.id !== id));

  return (
    <div>
      <label className={labelCls}>Links & referências</label>

      {list.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {list.map((i) => (
            <LinkRow key={i.id} item={i} onSave={save} onRemove={remove} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Rótulo (opcional)"
          className={`${inputCls} sm:w-2/5`}
        />
        <div className="flex flex-1 gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="https://…"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={add}
            className="shrink-0 rounded-lg border border-ink/15 px-3 text-stone-600 transition-colors hover:border-action/40 hover:text-action"
            title="Adicionar link"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Multiple assignees ────────────────────────────────────────────────────────
function MultiAssignee({ members, value, onChange, avatarByName }) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];
  const toggle = (name) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} flex min-h-[42px] items-center justify-between gap-2 text-left ${
          open ? "border-action" : ""
        }`}
      >
        {selected.length === 0 ? (
          <span className="text-stone-400">— Ninguém —</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {selected.map((n) => (
              <span
                key={n}
                className="flex items-center gap-1 rounded-md bg-ink/[0.06] py-0.5 pl-0.5 pr-1.5 text-xs text-ink"
              >
                <Avatar name={n} src={avatarByName?.[n.trim().toLowerCase()]} />
                {n.split(" ")[0]}
              </span>
            ))}
          </span>
        )}
        <ChevronDown
          size={15}
          className={`shrink-0 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute z-20 mt-1.5 max-h-48 w-full overflow-y-auto rounded-lg border border-ink/10 bg-paper p-1 shadow-xl"
            >
              {members.map((m) => {
                const on = selected.includes(m.name);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => toggle(m.name)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-ink/[0.05] ${
                        on ? "font-semibold text-ink" : "text-stone-600"
                      }`}
                    >
                      <Avatar name={m.name} src={avatarByName?.[m.name?.trim().toLowerCase()]} />
                      <span className="flex-1 truncate">{m.name}</span>
                      {on && <Check size={14} className="text-action" />}
                    </button>
                  </li>
                );
              })}
              {members.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-stone-400">Nenhum membro</li>
              )}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Comments & material requests ──────────────────────────────────────────────
function relTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderWithMentions(text, firstNames) {
  return String(text)
    .split(/(@\w+)/g)
    .map((part, i) =>
      part.startsWith("@") && firstNames.has(part.slice(1).toLowerCase()) ? (
        <span key={i} className="font-semibold text-action">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
}

function Comments({ cardId, comments, members = [], currentUser, isAdmin, avatarByName, onUpdate }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState("comment");
  const [busy, setBusy] = useState(false);
  const [mentionList, setMentionList] = useState([]);
  const list = comments ?? [];
  const firstNames = new Set(members.map((m) => m.name.split(/\s+/)[0].toLowerCase()));

  const onText = (val) => {
    setText(val);
    const m = val.match(/@(\w*)$/);
    if (m) {
      const q = m[1].toLowerCase();
      setMentionList(
        members
          .filter((mm) => mm.name.toLowerCase().includes(q) || mm.name.split(/\s+/)[0].toLowerCase().startsWith(q))
          .slice(0, 5)
      );
    } else {
      setMentionList([]);
    }
  };
  const pickMention = (mm) => {
    const first = mm.name.split(/\s+/)[0];
    setText((t) => t.replace(/@(\w*)$/, `@${first} `));
    setMentionList([]);
  };

  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const { card } = await api.addComment(cardId, t, kind);
      onUpdate(card);
      setText("");
      setKind("comment");
      setMentionList([]);
    } finally {
      setBusy(false);
    }
  };
  const resolve = async (cid) => {
    const { card } = await api.resolveComment(cardId, cid);
    onUpdate(card);
  };
  const remove = async (cid) => {
    const { card } = await api.deleteComment(cardId, cid);
    onUpdate(card);
  };

  return (
    <div>
      <label className={labelCls}>Comentários & solicitações</label>

      {list.length > 0 && (
        <div className="mb-3 space-y-2">
          {list.map((c) => {
            const isReq = c.kind === "request";
            const done = Boolean(c.resolvedAt);
            const mine = currentUser?.email && c.author === currentUser.email;
            return (
              <div
                key={c.id}
                className={`group/c rounded-lg border p-2.5 ${
                  isReq
                    ? done
                      ? "border-success/30 bg-success/[0.05]"
                      : "border-warning/40 bg-warning/[0.06]"
                    : "border-ink/10 bg-ink/[0.02]"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Avatar
                    name={c.authorName}
                    src={avatarByName?.[c.authorName?.trim().toLowerCase()]}
                  />
                  <span className="text-xs font-semibold text-ink">{c.authorName}</span>
                  {isReq && (
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                        done ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}
                    >
                      <Package size={9} /> {done ? "fornecido" : "material"}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-stone-400">
                    {relTime(c.createdAt)}
                  </span>
                  {(mine || isAdmin) && (
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded p-0.5 text-stone-300 opacity-0 transition-all hover:text-danger group-hover/c:opacity-100"
                      title="Excluir"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <p className={`whitespace-pre-wrap text-sm ${done ? "text-stone-400 line-through" : "text-stone-700"}`}>
                  {renderWithMentions(c.text, firstNames)}
                </p>
                {isReq && (
                  <button
                    onClick={() => resolve(c.id)}
                    className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      done
                        ? "text-stone-500 hover:text-ink"
                        : "bg-success/15 text-success hover:bg-success/25"
                    }`}
                  >
                    <CheckCircle2 size={12} /> {done ? "Reabrir" : "Marcar como fornecido"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="relative rounded-lg border border-ink/15 bg-ink/[0.02] p-2">
        {mentionList.length > 0 && (
          <ul className="absolute bottom-full left-2 z-30 mb-1 w-52 overflow-hidden rounded-lg border border-ink/10 bg-paper shadow-xl">
            {mentionList.map((mm) => (
              <li key={mm.id}>
                <button
                  type="button"
                  onClick={() => pickMention(mm)}
                  className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-ink/[0.05]"
                >
                  <Avatar name={mm.name} src={avatarByName?.[mm.name?.trim().toLowerCase()]} />
                  <span className="truncate">{mm.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          rows={2}
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mentionList.length) {
              e.preventDefault();
              setMentionList([]);
            } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            kind === "request"
              ? "Que material você precisa? Use @ para marcar alguém…"
              : "Escreva um comentário…  (@ para marcar)"
          }
          className="w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-stone-400"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setKind((k) => (k === "request" ? "comment" : "request"))}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
              kind === "request"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-ink/15 text-stone-500 hover:text-ink"
            }`}
            title="Marcar como solicitação de material"
          >
            <Package size={12} /> {kind === "request" ? "Solicitação" : "Solicitar material"}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-[12px] font-bold text-clay transition-all hover:brightness-110 disabled:opacity-40"
          >
            <Send size={12} /> Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CardModal({
  card,
  clients,
  members,
  avatarByName,
  currentUser,
  isAdmin,
  onSave,
  onDelete,
  onClose,
  onCardUpdated,
}) {
  const [d, setD] = useState({ ...card });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const columnOpts = COLUMNS.map((c) => ({ value: c.id, label: c.title, dot: c.color }));
  const priorityOpts = Object.entries(PRIORITY).map(([k, v]) => ({
    value: k,
    label: v.label,
    color: v.color,
  }));
  const clientOpts = [
    { value: "", label: "— Nenhum —" },
    ...clients.map((c) => ({ value: c.id, label: c.name, dot: c.color })),
  ];
  const assignees = d.assignees ?? (d.assignee ? [d.assignee] : []);
  const setAssignees = (arr) =>
    setD((p) => ({ ...p, assignees: arr, assignee: arr[0] ?? "" }));

  // Comment mutations are server-authoritative; sync modal + board from response.
  const applyCommentUpdate = (serverCard) => {
    setD((p) => ({ ...p, comments: serverCard.comments || [] }));
    onCardUpdated?.(serverCard);
  };

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
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Header — title + project / assignee */}
        <div className="border-b border-ink/15 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <input
              autoFocus
              value={d.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Título da tarefa…"
              className="min-w-0 flex-1 bg-transparent text-lg font-bold leading-tight text-ink outline-none placeholder:text-stone-400"
            />
            <div className="flex shrink-0 gap-1.5">
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

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Projeto">
              <Select
                value={d.clientId ?? ""}
                onChange={(v) => set("clientId", v)}
                options={clientOpts}
              />
            </Field>
            <Field label="Responsáveis">
              <MultiAssignee
                members={members}
                value={assignees}
                onChange={setAssignees}
                avatarByName={avatarByName}
              />
            </Field>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {/* Left — content */}
            <div className="space-y-4">
              <Field label="Descrição">
                <textarea
                  rows={4}
                  value={d.description ?? ""}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Detalhes da tarefa…"
                  className={`${inputCls} resize-none`}
                />
              </Field>
              <Checklist items={d.checklist} onChange={(v) => set("checklist", v)} />
            </div>

            {/* Right — metadata */}
            <div className="space-y-4">
              <Field label="Status">
                <Select
                  value={d.columnId}
                  onChange={(v) => set("columnId", v)}
                  options={columnOpts}
                />
              </Field>
              <Field label="Prioridade">
                <Segmented
                  value={d.priority}
                  onChange={(v) => set("priority", v)}
                  options={priorityOpts}
                />
              </Field>
              <Field label="Prazo">
                <DatePicker
                  value={d.dueDate ?? ""}
                  onChange={(v) => set("dueDate", v)}
                />
              </Field>
              <Field label="Cor de destaque">
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
                        d.labelColor === c
                          ? "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-clay"
                          : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </Field>
              <Links items={d.links} onChange={(v) => set("links", v)} />
            </div>
          </div>

          <div className="mt-4 border-t border-ink/10 pt-4">
            <Comments
              cardId={card.id}
              comments={d.comments}
              members={members}
              currentUser={currentUser}
              isAdmin={isAdmin}
              avatarByName={avatarByName}
              onUpdate={applyCommentUpdate}
            />
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
