import { useEffect, useState } from "react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";

const STATUS_LABEL = {
  new: "novo",
  contacted: "contatado",
  qualified: "qualificado",
  won: "ganho",
  lost: "perdido",
  incomplete: "incompleto",
};

const TIER_LABEL = { hot: "quente", warm: "morno", cold: "frio" };
const TIER_STYLE = {
  hot: "bg-danger/10 text-danger",
  warm: "bg-warning/10 text-warning",
  cold: "bg-ink/[0.06] text-stone-500",
};

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmDashboard() {
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

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl surface-2 p-5">
          <p className="label-tech mb-2">Leads no funil</p>
          <p className="text-2xl font-bold text-ink">{data.totalLeads}</p>
        </div>
        <div className="rounded-2xl surface-2 p-5">
          <p className="label-tech mb-2">Vendas fechadas</p>
          <p className="text-2xl font-bold text-ink">{data.totalSales}</p>
        </div>
        <div className="rounded-2xl surface-2 p-5">
          <p className="label-tech mb-2">Faturamento total</p>
          <p className="text-2xl font-bold text-ink">{brl(data.totalSalesAmount)}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl surface-2 p-5">
        <p className="label-tech mb-3">Funil por estágio</p>
        <div className="space-y-2">
          {Object.entries(data.leadsByStatus).map(([status, count]) => {
            const pct = data.totalLeads > 0 ? Math.round((count / data.totalLeads) * 100) : 0;
            return (
              <div key={status} className="rounded-lg surface-3 px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink">{STATUS_LABEL[status] || status}</span>
                  <span className="font-mono text-sm font-semibold text-ink">{count}</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                  <div className="h-full rounded-full bg-action" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data.leadsByTier && (data.leadsByTier.hot + data.leadsByTier.warm + data.leadsByTier.cold) > 0 && (
        <div className="rounded-2xl surface-2 p-5">
          <p className="label-tech mb-3">Leads qualificados pelo site, por temperatura</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(data.leadsByTier).map(([tier, count]) => (
              <div key={tier} className={`rounded-lg px-4 py-3 ${TIER_STYLE[tier]}`}>
                <p className="font-mono text-[10px] uppercase tracking-wider opacity-70">{TIER_LABEL[tier]}</p>
                <p className="mt-0.5 text-xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
