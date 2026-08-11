import { useEffect, useState } from "react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmSales() {
  const [sales, setSales] = useState(null);

  useEffect(() => {
    crmApi.listSales().then(({ sales }) => setSales(sales)).catch(() => setSales([]));
  }, []);

  if (sales === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (sales.length === 0) return <p className="text-sm text-stone-500">Nenhuma venda registrada ainda.</p>;

  return (
    <div className="space-y-2">
      {sales.map((s) => (
        <div key={s.id} className="rounded-lg surface-3 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-stone-500">{s.status}</span>
            <span className="text-sm font-semibold text-ink">{brl(s.amount)}</span>
          </div>
          {s.commissions?.length > 0 && (
            <p className="mt-1 font-mono text-[10px] text-stone-400">
              comissão: {s.commissions.map((c) => `${c.beneficiary_email} ${brl(c.amount)}`).join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
