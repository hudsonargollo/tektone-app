import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Wallet, TrendingDown, TrendingUp, Lock, Plus, Archive, ArchiveRestore, Pencil, FolderPlus, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";

const brl = (n, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const emptyDraft = { name: "", categoryId: "", amount: "", recurrence: "once", costDate: new Date().toISOString().slice(0, 10) };

// Internal financial tracking — Phase 3/3.5. STAFF/ADMIN only (the button
// that opens this is itself gated by financeAccess in App.jsx), and even
// within this panel only ADMIN can edit the budget target or add/archive
// costs — a finance-authorized STAFF member sees everything read-only.
// Structure borrows the best of a reference spreadsheet the user had
// before (categorized costs, monthly run-rate, income-vs-costs balance)
// but stays entirely in this app's own Mineral visual system — no
// GlobalCode/CI styling here.
export default function FinancePanel({ clients, isAdmin, onClose }) {
  const [projectId, setProjectId] = useState(clients[0]?.id ?? "");
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
  const [costDraft, setCostDraft] = useState(emptyDraft);
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
      api.getFinances(projectId),
      api.listCosts(projectId, showArchived),
    ])
      .then(([f, c]) => {
        setFinances(f.finances);
        setCosts(c.costs);
        setBudgetDraft({ totalInternalBudget: f.finances.totalInternalBudget || "", notes: f.finances.notes || "" });
      })
      .catch((e) => setError(e.body?.error || "Falha ao carregar."))
      .finally(() => setLoading(false));
  }
  useEffect(load, [projectId, showArchived]);

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
      });
      setCostDraft(emptyDraft);
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
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl surface-2 shadow-2xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center justify-between border-b border-ink/15 px-6 py-4">
          <div className="flex items-center gap-2">
            <Wallet size={15} className="text-action" />
            <span className="label-tech">Financeiro interno</span>
            <Lock size={11} className="text-stone-400" title="Visível apenas para staff/admin" />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-ink/[0.05] hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
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
              {/* Balanço — income vs costs, the reference sheet's core idea */}
              <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg surface-3 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Receita paga</p>
                  <p className="mt-0.5 text-sm font-semibold text-success">{brl(finances?.income?.paid)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500">Custo total ativo</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{brl(finances?.costs?.total)}</p>
                </div>
                <div className="rounded-lg surface-3 p-3">
                  <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-stone-500">
                    <RefreshCw size={9} /> recorrente/mês
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">{brl(finances?.costs?.monthlyRecurring)}</p>
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
              <div className="mb-3 flex items-center justify-between">
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
                    placeholder="Nome (ex: Google Workspace)"
                    value={costDraft.name}
                    onChange={(e) => setCostDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  />
                  <div className="grid grid-cols-2 gap-2">
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
                      <option value="once">Única</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                    <input
                      type="date"
                      value={costDraft.costDate}
                      onChange={(e) => setCostDraft((d) => ({ ...d, costDate: e.target.value }))}
                      className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                    />
                  </div>
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
                <p className="text-xs text-stone-500">Nenhum custo registrado.</p>
              ) : (
                <ul className="space-y-1.5">
                  {costs.map((c) => (
                    <li key={c.id} className={`flex items-center justify-between gap-2 rounded-lg surface-3 px-3.5 py-2.5 ${c.status === "archived" ? "opacity-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                          {c.category_name && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                              style={{ background: `${c.category_color}22`, color: c.category_color }}
                            >
                              {c.category_name}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-stone-500">
                          {fmtDate(c.cost_date)} · {c.recurrence === "monthly" ? "mensal" : "única"}
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
      </motion.div>
    </div>
  );
}
