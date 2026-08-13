import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Wallet,
  TrendingDown,
  TrendingUp,
  Lock,
  Plus,
  Archive,
  ArchiveRestore,
  Pencil,
  FolderPlus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const brl = (n, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const RECURRENCE_LABELS = { once: "única", monthly: "mensal", annual: "anual" };

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
];
const PAYMENT_LABEL = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));

const todayISO = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
// New costs default to today's date when looking at the current month, or
// the 1st of whatever month is being viewed otherwise — so a cost you add
// while browsing a past/future month actually shows up in that view.
const defaultCostDate = (month) => (month === currentMonth() ? todayISO() : `${month}-01`);
const emptyDraft = (month) => ({
  name: "",
  categoryId: "",
  amount: "",
  recurrence: "once",
  costDate: defaultCostDate(month),
  paymentMethod: "",
  cardAlias: "",
});
const monthLabel = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};
const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Internal financial tracking — Phase 3/3.5. STAFF/ADMIN only (the button
// that opens this is itself gated by financeAccess in App.jsx), and even
// within this panel only ADMIN can edit the budget target or add/archive
// costs — a finance-authorized STAFF member sees everything read-only.
// Scoped to a calendar month throughout (see functions/api/finances —
// once/monthly/annual costs each project onto whichever months they're
// due), with prev/next navigation instead of a lifetime total, since real
// bookkeeping is done month by month.
export default function FinancePanel({ clients, isAdmin, onClose }) {
  const [projectId, setProjectId] = useState(clients[0]?.id ?? "");
  const [month, setMonth] = useState(currentMonth());
  const [finances, setFinances] = useState(null);
  const [costs, setCosts] = useState(null);
  const [categories, setCategories] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);

  const [budgetDraft, setBudgetDraft] = useState({ totalInternalBudget: "", notes: "" });
  const [editingBudget, setEditingBudget] = useState(false);

  const [showAddCost, setShowAddCost] = useState(false);
  const [costDraft, setCostDraft] = useState(() => emptyDraft(currentMonth()));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    api.listCostCategories().then(({ categories }) => setCategories(categories)).catch(() => {});
  }, []);

  function load() {
    if (!projectId) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.getFinances(projectId, month),
      api.listCosts(projectId, { all: showArchived, month }),
    ])
      .then(([f, c]) => {
        setFinances(f.finances);
        setCosts(c.costs);
        setBudgetDraft({ totalInternalBudget: f.finances.totalInternalBudget || "", notes: f.finances.notes || "" });
      })
      .catch((e) => setError(e.body?.error || "Falha ao carregar."))
      .finally(() => setLoading(false));
  }
  useEffect(load, [projectId, showArchived, month]);

  async function saveBudget() {
    setSaving(true);
    setError("");
    try {
      await api.updateFinances(projectId, {
        totalInternalBudget: Number(budgetDraft.totalInternalBudget) || 0,
        notes: budgetDraft.notes,
      });
      setEditingBudget(false);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function addCost() {
    if (!costDraft.name.trim() || !(Number(costDraft.amount) > 0)) return;
    setBusy("new");
    setError("");
    try {
      await api.createCost(projectId, {
        name: costDraft.name,
        categoryId: costDraft.categoryId || null,
        amount: Number(costDraft.amount),
        recurrence: costDraft.recurrence,
        costDate: costDraft.costDate,
        paymentMethod: costDraft.paymentMethod || null,
        cardAlias: costDraft.paymentMethod === "cartao" ? costDraft.cardAlias : "",
      });
      setCostDraft(emptyDraft(month));
      setShowAddCost(false);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao adicionar custo.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive(cost) {
    setBusy(cost.id);
    setError("");
    try {
      await api.toggleCostArchive(projectId, cost.id);
      load();
    } catch (e) {
      setError(e.body?.error || "Falha ao atualizar.");
    } finally {
      setBusy(null);
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const { category } = await api.createCostCategory({ name: newCategoryName.trim() });
      setCategories((prev) => [...(prev || []), category].sort((a, b) => a.name.localeCompare(b.name)));
      setCostDraft((d) => ({ ...d, categoryId: category.id }));
      setNewCategoryName("");
    } catch (e) {
      setError(e.body?.error || "Falha ao criar categoria.");
    } finally {
      setAddingCategory(false);
    }
  }

  const margin = finances?.profitMargin;
  const marginColor = margin == null ? "text-stone-500" : margin >= 0 ? "text-success" : "text-danger";
  const isCurrentMonth = month === currentMonth();

  return (
    <div className="flex h-full w-full flex-col surface-2">
      <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="-ml-1.5 rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <Wallet size={15} className="text-action" />
          <span className="label-tech">Financeiro</span>
          <Lock size={11} className="text-stone-400" title="Visível apenas para staff/admin" />
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-1 rounded-lg surface-3 p-1">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            title="Mês anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[128px] text-center font-mono text-[11px] font-semibold uppercase tracking-wide text-ink">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-md p-1.5 text-stone-500 transition-colors hover:bg-ink/[0.06] hover:text-ink"
            title="Próximo mês"
          >
            <ChevronRight size={15} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="ml-1 rounded-md px-2 py-1 font-mono text-[10px] font-semibold text-action hover:underline"
            >
              hoje
            </button>
          )}
        </div>
      </div>

        <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-5">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Balanço — income vs costs, for the selected month */}
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg surface-3 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Receita paga</p>
                  <p className="mt-0.5 text-sm font-semibold text-success">{brl(finances?.income?.paid)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-500">
                    <Clock size={9} /> Receita pendente
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-warning">{brl(finances?.income?.pending)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Custo do mês</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{brl(finances?.costs?.total)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-500">
                    <RefreshCw size={9} /> recorrente
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{brl(finances?.costs?.recurring)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Margem</p>
                  <p className={`mt-0.5 flex items-center gap-1 text-sm font-semibold ${marginColor}`}>
                    {margin != null && (margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                    {margin == null ? "—" : `${margin}%`}
                  </p>
                </div>
              </div>

              {/* Budget target (admin) */}
              <div className="mb-5 rounded-lg surface-3 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">Meta de orçamento</p>
                  {isAdmin && !editingBudget && (
                    <button onClick={() => setEditingBudget(true)} className="text-stone-400 hover:text-action">
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
                {editingBudget ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      placeholder="Orçamento (R$)"
                      value={budgetDraft.totalInternalBudget}
                      onChange={(e) => setBudgetDraft((d) => ({ ...d, totalInternalBudget: e.target.value }))}
                      className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                    <textarea
                      placeholder="Notas"
                      value={budgetDraft.notes}
                      onChange={(e) => setBudgetDraft((d) => ({ ...d, notes: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                    <div className="flex gap-2">
                      <button onClick={saveBudget} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay disabled:opacity-50">
                        {saving && <Spinner />} salvar
                      </button>
                      <button onClick={() => setEditingBudget(false)} className="rounded-lg border border-ink/15 px-3 py-1.5 font-mono text-[11px] text-stone-500">
                        cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-ink">{brl(finances?.totalInternalBudget)}</p>
                    {finances?.notes && <p className="mt-1 text-xs text-stone-500">{finances.notes}</p>}
                  </>
                )}
              </div>

              {/* Costs ledger */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1 rounded-lg surface-3 p-1">
                  <button
                    onClick={() => setShowArchived(false)}
                    className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${!showArchived ? "bg-clay text-ink shadow-sm" : "text-stone-500"}`}
                  >
                    ativos
                  </button>
                  <button
                    onClick={() => setShowArchived(true)}
                    className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${showArchived ? "bg-clay text-ink shadow-sm" : "text-stone-500"}`}
                  >
                    todos (incl. arquivados)
                  </button>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddCost((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-1.5 font-mono text-[11px] font-semibold text-clay"
                  >
                    <Plus size={13} /> custo
                  </button>
                )}
              </div>

              {showAddCost && (
                <div className="mb-4 space-y-2 rounded-lg surface-3 p-3">
                  <input
                    placeholder="Nome (ex: Google Workspace, freelancer motion video)"
                    value={costDraft.name}
                    onChange={(e) => setCostDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <input
                      type="number"
                      placeholder="Valor (R$)"
                      value={costDraft.amount}
                      onChange={(e) => setCostDraft((d) => ({ ...d, amount: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                    <select
                      value={costDraft.recurrence}
                      onChange={(e) => setCostDraft((d) => ({ ...d, recurrence: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    >
                      <option value="once">Única (ex: freelancer)</option>
                      <option value="monthly">Mensal</option>
                      <option value="annual">Anual</option>
                    </select>
                    <input
                      type="date"
                      value={costDraft.costDate}
                      onChange={(e) => setCostDraft((d) => ({ ...d, costDate: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={costDraft.categoryId}
                      onChange={(e) => setCostDraft((d) => ({ ...d, categoryId: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    >
                      <option value="">Sem categoria</option>
                      {(categories || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select
                      value={costDraft.paymentMethod}
                      onChange={(e) => setCostDraft((d) => ({ ...d, paymentMethod: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    >
                      <option value="">Forma de pagamento</option>
                      {PAYMENT_METHODS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  {costDraft.paymentMethod === "cartao" && (
                    <input
                      placeholder="Apelido do cartão (ex: Nubank PJ, Amex final biz) — nunca o número"
                      value={costDraft.cardAlias}
                      onChange={(e) => setCostDraft((d) => ({ ...d, cardAlias: e.target.value }))}
                      className="w-full rounded-lg border border-action/30 bg-action/5 px-3 py-2 text-sm text-ink placeholder:text-stone-400"
                    />
                  )}
                  <div className="flex items-center gap-2 border-t border-ink/10 pt-2">
                    <input
                      placeholder="nova categoria"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-xs text-ink"
                    />
                    <button
                      onClick={addCategory}
                      disabled={addingCategory || !newCategoryName.trim()}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[10px] text-stone-500 hover:border-action/40 hover:text-action disabled:opacity-50"
                    >
                      {addingCategory ? <Spinner /> : <FolderPlus size={11} />} categoria
                    </button>
                  </div>
                  <button
                    onClick={addCost}
                    disabled={busy === "new" || !costDraft.name.trim() || !(Number(costDraft.amount) > 0)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
                  >
                    {busy === "new" && <Spinner />} adicionar custo
                  </button>
                </div>
              )}

              {costs === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : costs.length === 0 ? (
                <p className="text-xs text-stone-500">Nenhum custo neste mês.</p>
              ) : (
                <ul className="space-y-1.5">
                  {costs.map((c) => (
                    <li key={c.id} className={`flex items-center justify-between gap-2 rounded-lg surface-3 px-3.5 py-2.5 ${c.status === "archived" ? "opacity-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                          {c.category_name && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                              style={{ background: `${c.category_color}22`, color: c.category_color }}
                            >
                              {c.category_name}
                            </span>
                          )}
                          {c.payment_method && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-ink/[0.05] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-600">
                              {c.payment_method === "cartao" && <CreditCard size={9} />}
                              {PAYMENT_LABEL[c.payment_method] || c.payment_method}
                              {c.card_alias ? ` · ${c.card_alias}` : ""}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-stone-500">
                          {fmtDate(c.cost_date)} · {RECURRENCE_LABELS[c.recurrence] || c.recurrence}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold text-ink">{brl(c.amount)}</span>
                      {isAdmin && (
                        <button
                          onClick={() => toggleArchive(c)}
                          disabled={busy === c.id}
                          title={c.status === "active" ? "Arquivar" : "Reativar"}
                          className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                        >
                          {busy === c.id ? <Spinner /> : c.status === "active" ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
    </div>
  );
}
