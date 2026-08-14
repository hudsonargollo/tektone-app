import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

const INPUT_CLASS =
  "w-full rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-stone-400";

function FieldLabel({ children }) {
  return (
    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-stone-500">
      {children}
    </label>
  );
}

function placeholderForType(type) {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  return "";
}

function ScalarInput({ field, value, onChange }) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          className={INPUT_CLASS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "url":
      return (
        <input
          type="text"
          placeholder="https://…"
          className={INPUT_CLASS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "image":
      return (
        <input
          type="text"
          placeholder="URL da imagem"
          className={INPUT_CLASS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <input
          type="number"
          className={INPUT_CLASS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          Sim
        </label>
      );
    case "select":
      return (
        <select className={INPUT_CLASS} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          type="text"
          className={INPUT_CLASS}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function ReorderButtons({ index, length, onMove, onRemove }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        className="rounded p-1 text-stone-400 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
      >
        <ChevronUp size={12} />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === length - 1}
        className="rounded p-1 text-stone-400 hover:bg-ink/5 hover:text-ink disabled:opacity-30"
      >
        <ChevronDown size={12} />
      </button>
      <button type="button" onClick={onRemove} className="rounded p-1 text-stone-400 hover:bg-danger/10 hover:text-danger">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function ListField({ value, onChange }) {
  const items = value || [];
  function update(i, v) {
    const next = [...items];
    next[i] = v;
    onChange(next);
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input className={INPUT_CLASS} value={v} onChange={(e) => update(i, e.target.value)} />
          <ReorderButtons
            index={i}
            length={items.length}
            onMove={(dir) => move(i, dir)}
            onRemove={() => onChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="flex items-center gap-1 font-mono text-[11px] text-action"
      >
        <Plus size={12} /> adicionar
      </button>
    </div>
  );
}

function ArrayField({ field, value, onChange }) {
  const items = value?.length ? value : [];
  function updateItem(i, key, v) {
    onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function add() {
    const blank = Object.fromEntries(field.fields.map((f) => [f.key, placeholderForType(f.type)]));
    onChange([...items, blank]);
  }
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-ink/10 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
              {field.itemLabel || "item"} {i + 1}
            </span>
            <ReorderButtons
              index={i}
              length={items.length}
              onMove={(dir) => move(i, dir)}
              onRemove={() => onChange(items.filter((_, j) => j !== i))}
            />
          </div>
          <div className="space-y-2">
            {field.fields.map((sub) => (
              <div key={sub.key}>
                <FieldLabel>{sub.label}</FieldLabel>
                <ScalarInput field={sub} value={it[sub.key]} onChange={(v) => updateItem(i, sub.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 font-mono text-[11px] text-action"
      >
        <Plus size={12} /> adicionar {field.itemLabel || "item"}
      </button>
    </div>
  );
}

// Generic schema-driven property panel — every v1 block except `richtext`
// (which gets its own bespoke textarea+preview editor, see BlogPanel/
// DocumentBuilder) is edited entirely through this component, no per-block
// custom panel code needed.
export default function PropertyPanel({ schema, values, onChange }) {
  function set(key, v) {
    onChange({ ...values, [key]: v });
  }
  return (
    <div className="space-y-4">
      {schema
        .filter((field) => field.type !== "markdown")
        .map((field) => (
          <div key={field.key}>
            <FieldLabel>{field.label}</FieldLabel>
            {field.type === "list" ? (
              <ListField value={values[field.key]} onChange={(v) => set(field.key, v)} />
            ) : field.type === "array" ? (
              <ArrayField field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
            ) : (
              <ScalarInput field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} />
            )}
          </div>
        ))}
    </div>
  );
}
