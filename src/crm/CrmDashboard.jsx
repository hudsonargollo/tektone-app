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

      <div className="rounded-2xl surface-2 p-5">
        <p className="label-tech mb-3">Funil por estágio</p>
        <div className="space-y-2">
          {Object.entries(data.leadsByStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-lg surface-3 px-4 py-2.5">
              <span className="text-sm text-ink">{STATUS_LABEL[status] || status}</span>
              <span className="font-mono text-sm font-semibold text-ink">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
