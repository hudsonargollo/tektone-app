import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles, Send, Check } from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";
import { fmtDateTime } from "@/lib/timezone";

const STAGES = ["new", "contacted", "qualified", "won", "lost", "incomplete"];
const STAGE_LABEL = {
  new: "novo",
  contacted: "contatado",
  qualified: "qualificado",
  won: "ganho",
  lost: "perdido",
  incomplete: "incompleto",
};
const TIER_STYLE = {
  hot: "bg-danger/10 text-danger",
  warm: "bg-warning/10 text-warning",
  cold: "bg-ink/[0.06] text-stone-500",
};
const TIER_LABEL = { hot: "quente", warm: "morno", cold: "frio" };

// Mirrors worker/lib/onboardingRules.js's PROJECT_TYPE_LABEL keys — kept as
// a display-only duplicate here (not shared as a package) so this select
// stays in lockstep with which project types actually have a rule-based
// onboarding checklist. "outro" has no rule set on purpose: picking it (or
// leaving the field blank) falls back to the static "Onboarding padrão"
// template, same as today.
const PROJECT_TYPE_LABEL = {
  site_institucional: "Site institucional",
  loja_virtual: "Loja virtual",
  sistema_interno: "Sistema interno",
  app_mobile: "Aplicativo mobile",
  automacao: "Automação",
  outro: "Outro",
};

// Mirrors marketing/components/QualificacaoSection.tsx's option lists — kept
// as a display-only lookup here (not shared as a package) so a closer sees
// the same human labels the visitor picked, not raw enum values like
// "50-200k" or "problema_claro".
const QUALIFICATION_LABELS = {
  teamSize: { solo: "Somente eu", "2-5": "2 a 5", "6-15": "6 a 15", "16-50": "16 a 50", "50+": "Mais de 50" },
  revenue: {
    "0-10k": "Até R$ 10 mil",
    "10-50k": "R$ 10 mil a R$ 50 mil",
    "50-200k": "R$ 50 mil a R$ 200 mil",
    "200-500k": "R$ 200 mil a R$ 500 mil",
    "500k-1m": "R$ 500 mil a R$ 1 milhão",
    "1m+": "Acima de R$ 1 milhão",
  },
  moment: {
    problema_claro: "Tem um problema claro e quer resolvê-lo",
    poderia_melhor: "Sabe que a empresa poderia estar em outro nível, mas não sabe o quê mudar",
    ideia_oportunidade: "Tem uma ideia ou oportunidade e quer tirá-la do papel",
    nova_receita: "Quer criar uma nova fonte de receita",
    entendendo_momento: "Ainda está entendendo se é o momento certo",
  },
  urgency: {
    agora: "Agora — próximos 30 dias",
    "3_meses": "Próximos 3 meses",
    "6_meses": "Próximos 6 meses",
    sem_prazo: "Sem prazo definido",
  },
  investment: {
    pode_agora: "Pode investir agora",
    precisa_entender: "Precisa entender a solução e o retorno primeiro",
    "30_dias": "Consegue investir nos próximos 30 dias",
    organizar: "Precisa se organizar financeiramente",
    sem_disponibilidade: "Sem disponibilidade no momento",
  },
  decision: {
    responsavel_final: "É o responsável final pela decisão",
    socios: "Decide com sócio(s)",
    outro_responsavel: "Precisa envolver outro responsável",
    nao_participa: "Não participa da decisão",
  },
};
const QUALIFICATION_FIELD_LABEL = {
  teamSize: "Tamanho da equipe",
  revenue: "Faturamento mensal",
  moment: "Momento atual",
  urgency: "Urgência",
  investment: "Capacidade de investimento",
  decision: "Poder de decisão",
};

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmLeadDetail({ leadId, timezone, onBack }) {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showWonForm, setShowWonForm] = useState(false);
  const [wonProjectType, setWonProjectType] = useState("");
  const [wonBrief, setWonBrief] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [creatingSale, setCreatingSale] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [askText, setAskText] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [approving, setApproving] = useState(null);

  function load() {
    crmApi.getLead(leadId).then((d) => {
      setData(d);
      setNotes(d.lead.notes || "");
    });
    crmApi.listQuestions(leadId).then(({ questions }) => setQuestions(questions));
  }

  useEffect(load, [leadId]);

  async function submitAsk(e) {
    e.preventDefault();
    if (!askText.trim()) return;
    setAsking(true);
    try {
      await crmApi.askCopilot(leadId, askText.trim());
      setAskText("");
      load();
    } finally {
      setAsking(false);
    }
  }

  async function runSuggest() {
    setSuggesting(true);
    try {
      await crmApi.suggestCopilot(leadId);
      load();
    } finally {
      setSuggesting(false);
    }
  }

  async function approve(id) {
    setApproving(id);
    try {
      await crmApi.approveQuestion(id);
      load();
    } finally {
      setApproving(null);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await crmApi.updateLead(leadId, { notes });
      load();
    } finally {
      setSavingNotes(false);
    }
  }

  async function setStatus(status) {
    setChangingStatus(true);
    try {
      await crmApi.setLeadStatus(leadId, status);
      load();
    } finally {
      setChangingStatus(false);
    }
  }

  // "won" doesn't fire immediately like the other stages — it opens a small
  // form first so the closer can optionally capture a project_type + brief,
  // the signal the adaptive onboarding checklist is built from (see
  // ~/.claude/plans/tektone-adaptive-onboarding.md). Both fields are
  // optional: leaving them blank falls back to the static template, same
  // as before this feature existed.
  async function confirmWon() {
    setChangingStatus(true);
    try {
      await crmApi.setLeadStatus(leadId, "won", {
        projectType: wonProjectType || undefined,
        brief: wonBrief.trim() || undefined,
      });
      setShowWonForm(false);
      setWonProjectType("");
      setWonBrief("");
      load();
    } finally {
      setChangingStatus(false);
    }
  }

  async function submitSale(e) {
    e.preventDefault();
    const amount = Number(saleAmount);
    if (!amount || amount <= 0) return;
    setCreatingSale(true);
    try {
      await crmApi.createSale(leadId, amount, "BRL");
      setSaleAmount("");
      load();
    } finally {
      setCreatingSale(false);
    }
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const { lead, events, sales } = data;
  let qualification = null;
  try {
    qualification = lead.qualification ? JSON.parse(lead.qualification) : null;
  } catch {
    qualification = null;
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 font-mono text-[11px] text-stone-500 hover:text-ink">
        <ArrowLeft size={13} /> voltar
      </button>

      <div className="mb-6 rounded-2xl surface-2 p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-ink">{lead.name || lead.email || lead.phone}</p>
            <p className="font-mono text-[11px] text-stone-500">
              {[lead.email, lead.phone, lead.company, lead.segmento].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {lead.tier && (
              <span className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ${TIER_STYLE[lead.tier] || TIER_STYLE.cold}`}>
                {TIER_LABEL[lead.tier] || lead.tier} {typeof lead.score === "number" ? `· ${lead.score}/90` : ""}
              </span>
            )}
            <span className="rounded-full bg-ink/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-stone-600">
              {STAGE_LABEL[lead.status] || lead.status}
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              disabled={changingStatus || s === lead.status}
              onClick={() => (s === "won" ? setShowWonForm(true) : setStatus(s))}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors disabled:opacity-40 ${
                s === lead.status ? "bg-action text-clay" : "surface-3 text-stone-600 hover:border-action/40"
              }`}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        {showWonForm && (
          <div className="mb-4 rounded-lg surface-3 p-4">
            <p className="mb-2.5 font-mono text-[11px] uppercase tracking-wide text-stone-500">
              Marcar como ganho
            </p>
            <div className="flex flex-col gap-2">
              <select
                value={wonProjectType}
                onChange={(e) => setWonProjectType(e.target.value)}
                className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
              >
                <option value="">Tipo de projeto (opcional)</option>
                {Object.entries(PROJECT_TYPE_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <textarea
                value={wonBrief}
                onChange={(e) => setWonBrief(e.target.value)}
                rows={3}
                placeholder="Diretrizes do projeto (opcional) — contexto que ajuda a montar o onboarding certo para este cliente."
                className="rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
              />
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={confirmWon}
                disabled={changingStatus}
                className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
              >
                {changingStatus && <Spinner />} confirmar ganho
              </button>
              <button
                onClick={() => setShowWonForm(false)}
                disabled={changingStatus}
                className="rounded-lg border border-ink/15 px-3.5 py-2 font-mono text-[11px] text-stone-500"
              >
                cancelar
              </button>
            </div>
          </div>
        )}

        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-stone-500">Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="mb-2 w-full rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
        />
        <button
          onClick={saveNotes}
          disabled={savingNotes}
          className="inline-flex items-center gap-1.5 rounded-lg surface-3 px-3 py-1.5 font-mono text-[11px] text-stone-600 disabled:opacity-50"
        >
          {savingNotes ? <Spinner /> : <Save size={12} />} salvar notas
        </button>
      </div>

      {qualification && (
        <div className="mb-6 rounded-2xl surface-2 p-6">
          <p className="label-tech mb-3">Qualificação (formulário do site)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {["teamSize", "revenue", "moment", "urgency", "investment", "decision"].map((field) =>
              qualification[field] ? (
                <div key={field} className="rounded-lg surface-3 px-4 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    {QUALIFICATION_FIELD_LABEL[field]}
                  </p>
                  <p className="mt-0.5 text-sm text-ink">
                    {QUALIFICATION_LABELS[field]?.[qualification[field]] || qualification[field]}
                  </p>
                </div>
              ) : null
            )}
          </div>
          {qualification.goals?.length > 0 && (
            <div className="mt-2 rounded-lg surface-3 px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-stone-400">Objetivos</p>
              <p className="mt-0.5 text-sm text-ink">
                {qualification.goals.join(" · ")}
                {qualification.goalsOther ? ` · ${qualification.goalsOther}` : ""}
              </p>
            </div>
          )}
          {qualification.instagram && (
            <p className="mt-2 font-mono text-[11px] text-stone-500">Instagram: {qualification.instagram}</p>
          )}
        </div>
      )}

      <div className="mb-6 rounded-2xl surface-2 p-6">
        <p className="label-tech mb-3">Vendas</p>
        {sales.length > 0 && (
          <div className="mb-3 space-y-2">
            {sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg surface-3 px-4 py-2.5">
                <span className="font-mono text-[11px] text-stone-500">{s.status}</span>
                <span className="text-sm font-semibold text-ink">{brl(s.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={submitSale} className="flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Valor da venda (R$)"
            value={saleAmount}
            onChange={(e) => setSaleAmount(e.target.value)}
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={creatingSale}
            className="inline-flex items-center gap-1.5 rounded-lg bg-action px-4 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            {creatingSale && <Spinner />} registrar venda
          </button>
        </form>
      </div>

      <div className="mb-6 rounded-2xl surface-2 p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="label-tech flex items-center gap-1.5">
            <Sparkles size={12} className="text-action" /> Business Specialist Copilot
          </p>
          <button
            onClick={runSuggest}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 rounded-lg surface-3 px-3 py-1.5 font-mono text-[11px] text-stone-600 disabled:opacity-50"
          >
            {suggesting ? <Spinner /> : <Sparkles size={12} />} sugerir direções
          </button>
        </div>

        <form onSubmit={submitAsk} className="mb-4 flex gap-2">
          <input
            placeholder="Pergunte algo sobre este lead…"
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            className="flex-1 rounded-lg border border-ink/15 bg-transparent px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={asking}
            className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 font-mono text-[11px] font-semibold text-clay disabled:opacity-50"
          >
            {asking ? <Spinner /> : <Send size={12} />}
          </button>
        </form>

        {questions === null ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhuma interação ainda.</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-lg surface-3 p-4">
                {q.question_text && (
                  <p className="mb-2 font-mono text-[11px] text-stone-500">"{q.question_text}"</p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{q.ai_draft_answer}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400">
                    {q.ai_confidence ? `confiança: ${q.ai_confidence}` : ""}
                  </span>
                  {q.status === "approved" ? (
                    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-success">
                      <Check size={11} /> aprovado
                    </span>
                  ) : (
                    <button
                      onClick={() => approve(q.id)}
                      disabled={approving === q.id}
                      className="font-mono text-[10px] text-action hover:underline disabled:opacity-50"
                    >
                      aprovar e salvar na base
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl surface-2 p-6">
        <p className="label-tech mb-3">Histórico</p>
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-lg surface-3 px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500">{e.type}</p>
              <p className="text-[11px] text-stone-400">{fmtDateTime(e.created_at, timezone, { seconds: true })} · {e.actor_email}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
