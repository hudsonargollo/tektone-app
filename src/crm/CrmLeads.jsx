import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Tag,
  UserCheck,
  Search,
  MessageCircle,
  Inbox,
  Plus,
  X,
  Flame,
  SlidersHorizontal,
  Calendar,
} from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";
import { LEAD_STATUSES, TIER_COLOR, TIER_LABEL, waLink, timeAgo } from "@/crm/crmStatus";

// Kanban pipeline board — ports the structure/interaction model of Código
// Internacional's own CrmLeads.jsx (drag-and-drop lanes, search, filter
// side panel) onto Tektone's simpler single-funnel lead schema. Unlike CI,
// this fetches the full lead list once (crmApi.listLeads(), no status
// filter/pagination split) — Tektone's lead volume doesn't need CI's
// server-side pagination/stats-endpoint split.
export default function CrmLeads({ onOpenLead }) {
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", tier: "", source: "" });
  const [dragId, setDragId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [moveErr, setMoveErr] = useState(null);

  function load() {
    crmApi
      .listLeads()
      .then(({ leads }) => setLeads(leads))
      .catch((e) => setError(e.body?.error || "Falha ao carregar leads."));
  }
  useEffect(load, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const sourceOptions = useMemo(() => {
    const set = new Set();
    for (const l of leads || []) set.add(l.utm_source || "orgânico");
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (leads || []).filter((l) => {
      if (l.status === "incomplete") return false; // landing-page abandoners — own page, not this board
      if (q) {
        const hay = [l.name, l.email, l.phone].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.dateFrom && l.created_at && l.created_at < filters.dateFrom) return false;
      if (filters.dateTo && l.created_at && l.created_at > `${filters.dateTo}T23:59:59`) return false;
      if (filters.tier && l.tier !== filters.tier) return false;
      if (filters.source && (l.utm_source || "orgânico") !== filters.source) return false;
      return true;
    });
  }, [leads, term, filters]);

  const byStatus = (key) => filteredLeads.filter((l) => l.status === key);

  async function moveLead(id, status) {
    const lead = (leads || []).find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    let lostReason = null;
    if (status === "lost") {
      lostReason = window.prompt("Motivo do descarte (opcional):");
      if (lostReason === null) return; // cancelled — abort the move
    }
    const prev = lead.status;
    setMoveErr(null);
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await crmApi.setLeadStatus(id, status, lostReason || undefined);
    } catch (e) {
      setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status: prev } : l)));
      setMoveErr(e.body?.error || "Falha ao mover o lead.");
    }
  }

  return (
    <div className="flex items-start gap-4">
      <FilterPanel
        open={showFilters}
        filters={filters}
        setFilters={setFilters}
        sourceOptions={sourceOptions}
        resultCount={filteredLeads.length}
        onClose={() => setShowFilters(false)}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Pipeline de Leads</h1>
            <p className="mt-1 text-sm text-stone-500">Do primeiro contato ao onboarding.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-stone-500 sm:inline">
              {filteredLeads.length} leads
            </span>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay"
            >
              <Plus size={13} /> Novo lead
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          <div className="relative max-w-md flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nome, e-mail ou WhatsApp…"
              className="w-full rounded-lg border border-ink/15 bg-ink/[0.03] py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-stone-400 focus:border-action"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 font-mono text-[11px] transition-colors ${
              showFilters ? "border-action text-action" : "border-ink/15 text-stone-500 hover:text-ink"
            }`}
          >
            <SlidersHorizontal size={13} /> Filtros
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-action px-1.5 py-0.5 font-mono text-[9px] font-bold text-clay">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}
        {moveErr && <p className="mb-3 font-mono text-[11px] text-danger">{moveErr}</p>}

        {showAdd && (
          <AddLeadModal
            onClose={() => setShowAdd(false)}
            onCreated={(lead) => {
              setShowAdd(false);
              load();
              onOpenLead(lead.id);
            }}
          />
        )}

        {leads === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
            {LEAD_STATUSES.map((s) => {
              const col = byStatus(s.key);
              const isDragOver = dragOverKey === s.key;
              return (
                <div key={s.key} className="w-[78vw] shrink-0 sm:w-[45vw] lg:w-auto lg:min-w-0">
                  <div
                    className="flex flex-col overflow-hidden rounded-xl border transition-colors"
                    style={{
                      background: isDragOver ? `${s.color}0f` : undefined,
                      borderColor: isDragOver ? s.color : undefined,
                      borderTopColor: s.color,
                      borderTopWidth: 3,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverKey(s.key);
                    }}
                    onDragLeave={() => setDragOverKey((k) => (k === s.key ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverKey(null);
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) moveLead(id, s.key);
                    }}
                  >
                    <div className={`flex items-center justify-between border-b border-ink/10 px-3.5 py-2.5 ${isDragOver ? "" : "surface-2"}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="truncate text-xs font-bold text-ink">{s.label}</span>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10.5px] font-bold"
                        style={{ color: s.color, background: `${s.color}1a`, border: `1px solid ${s.color}40` }}
                      >
                        {col.length}
                      </span>
                    </div>
                    <div className={`flex flex-1 flex-col gap-2 p-2.5 ${isDragOver ? "" : "surface-1"}`} style={{ minHeight: 130 }}>
                      {col.map((l) => (
                        <LeadCard
                          key={l.id}
                          lead={l}
                          dragging={dragId === l.id}
                          onClick={() => onOpenLead(l.id)}
                          onDragStart={(e) => {
                            setDragId(l.id);
                            e.dataTransfer.setData("text/plain", l.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragId(null)}
                        />
                      ))}
                      {col.length === 0 && (
                        <div
                          className="grid place-items-center gap-2 rounded-lg border border-dashed border-ink/15 text-center text-stone-500"
                          style={{ minHeight: 108 }}
                        >
                          <Inbox size={20} strokeWidth={1.5} className="opacity-45" />
                          <span className="font-mono text-[10px] uppercase tracking-wide">sem leads</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, onClick, dragging, onDragStart, onDragEnd }) {
  const link = waLink(lead.phone);
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="surface-2 w-full rounded-lg p-3 text-left transition-colors hover:border-action/40"
      style={{ cursor: "grab", opacity: dragging ? 0.4 : 1 }}
    >
      <p className="truncate text-[12.5px] font-semibold text-ink">{lead.name || "Sem nome"}</p>
      {lead.phone && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 truncate font-mono text-[11px] text-stone-500">
            <Phone size={11} /> {lead.phone}
          </span>
          {link && (
            <span
              role="button"
              tabIndex={0}
              title="Enviar WhatsApp"
              onClick={(e) => {
                e.stopPropagation();
                window.open(link, "_blank", "noopener");
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-success/15 text-success"
            >
              <MessageCircle size={13} />
            </span>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 truncate rounded-full border border-ink/10 bg-ink/[0.04] px-2 py-0.5 font-mono text-[10px] text-stone-500">
          <Tag size={10} /> <span className="truncate">{lead.utm_source || "orgânico"}</span>
        </span>
        {lead.tier && (
          <span
            className="inline-flex items-center gap-1 truncate rounded-full px-2 py-0.5 font-mono text-[10px]"
            style={{ color: TIER_COLOR[lead.tier], background: `${TIER_COLOR[lead.tier]}1a`, border: `1px solid ${TIER_COLOR[lead.tier]}55` }}
            title={typeof lead.score === "number" ? `Pontuação: ${lead.score}/90` : undefined}
          >
            <Flame size={10} /> <span className="truncate">{TIER_LABEL[lead.tier] || lead.tier}</span>
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1 truncate font-mono text-[10px] text-stone-500">
          <UserCheck size={10} /> {lead.closer_name || "—"}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-stone-500">{timeAgo(lead.updated_at)}</span>
      </div>
    </button>
  );
}

const TIER_OPTIONS = [
  { key: "", label: "Todas" },
  { key: "hot", label: "Quente" },
  { key: "warm", label: "Morno" },
  { key: "cold", label: "Frio" },
];

/** Filter side panel — part of the row's flex layout (not an overlay), so
 *  opening it shrinks the board's column instead of covering it. Every
 *  filter applies client-side over whatever's currently loaded. */
function FilterPanel({ open, filters, setFilters, sourceOptions, resultCount, onClose }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const clear = () => setFilters({ dateFrom: "", dateTo: "", tier: "", source: "" });
  const activeCount = Object.values(filters).filter(Boolean).length;

  if (!open) return null;

  return (
    <div className="surface-2 w-64 shrink-0 rounded-xl">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3.5">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <SlidersHorizontal size={14} /> Filtros
        </span>
        <button onClick={onClose} className="text-stone-500 hover:text-ink">
          <X size={16} />
        </button>
      </div>
      <p className="px-4 pt-3 font-mono text-[10.5px] text-stone-500">
        {resultCount} lead{resultCount === 1 ? "" : "s"} correspondendo
      </p>

      <div className="border-t border-ink/10 px-4 py-3.5">
        <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
          <Calendar size={11} /> Período (criado em)
        </label>
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set({ dateFrom: e.target.value })}
            className="rounded-lg border border-ink/15 bg-transparent px-2 py-1.5 text-xs text-ink"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-stone-500">até</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set({ dateTo: e.target.value })}
              className="flex-1 rounded-lg border border-ink/15 bg-transparent px-2 py-1.5 text-xs text-ink"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-ink/10 px-4 py-3.5">
        <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
          <Flame size={11} /> Temperatura
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {TIER_OPTIONS.map((t) => {
            const active = filters.tier === t.key;
            const color = t.key ? TIER_COLOR[t.key] : "var(--color-ink)";
            return (
              <button
                key={t.key || "all"}
                onClick={() => set({ tier: t.key })}
                className="rounded-full px-2.5 py-1 font-mono text-[10.5px] font-bold"
                style={
                  active
                    ? { background: color, color: "var(--color-clay)", border: `1px solid ${color}` }
                    : { background: `${color}14`, color, border: `1px solid ${color}40` }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-ink/10 px-4 py-3.5">
        <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wide text-stone-500">
          <Tag size={11} /> Origem
        </label>
        <select
          value={filters.source}
          onChange={(e) => set({ source: e.target.value })}
          className="w-full rounded-lg border border-ink/15 bg-transparent px-2.5 py-2 text-xs text-ink"
        >
          <option value="">Todas</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="border-t border-ink/10 px-4 py-3.5">
        <button
          onClick={clear}
          disabled={activeCount === 0}
          className="w-full rounded-lg border border-ink/15 px-3 py-1.5 font-mono text-[11px] text-stone-500 disabled:opacity-40"
        >
          {activeCount > 0 ? `Limpar ${activeCount} filtro${activeCount === 1 ? "" : "s"}` : "Nenhum filtro ativo"}
        </button>
      </div>
    </div>
  );
}

/** Quick-add modal — a closer/admin logging a lead they talked to directly
 *  (phone call, in person, etc). Lands straight into "Novo". */
function AddLeadModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() && !phone.trim() && !email.trim()) {
      setErr("Informe ao menos nome, e-mail ou WhatsApp.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { lead } = await crmApi.createLead({
        name: name.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      });
      onCreated(lead);
    } catch (e2) {
      setErr(e2.body?.error || "Não foi possível criar o lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="surface-2 w-full max-w-sm rounded-xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Novo lead</h2>
          <button type="button" onClick={onClose} className="text-stone-500 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <input
            placeholder="WhatsApp"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <input
            type="email"
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
        </div>
        {err && <p className="mt-2.5 font-mono text-[11px] text-danger">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-action px-4 py-2.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
        >
          {busy && <Spinner />} Adicionar lead
        </button>
      </form>
    </div>
  );
}
