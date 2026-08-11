import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles, Send, Check } from "lucide-react";
import { crmApi } from "@/crm/crmApi";
import { Spinner } from "@/components/ui";

const STAGES = ["new", "contacted", "qualified", "won", "lost"];
const STAGE_LABEL = {
  new: "novo",
  contacted: "contatado",
  qualified: "qualificado",
  won: "ganho",
  lost: "perdido",
  incomplete: "incompleto",
};
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CrmLeadDetail({ leadId, onBack }) {
  const [data, setData] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
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
          <span className="shrink-0 rounded-full bg-ink/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-stone-600">
            {STAGE_LABEL[lead.status] || lead.status}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              disabled={changingStatus || s === lead.status}
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[11px] transition-colors disabled:opacity-40 ${
                s === lead.status ? "bg-action text-clay" : "surface-3 text-stone-600 hover:border-action/40"
              }`}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

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
              <p className="text-[11px] text-stone-400">{new Date(e.created_at).toLocaleString("pt-BR")} · {e.actor_email}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
