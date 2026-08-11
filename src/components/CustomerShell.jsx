import { useEffect, useState } from "react";
import { LogOut, FileText, Receipt, CheckCircle2, Clock, ShieldCheck, Sparkles, ShoppingBag, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner, Avatar } from "@/components/ui";
import LogoMark from "@/components/LogoMark";

const brl = (n, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

const CONTRACT_STATUS = {
  DRAFT: { label: "rascunho", color: "text-stone-500" },
  PENDING_SIGNATURE: { label: "aguardando assinatura", color: "text-warning" },
  SIGNED: { label: "assinado", color: "text-success" },
  VOID: { label: "anulado", color: "text-danger" },
};
const INVOICE_STATUS = {
  UNPAID: { label: "em aberto", color: "text-warning" },
  PAID: { label: "pago", color: "text-success" },
  OVERDUE: { label: "vencido", color: "text-danger" },
  VOID: { label: "anulado", color: "text-stone-400" },
};

// The entire experience for a CUSTOMER-role account — deliberately a
// separate component tree from the staff Kanban app, not a conditional
// branch inside it, so a customer-facing bundle can never accidentally
// reach internal task detail, staff workloads, or the finance module (see
// PRD §4's isolation requirement — this is the defense-in-depth half of
// that, the API-level 403s in rbac.js are the other half).
export default function CustomerShell({ userName, userEmail, userAvatar, onLogout }) {
  const [projects, setProjects] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [tab, setTab] = useState("contracts");
  const [contracts, setContracts] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [purchased, setPurchased] = useState(null);
  const [signing, setSigning] = useState(null);
  const [buying, setBuying] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listProjects()
      .then(({ projects }) => {
        setProjects(projects);
        setActiveProjectId(projects[0]?.id ?? null);
      })
      .catch((e) => setError(e.body?.error || "Falha ao carregar."));
    api.listAddonsCatalog().then(({ addons }) => setCatalog(addons)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeProjectId) return;
    api.listContracts(activeProjectId).then(({ contracts }) => setContracts(contracts)).catch(() => {});
    api.listInvoices(activeProjectId).then(({ invoices }) => setInvoices(invoices)).catch(() => {});
    api.listProjectAddons(activeProjectId).then(({ addons }) => setPurchased(addons)).catch(() => {});
  }, [activeProjectId]);

  async function buyAddon(addonId) {
    setBuying(addonId);
    setError("");
    try {
      const { addon } = await api.addProjectAddon(activeProjectId, addonId);
      setPurchased((prev) => [addon, ...(prev || [])]);
      api.listInvoices(activeProjectId).then(({ invoices }) => setInvoices(invoices)).catch(() => {});
    } catch (e) {
      setError(e.body?.error || "Falha ao adicionar.");
    } finally {
      setBuying(null);
    }
  }

  async function sign(contractId) {
    setSigning(contractId);
    setError("");
    try {
      const { contract } = await api.signContract(activeProjectId, contractId);
      setContracts((prev) => prev.map((c) => (c.id === contract.id ? contract : c)));
    } catch (e) {
      setError(e.body?.error || "Falha ao assinar.");
    } finally {
      setSigning(null);
    }
  }

  const project = projects?.find((p) => p.id === activeProjectId);

  return (
    <div className="flex min-h-screen flex-col bg-clay">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink/10 bg-clay/80 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2">
          <LogoMark className="h-7 w-auto" />
          <span className="text-sm font-semibold tracking-[0.28em] text-ink">TEKTONE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 sm:flex">
            <Avatar name={userName || userEmail} src={userAvatar} />
            <span className="font-mono text-[11px] text-stone-500">{userName || userEmail}</span>
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 transition-colors hover:border-danger/40 hover:text-danger"
          >
            <LogOut size={12} /> sair
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
        {error && (
          <p className="mb-4 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 font-mono text-[11px] text-danger">
            {error}
          </p>
        )}

        {!projects ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum projeto vinculado à sua conta ainda.</p>
        ) : (
          <>
            {projects.length > 1 && (
              <select
                value={activeProjectId}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="mb-4 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {/* Progress — the one operational signal a customer sees; no task
                titles, no assignees, no staff workload detail (PRD §4). */}
            <div className="mb-6 rounded-2xl surface-2 p-6">
              <p className="label-tech mb-2">{project?.name}</p>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-ink">{project?.progress?.pct ?? 0}%</span>
                <span className="font-mono text-[11px] text-stone-500">
                  {project?.progress?.done ?? 0} de {project?.progress?.total ?? 0} concluídas
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-action transition-all"
                  style={{ width: `${project?.progress?.pct ?? 0}%` }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg surface-3 p-1">
              <button
                onClick={() => setTab("contracts")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-mono text-[11px] transition-colors ${
                  tab === "contracts" ? "bg-clay text-ink shadow-sm" : "text-stone-500"
                }`}
              >
                <FileText size={13} /> contratos
              </button>
              <button
                onClick={() => setTab("invoices")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-mono text-[11px] transition-colors ${
                  tab === "invoices" ? "bg-clay text-ink shadow-sm" : "text-stone-500"
                }`}
              >
                <Receipt size={13} /> faturas
              </button>
              <button
                onClick={() => setTab("marketplace")}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 font-mono text-[11px] transition-colors ${
                  tab === "marketplace" ? "bg-clay text-ink shadow-sm" : "text-stone-500"
                }`}
              >
                <ShoppingBag size={13} /> add-ons
              </button>
            </div>

            {tab === "contracts" && (
              <div className="space-y-3">
                {contracts === null ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : contracts.length === 0 ? (
                  <p className="text-sm text-stone-500">Nenhum contrato ainda.</p>
                ) : (
                  contracts.map((c) => {
                    const st = CONTRACT_STATUS[c.status] || CONTRACT_STATUS.DRAFT;
                    return (
                      <div key={c.id} className="rounded-xl surface-2 p-5">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-semibold text-ink">{c.title}</p>
                          <span className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${st.color}`}>
                            {c.status === "SIGNED" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                            {st.label}
                          </span>
                        </div>
                        <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{c.content}</p>
                        {c.status === "SIGNED" ? (
                          <p className="flex items-center gap-1.5 font-mono text-[10px] text-stone-400">
                            <ShieldCheck size={12} /> assinado em {new Date(c.signed_at).toLocaleString("pt-BR")} por {c.signed_by}
                          </p>
                        ) : c.status === "PENDING_SIGNATURE" ? (
                          <button
                            onClick={() => sign(c.id)}
                            disabled={signing === c.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity disabled:opacity-50"
                          >
                            {signing === c.id && <Spinner />} assinar contrato
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "invoices" && (
              <div className="space-y-2">
                {invoices === null ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : invoices.length === 0 ? (
                  <p className="text-sm text-stone-500">Nenhuma fatura ainda.</p>
                ) : (
                  invoices.map((inv) => {
                    const st = INVOICE_STATUS[inv.status] || INVOICE_STATUS.UNPAID;
                    return (
                      <div key={inv.id} className="flex items-center justify-between rounded-lg surface-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">{inv.description || "Fatura"}</p>
                          {inv.due_date && (
                            <p className="font-mono text-[10px] text-stone-500">
                              vencimento {new Date(inv.due_date).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-ink">{brl(inv.amount, inv.currency)}</span>
                          <span className={`font-mono text-[10px] uppercase tracking-wider ${st.color}`}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "marketplace" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {catalog === null ? (
                  <div className="col-span-2 flex justify-center py-8"><Spinner /></div>
                ) : catalog.length === 0 ? (
                  <p className="col-span-2 text-sm text-stone-500">Nenhum add-on disponível no momento.</p>
                ) : (
                  catalog.map((a) => {
                    const owned = (purchased || []).some((p) => p.addon_id === a.id);
                    const hasDiscount = a.special_price && a.special_price < a.price;
                    return (
                      <div key={a.id} className="overflow-hidden rounded-2xl surface-2 shadow-sm">
                        <div
                          className="relative flex h-28 items-end p-4"
                          style={
                            a.ai_banner_url
                              ? { backgroundImage: `url(${a.ai_banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                              : { background: "linear-gradient(135deg, rgba(201,169,106,0.35), rgba(46,74,67,0.55))" }
                          }
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                          {hasDiscount && (
                            <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-warning px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                              <Sparkles size={11} /> oferta especial
                            </span>
                          )}
                          <p className="relative z-10 font-serif text-lg font-semibold text-white drop-shadow">{a.title}</p>
                        </div>
                        <div className="p-4">
                          {a.description && <p className="mb-3 text-sm leading-relaxed text-stone-600">{a.description}</p>}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              {hasDiscount && (
                                <span className="font-mono text-xs text-stone-400 line-through">{brl(a.price)}</span>
                              )}
                              <span className="text-lg font-bold text-ink">{brl(hasDiscount ? a.special_price : a.price)}</span>
                            </div>
                            {owned ? (
                              <span className="flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 font-mono text-[11px] font-semibold text-success">
                                <Check size={13} /> adicionado
                              </span>
                            ) : (
                              <button
                                onClick={() => buyAddon(a.id)}
                                disabled={buying === a.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay transition-opacity hover:opacity-90 disabled:opacity-50"
                              >
                                {buying === a.id && <Spinner />} adicionar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
