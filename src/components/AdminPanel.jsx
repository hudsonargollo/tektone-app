import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ShieldCheck,
  RotateCcw,
  Check,
  Clock,
  Wallet,
  Layers,
  Plus,
  Trash2,
  PlayCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";

const ONBOARDING_CATEGORY_OPTIONS = ["kickoff", "access", "content", "technical", "design", "training", "launch"];
const ONBOARDING_OWNER_OPTIONS = [
  { value: "tektone", label: "Tektone" },
  { value: "customer", label: "Cliente" },
];

// Full-screen view (not a modal) — mounted by App.jsx's view switch when
// view === "admin". onClose navigates back to the board view; the X/back
// control is mobile-only since desktop navigation lives in AppSidebar.
export default function AdminPanel({ currentEmail, clients, onClose }) {
  const [tab, setTab] = useState("access");
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState(null); // email being reset
  const [error, setError] = useState("");

  // ── Workflow templates (Phase 7) ──────────────────────────────────────────
  const [templates, setTemplates] = useState(null);
  const [templateDraft, setTemplateDraft] = useState({ name: "", description: "", tasksText: "" });
  const [applyProjectId, setApplyProjectId] = useState(clients?.[0]?.id ?? "");
  const [templateBusy, setTemplateBusy] = useState(null);

  function loadTemplates() {
    api.listWorkflowTemplates().then(({ templates }) => setTemplates(templates)).catch(() => {});
  }
  useEffect(() => {
    if (tab === "templates") loadTemplates();
  }, [tab]);

  async function createTemplate() {
    const tasks = templateDraft.tasksText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title) => ({ title, columnId: "todo", priority: "medium" }));
    if (!templateDraft.name.trim() || !tasks.length) return;
    setTemplateBusy("create");
    setError("");
    try {
      await api.createWorkflowTemplate({ name: templateDraft.name, description: templateDraft.description, tasks });
      setTemplateDraft({ name: "", description: "", tasksText: "" });
      loadTemplates();
    } catch (e) {
      setError(e.body?.error || "Falha ao criar template.");
    } finally {
      setTemplateBusy(null);
    }
  }

  async function applyTemplate(id) {
    if (!applyProjectId) return;
    setTemplateBusy(id);
    setError("");
    try {
      const { created } = await api.applyWorkflowTemplate(id, applyProjectId);
      window.alert(`${created} tarefa(s) criada(s) no projeto.`);
    } catch (e) {
      setError(e.body?.error || "Falha ao aplicar template.");
    } finally {
      setTemplateBusy(null);
    }
  }

  async function removeTemplate(id) {
    if (!window.confirm("Remover este template?")) return;
    setTemplateBusy(id);
    try {
      await api.deleteWorkflowTemplate(id);
      loadTemplates();
    } catch (e) {
      setError(e.body?.error || "Falha ao remover.");
    } finally {
      setTemplateBusy(null);
    }
  }

  // ── Onboarding review queue (Phase 2 — AI-generated plans awaiting a
  //    human before they touch tasks/the Portal; see
  //    ~/.claude/plans/tektone-adaptive-onboarding.md) ─────────────────────
  const [pendingPlans, setPendingPlans] = useState(null);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [planDetails, setPlanDetails] = useState({}); // planId -> {plan, steps}
  const [newStepDraft, setNewStepDraft] = useState({ title: "", owner: "tektone", category: "" });
  const [onboardingBusy, setOnboardingBusy] = useState(null);

  function loadPendingPlans() {
    crmApi.listOnboardingPlans("pending_review").then(({ plans }) => setPendingPlans(plans)).catch(() => setPendingPlans([]));
  }
  useEffect(() => {
    if (tab === "onboarding") loadPendingPlans();
  }, [tab]);

  async function togglePlan(planId) {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
      return;
    }
    setExpandedPlanId(planId);
    setNewStepDraft({ title: "", owner: "tektone", category: "" });
    if (!planDetails[planId]) {
      const detail = await crmApi.getOnboardingPlan(planId);
      setPlanDetails((d) => ({ ...d, [planId]: detail }));
    }
  }

  function patchLocalStep(planId, stepId, patch) {
    setPlanDetails((d) => ({
      ...d,
      [planId]: { ...d[planId], steps: d[planId].steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) },
    }));
  }

  async function saveStep(planId, step) {
    setOnboardingBusy(step.id);
    try {
      const { step: updated } = await crmApi.updateOnboardingStep(planId, step.id, {
        title: step.title,
        description: step.description,
        owner: step.owner,
        category: step.category,
        dueOffsetDays: step.due_offset_days,
      });
      patchLocalStep(planId, step.id, updated);
    } catch (e) {
      setError(e.body?.error || "Falha ao salvar a etapa.");
    } finally {
      setOnboardingBusy(null);
    }
  }

  async function removeStep(planId, stepId) {
    setOnboardingBusy(stepId);
    try {
      await crmApi.deleteOnboardingStep(planId, stepId);
      setPlanDetails((d) => ({ ...d, [planId]: { ...d[planId], steps: d[planId].steps.filter((s) => s.id !== stepId) } }));
    } catch (e) {
      setError(e.body?.error || "Falha ao remover a etapa.");
    } finally {
      setOnboardingBusy(null);
    }
  }

  async function addOnboardingStep(planId) {
    if (!newStepDraft.title.trim()) return;
    setOnboardingBusy("add");
    try {
      const { step } = await crmApi.addOnboardingStep(planId, {
        title: newStepDraft.title.trim(),
        owner: newStepDraft.owner,
        category: newStepDraft.category || null,
      });
      setPlanDetails((d) => ({ ...d, [planId]: { ...d[planId], steps: [...d[planId].steps, step] } }));
      setNewStepDraft({ title: "", owner: "tektone", category: "" });
    } catch (e) {
      setError(e.body?.error || "Falha ao adicionar etapa.");
    } finally {
      setOnboardingBusy(null);
    }
  }

  async function approveOnboardingPlan(planId) {
    if (!window.confirm("Aprovar este plano? As etapas atuais serão aplicadas ao projeto (tarefas + checklist do cliente).")) return;
    setOnboardingBusy("approve");
    try {
      await crmApi.approveOnboardingPlan(planId);
      setExpandedPlanId(null);
      loadPendingPlans();
    } catch (e) {
      setError(e.body?.error || "Falha ao aprovar o plano.");
    } finally {
      setOnboardingBusy(null);
    }
  }

  async function load() {
    try {
      const { users } = await api.adminUsers();
      setUsers(users);
    } catch (e) {
      setError(e.body?.error || "Falha ao carregar.");
    }
  }
  useEffect(() => {
    load();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function toggleFinance(u) {
    setBusy(u.email);
    try {
      await api.adminSetFinanceAccess(u.email, !u.financeAuthorized);
      await load();
    } catch (e) {
      setError(e.body?.error || "Falha ao atualizar acesso financeiro.");
    } finally {
      setBusy(null);
    }
  }

  async function reset(email) {
    const self = email === currentEmail;
    const msg = self
      ? "Resetar SUA conta? Você será desconectado e precisará criar uma nova senha."
      : `Resetar o acesso de ${email}? A pessoa precisará criar uma nova senha no próximo acesso.`;
    if (!window.confirm(msg)) return;
    setBusy(email);
    try {
      await api.adminReset(email);
      await load();
      if (self) window.location.reload();
    } catch (e) {
      setError(e.body?.error || "Falha ao resetar.");
    } finally {
      setBusy(null);
    }
  }

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
          <ShieldCheck size={15} className="text-action" />
          <span className="label-tech">Admin</span>
        </div>
      </div>

        <div className="flex gap-1 border-b border-ink/15 px-6 pt-3">
          <button
            onClick={() => setTab("access")}
            className={`rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${tab === "access" ? "border-b-2 border-action text-action" : "text-stone-500"}`}
          >
            acessos
          </button>
          <button
            onClick={() => setTab("templates")}
            className={`rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${tab === "templates" ? "border-b-2 border-action text-action" : "text-stone-500"}`}
          >
            templates de workflow
          </button>
          <button
            onClick={() => setTab("onboarding")}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 font-mono text-[11px] transition-colors ${tab === "onboarding" ? "border-b-2 border-action text-action" : "text-stone-500"}`}
          >
            <Sparkles size={12} /> onboarding (revisão)
            {pendingPlans?.length > 0 && (
              <span className="rounded-full bg-action px-1.5 py-0.5 font-mono text-[9px] font-bold text-clay">
                {pendingPlans.length}
              </span>
            )}
          </button>
        </div>

        <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-6 py-5">
          {error && <p className="mb-3 font-mono text-[11px] text-danger">{error}</p>}

          {tab === "access" && (
          <>
          <p className="mb-4 text-xs leading-relaxed text-stone-500">
            Resetar remove a senha da pessoa. No próximo acesso ela cria uma nova
            senha em “primeiro acesso”.
          </p>

          {!users ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li
                  key={u.email}
                  className="flex items-center justify-between gap-3 rounded-lg surface-3 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                      {u.email}
                      {u.admin && (
                        <span className="rounded bg-action/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-action">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
                      {u.registered ? (
                        <>
                          <Check size={11} className="text-success" /> registrado
                        </>
                      ) : (
                        <>
                          <Clock size={11} className="text-warning" /> pendente
                        </>
                      )}
                    </p>
                  </div>
                  {!u.admin && u.registered && (
                    <button
                      disabled={busy === u.email}
                      onClick={() => toggleFinance(u)}
                      title={u.financeAuthorized ? "Revogar acesso financeiro" : "Autorizar acesso financeiro"}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                        u.financeAuthorized
                          ? "border-action/40 text-action hover:bg-action/10"
                          : "border-ink/15 text-stone-500 hover:border-action/40 hover:text-action"
                      }`}
                    >
                      <Wallet size={12} /> financeiro
                    </button>
                  )}
                  <button
                    disabled={!u.registered || busy === u.email}
                    onClick={() => reset(u.email)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-600 transition-colors hover:border-danger/40 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    {busy === u.email ? <Spinner /> : <RotateCcw size={12} />}
                    resetar
                  </button>
                </li>
              ))}
            </ul>
          )}
          </>
          )}

          {tab === "templates" && (
            <>
              <p className="mb-4 text-xs leading-relaxed text-stone-500">
                Um template vira um lote de tarefas na coluna "A fazer" de qualquer projeto,
                de uma vez. Um título por linha.
              </p>

              <div className="mb-5 space-y-2 rounded-lg surface-3 p-3">
                <input
                  placeholder="Nome do template (ex: Infraestrutura)"
                  value={templateDraft.name}
                  onChange={(e) => setTemplateDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                />
                <input
                  placeholder="Descrição (opcional)"
                  value={templateDraft.description}
                  onChange={(e) => setTemplateDraft((d) => ({ ...d, description: e.target.value }))}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                />
                <textarea
                  placeholder={"Configurar domínio\nSubir ambiente de staging\nConectar DNS via Cloudflare"}
                  value={templateDraft.tasksText}
                  onChange={(e) => setTemplateDraft((d) => ({ ...d, tasksText: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                />
                <button
                  onClick={createTemplate}
                  disabled={templateBusy === "create" || !templateDraft.name.trim() || !templateDraft.tasksText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
                >
                  {templateBusy === "create" ? <Spinner /> : <Plus size={13} />} criar template
                </button>
              </div>

              {(clients?.length ?? 0) > 0 && (
                <div className="mb-3">
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-stone-500">
                    Aplicar no projeto
                  </label>
                  <select
                    value={applyProjectId}
                    onChange={(e) => setApplyProjectId(e.target.value)}
                    className="w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {templates === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : templates.length === 0 ? (
                <p className="text-xs text-stone-500">Nenhum template ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {templates.map((t) => (
                    <li key={t.id} className="rounded-lg surface-3 px-3.5 py-3">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                          <Layers size={13} className="text-action" /> {t.name}
                        </p>
                        <span className="font-mono text-[10px] text-stone-500">{t.tasks.length} tarefas</span>
                      </div>
                      {t.description && <p className="mb-2 text-xs text-stone-500">{t.description}</p>}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => applyTemplate(t.id)}
                          disabled={templateBusy === t.id || !applyProjectId}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-action/40 px-2.5 py-1.5 font-mono text-[11px] text-action transition-colors hover:bg-action/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {templateBusy === t.id ? <Spinner /> : <PlayCircle size={12} />} aplicar
                        </button>
                        <button
                          onClick={() => removeTemplate(t.id)}
                          disabled={templateBusy === t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-stone-500 transition-colors hover:border-danger/40 hover:text-danger"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "onboarding" && (
            <>
              <p className="mb-4 text-xs leading-relaxed text-stone-500">
                Planos de onboarding gerados por IA a partir do brief do closer, aguardando revisão. Edite as
                etapas conforme necessário antes de aprovar — só depois de aprovado o plano vira tarefas no
                board e aparece no checklist do cliente no Portal.
              </p>

              {pendingPlans === null ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : pendingPlans.length === 0 ? (
                <p className="text-xs text-stone-500">Nenhum plano aguardando revisão.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingPlans.map((p) => {
                    const expanded = expandedPlanId === p.id;
                    const detail = planDetails[p.id];
                    return (
                      <li key={p.id} className="rounded-lg surface-3">
                        <button
                          onClick={() => togglePlan(p.id)}
                          className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                              <Sparkles size={13} className="text-action" /> {p.project_name || "Projeto"}
                            </p>
                            {p.project_type && (
                              <p className="mt-0.5 font-mono text-[10px] text-stone-500">{p.project_type}</p>
                            )}
                          </div>
                          {expanded ? (
                            <ChevronUp size={15} className="shrink-0 text-stone-500" />
                          ) : (
                            <ChevronDown size={15} className="shrink-0 text-stone-500" />
                          )}
                        </button>

                        {expanded && (
                          <div className="border-t border-ink/10 px-3.5 py-3.5">
                            {p.brief && (
                              <div className="mb-3 rounded-lg surface-2 p-3">
                                <p className="mb-1 font-mono text-[9.5px] uppercase tracking-wider text-stone-500">
                                  brief do closer
                                </p>
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600">{p.brief}</p>
                              </div>
                            )}

                            {!detail ? (
                              <div className="flex justify-center py-4">
                                <Spinner />
                              </div>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {detail.steps.map((s) => (
                                    <div key={s.id} className="rounded-lg border border-ink/10 p-3">
                                      <input
                                        value={s.title}
                                        onChange={(e) => patchLocalStep(p.id, s.id, { title: e.target.value })}
                                        className="mb-1.5 w-full rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-sm font-medium text-ink"
                                      />
                                      <textarea
                                        value={s.description || ""}
                                        onChange={(e) => patchLocalStep(p.id, s.id, { description: e.target.value })}
                                        rows={2}
                                        placeholder="Descrição (opcional)"
                                        className="mb-1.5 w-full rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-xs text-ink"
                                      />
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <select
                                          value={s.owner}
                                          onChange={(e) => patchLocalStep(p.id, s.id, { owner: e.target.value })}
                                          className="rounded-lg border border-ink/15 bg-transparent px-2 py-1 font-mono text-[10.5px] text-ink"
                                        >
                                          {ONBOARDING_OWNER_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          value={s.category || ""}
                                          onChange={(e) =>
                                            patchLocalStep(p.id, s.id, { category: e.target.value || null })
                                          }
                                          className="rounded-lg border border-ink/15 bg-transparent px-2 py-1 font-mono text-[10.5px] text-ink"
                                        >
                                          <option value="">sem categoria</option>
                                          {ONBOARDING_CATEGORY_OPTIONS.map((c) => (
                                            <option key={c} value={c}>
                                              {c}
                                            </option>
                                          ))}
                                        </select>
                                        <input
                                          type="number"
                                          value={s.due_offset_days ?? ""}
                                          onChange={(e) =>
                                            patchLocalStep(p.id, s.id, {
                                              due_offset_days: e.target.value === "" ? null : Number(e.target.value),
                                            })
                                          }
                                          placeholder="dias"
                                          className="w-16 rounded-lg border border-ink/15 bg-transparent px-2 py-1 font-mono text-[10.5px] text-ink"
                                        />
                                        <div className="ml-auto flex items-center gap-1.5">
                                          <button
                                            onClick={() => saveStep(p.id, s)}
                                            disabled={onboardingBusy === s.id}
                                            className="inline-flex items-center gap-1 rounded-lg border border-action/40 px-2 py-1 font-mono text-[10.5px] text-action hover:bg-action/10 disabled:opacity-40"
                                          >
                                            {onboardingBusy === s.id ? <Spinner /> : <Check size={11} />} salvar
                                          </button>
                                          <button
                                            onClick={() => removeStep(p.id, s.id)}
                                            disabled={onboardingBusy === s.id}
                                            className="rounded-lg border border-ink/15 p-1.5 text-stone-500 hover:border-danger/40 hover:text-danger disabled:opacity-40"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg surface-2 p-2.5">
                                  <input
                                    placeholder="Título da nova etapa"
                                    value={newStepDraft.title}
                                    onChange={(e) => setNewStepDraft((d) => ({ ...d, title: e.target.value }))}
                                    className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-transparent px-2.5 py-1.5 text-xs text-ink"
                                  />
                                  <select
                                    value={newStepDraft.owner}
                                    onChange={(e) => setNewStepDraft((d) => ({ ...d, owner: e.target.value }))}
                                    className="rounded-lg border border-ink/15 bg-transparent px-2 py-1.5 font-mono text-[10.5px] text-ink"
                                  >
                                    {ONBOARDING_OWNER_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => addOnboardingStep(p.id)}
                                    disabled={onboardingBusy === "add" || !newStepDraft.title.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1.5 font-mono text-[10.5px] text-stone-600 hover:border-action/40 hover:text-action disabled:opacity-40"
                                  >
                                    {onboardingBusy === "add" ? <Spinner /> : <Plus size={11} />} adicionar
                                  </button>
                                </div>

                                <button
                                  onClick={() => approveOnboardingPlan(p.id)}
                                  disabled={onboardingBusy === "approve" || detail.steps.length === 0}
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
                                >
                                  {onboardingBusy === "approve" ? <Spinner /> : <CheckCheck size={13} />} aprovar e
                                  aplicar
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
    </div>
  );
}
