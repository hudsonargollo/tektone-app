import { useEffect, useState } from "react";
import { Pencil, Check, X, UserCheck, Tag, Link2 } from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";
import { LEAD_STATUSES, TIER_COLOR, TIER_LABEL, CATEGORY_PALETTE, brl, withAlpha } from "@/crm/crmStatus";

const STATUS_LABEL = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s.label]));
STATUS_LABEL.incomplete = "Incompleto";
const STATUS_COLOR = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, s.color]));
STATUS_COLOR.incomplete = "var(--color-ink)";

/** Hand-rolled donut — no chart-library dependency, matches the rest of
 *  this codebase's own SVG components (CardModal's calendar, etc). */
function Donut({ data, size = 128, strokeWidth = 18 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity="0.08"
        strokeWidth={strokeWidth}
      />
      {total > 0 &&
        data.map((d, i) => {
          const frac = d.value / total;
          const dash = Math.max(frac * circumference - 1.5, 0); // 1.5px gap between segments
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="round"
            />
          );
          offset += frac * circumference;
          return el;
        })}
    </svg>
  );
}

function Legend({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="min-w-0 flex-1 truncate text-ink">{d.label}</span>
          <span className="shrink-0 font-mono text-stone-500 tnum">{d.value}</span>
          <span className="w-10 shrink-0 text-right font-mono text-[10px] text-stone-500 tnum">
            {total ? Math.round((d.value / total) * 100) : 0}%
          </span>
        </div>
      ))}
      {data.length === 0 && <p className="text-xs text-stone-500">Sem dados ainda.</p>}
    </div>
  );
}

function KpiTile({ label, value, sub }) {
  return (
    <div className="surface-2 rounded-xl p-4">
      <p className="font-mono text-[9.5px] uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[10.5px] text-stone-500">{sub}</p>}
    </div>
  );
}

function RevenueHero({ revenue, isAdmin, onGoalSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(revenue.goal);
  const [saving, setSaving] = useState(false);
  const pct = revenue.goal > 0 ? Math.min(100, Math.round((revenue.thisMonth / revenue.goal) * 100)) : null;

  async function save() {
    setSaving(true);
    try {
      const { revenueGoal } = await crmApi.setRevenueGoal(Number(draft) || 0);
      onGoalSaved(revenueGoal);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-2 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Faturamento do mês</p>
          <p className="mt-1 text-3xl font-bold text-ink">{brl(revenue.thisMonth)}</p>
        </div>
        {isAdmin && !editing && (
          <button
            onClick={() => {
              setDraft(revenue.goal);
              setEditing(true);
            }}
            className="flex items-center gap-1 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[10.5px] text-stone-500 hover:border-action/40 hover:text-action"
          >
            <Pencil size={11} /> meta
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Meta mensal (R$)"
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button onClick={save} disabled={saving} className="rounded-lg bg-action p-2 text-clay disabled:opacity-50">
            {saving ? <Spinner /> : <Check size={15} />}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg border border-ink/15 p-2 text-stone-500">
            <X size={15} />
          </button>
        </div>
      ) : revenue.goal > 0 ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/[0.08]">
            <div className="h-full rounded-full bg-action transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-stone-500">
            {pct}% de {brl(revenue.goal)}
          </p>
        </>
      ) : (
        isAdmin && <p className="mt-2 text-xs text-stone-500">Nenhuma meta definida — clique em "meta" para acompanhar o progresso.</p>
      )}
    </div>
  );
}

function TemperatureBoard({ byTier, leads }) {
  const [open, setOpen] = useState(null);
  const tiers = ["hot", "warm", "cold"];
  const total = tiers.reduce((s, t) => s + (byTier[t] || 0), 0);
  if (total === 0) return null;

  return (
    <div className="surface-2 rounded-2xl p-5">
      <p className="label-tech mb-3">Qualificação, por temperatura</p>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((t) => {
          const count = byTier[t] || 0;
          const active = open === t;
          return (
            <button
              key={t}
              onClick={() => setOpen(active ? null : t)}
              disabled={!count}
              className="rounded-lg px-3 py-2.5 text-left transition-colors disabled:cursor-default"
              style={{
                background: withAlpha(TIER_COLOR[t], active ? 16 : 8),
                border: `1px solid ${withAlpha(TIER_COLOR[t], active ? 45 : 22)}`,
              }}
            >
              <p className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: TIER_COLOR[t] }}>
                {TIER_LABEL[t]}
              </p>
              <p className="mt-0.5 text-lg font-bold text-ink">{count}</p>
            </button>
          );
        })}
      </div>
      {open && (
        <div className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
          {leads
            .filter((l) => l.tier === open)
            .map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg surface-3 px-3 py-2">
                <span className="truncate text-sm text-ink">{l.name || "Sem nome"}</span>
                <span className="shrink-0 font-mono text-[10px] text-stone-500">{STATUS_LABEL[l.status]}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function CrmDashboard({ isAdmin }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    crmApi.dashboard().then(setData).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const { kpi, revenue } = data;
  const linkFunnel = data.linkFunnel || { title: "INSTAGRAM-DESTAQUES", totalClicks: 0, formEntries: 0, clickToFormPct: null };
  const statusData = LEAD_STATUSES.filter((s) => data.leadsByStatus[s.key] > 0).map((s) => ({
    label: s.label,
    value: data.leadsByStatus[s.key],
    color: s.color,
  }));
  const sourceData = (data.bySource || []).map((s, i) => ({
    label: s.source,
    value: s.count,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <RevenueHero revenue={revenue} isAdmin={isAdmin} onGoalSaved={(goal) => setData((d) => ({ ...d, revenue: { ...d.revenue, goal } }))} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile label="Leads no funil" value={kpi.totalLeads} />
        <KpiTile
          label="Conversão"
          value={`${kpi.conversionPct}%`}
          sub={`${kpi.won} fechados`}
        />
        <KpiTile
          label="Taxa de vitória"
          value={kpi.winRatePct == null ? "—" : `${kpi.winRatePct}%`}
          sub={`${kpi.won} × ${kpi.lost} perdidos`}
        />
        <KpiTile label="Leads · 30d" value={kpi.leadsLast30d} />
        <KpiTile label="Comissões pendentes" value={brl(kpi.pendingCommissions)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-2 rounded-2xl p-5">
          <p className="label-tech mb-3">Funil por estágio</p>
          <div className="space-y-2">
            {LEAD_STATUSES.map((s) => {
              const count = data.leadsByStatus[s.key] || 0;
              const max = Math.max(...LEAD_STATUSES.map((x) => data.leadsByStatus[x.key] || 0), 1);
              return (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink">{s.label}</span>
                    <span className="font-mono text-stone-500 tnum">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, background: s.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface-2 rounded-2xl p-5">
          <p className="label-tech mb-3 flex items-center gap-1.5">
            <Tag size={11} /> Leads por origem
          </p>
          {sourceData.length ? (
            <div className="flex items-center gap-4">
              <Donut data={sourceData} />
              <Legend data={sourceData} />
            </div>
          ) : (
            <p className="text-xs text-stone-500">Sem dados ainda.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-2 rounded-2xl p-5">
          <p className="label-tech mb-3 flex items-center gap-1.5">
            <UserCheck size={11} /> Por closer
          </p>
          {data.byCloser?.length ? (
            <div className="space-y-1.5">
              {data.byCloser.map((cl) => (
                <div key={cl.closer} className="flex items-center justify-between gap-2 rounded-lg surface-3 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{cl.closer}</span>
                  <span className="shrink-0 font-mono text-[11px] text-stone-500 tnum">
                    {cl.leads} leads · {cl.won} ganhos
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold text-ink tnum">{brl(cl.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500">Sem dados ainda.</p>
          )}
        </div>

        <TemperatureBoard byTier={data.leadsByTier} leads={data.leads || []} />
      </div>

      <div className="surface-2 rounded-2xl p-5">
        <p className="label-tech mb-3 flex items-center gap-1.5">
          <Link2 size={11} /> {linkFunnel.title} → Formulário
        </p>
        {linkFunnel.totalClicks || linkFunnel.formEntries ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-stone-500">Cliques no link</p>
              <p className="mt-1 text-xl font-bold text-ink tnum">{linkFunnel.totalClicks}</p>
            </div>
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-stone-500">Formulários enviados</p>
              <p className="mt-1 text-xl font-bold text-ink tnum">{linkFunnel.formEntries}</p>
            </div>
            <div>
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-stone-500">Conversão</p>
              <p className="mt-1 text-xl font-bold text-ink tnum">
                {linkFunnel.clickToFormPct == null ? "—" : `${linkFunnel.clickToFormPct}%`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-stone-500">Sem dados ainda.</p>
        )}
      </div>
    </div>
  );
}
