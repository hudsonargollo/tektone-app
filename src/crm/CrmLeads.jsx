import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";

const STAGES = [
  { key: "new", label: "novo" },
  { key: "contacted", label: "contatado" },
  { key: "qualified", label: "qualificado" },
  { key: "won", label: "ganho" },
  { key: "lost", label: "perdido" },
  { key: "incomplete", label: "incompleto" },
];

const TIER_STYLE = {
  hot: "bg-danger/10 text-danger",
  warm: "bg-warning/10 text-warning",
  cold: "bg-ink/[0.06] text-stone-500",
};
const TIER_LABEL = { hot: "quente", warm: "morno", cold: "frio" };

export default function CrmLeads({ onOpenLead }) {
  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "" });
  const [saving, setSaving] = useState(false);

  function load() {
    crmApi.listLeads(filter || undefined).then(({ leads }) => setLeads(leads)).catch(() => setLeads([]));
  }

  useEffect(load, [filter]);

  async function submitCreate(e) {
    e.preventDefault();
    if (!form.name && !form.email && !form.phone) return;
    setSaving(true);
    try {
      await crmApi.createLead(form);
      setForm({ name: "", email: "", phone: "", company: "" });
      setCreating(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg surface-3 p-1">
          <FilterBtn active={!filter} onClick={() => setFilter("")}>todos</FilterBtn>
          {STAGES.map((s) => (
            <FilterBtn key={s.key} active={filter === s.key} onClick={() => setFilter(s.key)}>
              {s.label}
            </FilterBtn>
          ))}
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay"
        >
          <Plus size={13} /> novo lead
        </button>
      </div>

      {creating && (
        <form onSubmit={submitCreate} className="mb-4 grid gap-3 rounded-2xl surface-2 p-5 sm:grid-cols-2">
          <input
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <input
            placeholder="E-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <input
            placeholder="Telefone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <input
            placeholder="Empresa"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-action px-4 py-2.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            {saving && <Spinner />} salvar lead
          </button>
        </form>
      )}

      {leads === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhum lead encontrado.</p>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <button
              key={l.id}
              onClick={() => onOpenLead(l.id)}
              className="flex w-full items-center justify-between rounded-lg surface-3 px-4 py-3 text-left transition-colors hover:border-action/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{l.name || l.email || l.phone || "Lead sem nome"}</p>
                <p className="truncate font-mono text-[11px] text-stone-500">
                  {[l.company, l.segmento].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {l.tier && (
                  <span
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${TIER_STYLE[l.tier] || TIER_STYLE.cold}`}
                  >
                    {TIER_LABEL[l.tier] || l.tier}
                  </span>
                )}
                <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-600">
                  {STAGES.find((s) => s.key === l.status)?.label || l.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
        active ? "bg-clay text-ink shadow-sm" : "text-stone-500"
      }`}
    >
      {children}
    </button>
  );
}
