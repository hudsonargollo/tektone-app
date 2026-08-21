"use client";

import { Check, ArrowRight, ArrowLeft, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import SectionBlob from "@/components/SectionBlob";
import { trackEvent } from "@/lib/analytics";
import { detectDeviceTier, type DeviceTier } from "@/lib/device-tier";
import ParchmentStage from "./ParchmentStage";

const WHATSAPP_URL =
  "https://wa.me/5547989110551?text=" +
  encodeURIComponent("Fui aprovado na qualificação da Tektone e quero agendar minha call de diagnóstico.");

type Option = { value: string; label: string };

const businessTypeOptions: Option[] = [
  { value: "servicos", label: "Serviços / Consultoria" },
  { value: "comercio", label: "Comércio / Varejo / E-commerce" },
  { value: "educacao", label: "Educação / Infoprodutos" },
  { value: "tecnologia", label: "Tecnologia / Software / SaaS" },
  { value: "saude", label: "Saúde / Clínicas / Estética" },
  { value: "industria", label: "Indústria / Distribuição" },
  { value: "fisico", label: "Negócio físico / Operação local" },
  { value: "outro", label: "Outro" },
];

const teamSizeOptions: Option[] = [
  { value: "solo", label: "Somente eu" },
  { value: "2-5", label: "2 a 5" },
  { value: "6-15", label: "6 a 15" },
  { value: "16-50", label: "16 a 50" },
  { value: "50+", label: "Mais de 50" },
];

const revenueOptions: Option[] = [
  { value: "0-10k", label: "Até R$ 10 mil" },
  { value: "10-50k", label: "R$ 10 mil a R$ 50 mil" },
  { value: "50-200k", label: "R$ 50 mil a R$ 200 mil" },
  { value: "200-500k", label: "R$ 200 mil a R$ 500 mil" },
  { value: "500k-1m", label: "R$ 500 mil a R$ 1 milhão" },
  { value: "1m+", label: "Acima de R$ 1 milhão" },
];

const momentOptions: Option[] = [
  { value: "problema_claro", label: "Tenho um problema claro e quero resolvê-lo" },
  {
    value: "poderia_melhor",
    label:
      "Sei que minha empresa poderia estar em outro nível, mas ainda não sei exatamente o que precisa mudar",
  },
  { value: "ideia_oportunidade", label: "Tenho uma ideia ou oportunidade e quero tirá-la do papel" },
  { value: "nova_receita", label: "Quero criar uma nova fonte de receita dentro do meu negócio" },
  {
    value: "entendendo_momento",
    label: "Ainda estou entendendo se este é o momento certo para fazer alguma mudança",
  },
];

const goalsOptions: string[] = [
  "Atrair mais clientes, vender mais e melhorar minha conversão",
  "Usar tecnologia e IA para não ficar para trás",
  "Fortalecer minha presença, marca e posicionamento no digital",
  "Organizar melhor a operação e os processos",
  "Reduzir tarefas manuais, custos e ganhar mais tempo e eficiência da operação",
  "Fazer minha empresa depender menos de mim",
  "Criar uma nova fonte de receita",
  "Ainda não sei exatamente o que precisa mudar",
  "Outro",
];

const urgencyOptions: Option[] = [
  { value: "agora", label: "Agora! Quero começar nos próximos 30 dias" },
  { value: "3_meses", label: "Nos próximos 3 meses" },
  { value: "6_meses", label: "Nos próximos 6 meses" },
  { value: "sem_prazo", label: "Ainda não tenho prazo" },
];

const investmentOptions: Option[] = [
  { value: "pode_agora", label: "Sim, posso investir agora" },
  { value: "precisa_entender", label: "Sim, mas preciso entender primeiro a solução e o retorno" },
  { value: "30_dias", label: "Consigo investir nos próximos 30 dias" },
  { value: "organizar", label: "Hoje precisaria me organizar financeiramente" },
  { value: "sem_disponibilidade", label: "Não tenho disponibilidade para esse investimento no momento" },
];

const decisionOptions: Option[] = [
  { value: "responsavel_final", label: "Sou o responsável final pela decisão" },
  { value: "socios", label: "A decisão é tomada por mim e meu(s) sócio(s)" },
  { value: "outro_responsavel", label: "Preciso envolver outro responsável antes de avançar" },
  { value: "nao_participa", label: "Não participo diretamente da decisão" },
];

const ANALYZING_LINES = [
  "Analisando estrutura da empresa...",
  "Avaliando momento atual...",
  "Verificando capacidade de execução...",
  "Identificando compatibilidade…",
];

const PROCESS_CHIPS = ["Qualificação", "Análise", "Diagnóstico"];

type FormState = {
  hasCompany: boolean | null;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  businessType: string;
  businessTypeOther: string;
  teamSize: string;
  revenue: string;
  moment: string;
  goals: string[];
  goalsOther: string;
  urgency: string;
  investment: string;
  decision: string;
  consent: boolean;
};

const empty: FormState = {
  hasCompany: null,
  name: "",
  email: "",
  phone: "",
  instagram: "",
  businessType: "",
  businessTypeOther: "",
  teamSize: "",
  revenue: "",
  moment: "",
  goals: [],
  goalsOther: "",
  urgency: "",
  investment: "",
  decision: "",
  consent: false,
};

// cover → gate → intro → 8 scored/qualitative questions. "cover" is the
// full-viewport landing beat, "gate" and "intro" are un-scored (triagem /
// dados iniciais), matching the source spec's PERGUNTA 1..9 numbering.
const STEP_KEYS = [
  "cover",
  "gate",
  "intro",
  "businessType",
  "teamSize",
  "revenue",
  "moment",
  "goals",
  "urgency",
  "investment",
  "decision",
] as const;
type StepKey = (typeof STEP_KEYS)[number];

function ChoiceList({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-4 py-3 text-left text-[15px] leading-snug transition-all duration-150 ${
              active
                ? "border-green bg-green-subtle text-ink"
                : "border-sand-dark/25 bg-paper text-ink/60 hover:border-sand-dark/50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2.5 block text-base font-semibold leading-snug text-ink sm:text-lg">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-sand-dark/25 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink/30 outline-none transition-colors focus:border-green";

export default function QualificacaoSectionV2() {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<FormState>(empty);
  const [eliminated, setEliminated] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingLine, setAnalyzingLine] = useState(0);
  const [tier, setTier] = useState<"hot" | "warm" | "cold" | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deviceTier, setDeviceTier] = useState<DeviceTier>("minimized");
  const attribution = useRef({ utmSource: "", utmMedium: "", utmCampaign: "", referrer: "" });
  const startTracked = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    attribution.current = {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      referrer: document.referrer || "",
    };
    setDeviceTier(detectDeviceTier());
  }, []);

  const step: StepKey = STEP_KEYS[stepIndex];

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setData((d) => ({ ...d, [k]: v }));
  const toggleGoal = (g: string) =>
    setData((d) => ({
      ...d,
      goals: d.goals.includes(g) ? d.goals.filter((x) => x !== g) : [...d.goals, g],
    }));

  const canAdvance =
    step === "cover"
      ? true
      : step === "gate"
        ? data.hasCompany !== null
        : step === "intro"
          ? Boolean(data.name && data.email && data.phone)
          : step === "businessType"
            ? Boolean(data.businessType && (data.businessType !== "outro" || data.businessTypeOther.trim()))
            : step === "teamSize"
              ? Boolean(data.teamSize)
              : step === "revenue"
                ? Boolean(data.revenue)
                : step === "moment"
                  ? Boolean(data.moment)
                  : step === "goals"
                    ? data.goals.length > 0
                    : step === "urgency"
                      ? Boolean(data.urgency)
                      : step === "investment"
                        ? Boolean(data.investment)
                        : Boolean(data.decision && data.consent);

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/crm/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasCompany: true,
          name: data.name,
          email: data.email,
          phone: data.phone,
          instagram: data.instagram || null,
          businessType: data.businessType,
          businessTypeOther: data.businessTypeOther,
          teamSize: data.teamSize,
          revenue: data.revenue,
          moment: data.moment,
          goals: data.goals,
          goalsOther: data.goalsOther,
          urgency: data.urgency,
          investment: data.investment,
          decision: data.decision,
          ...attribution.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Falha ao enviar.");

      trackEvent("form_complete");
      setAnalyzing(true);
      setAnalyzingLine(0);
      const t = json.tier as "hot" | "warm" | "cold";
      ANALYZING_LINES.forEach((_, i) => {
        setTimeout(() => setAnalyzingLine(i + 1), (i + 1) * 1000);
      });
      setTimeout(() => {
        setAnalyzing(false);
        setTier(t);
      }, 4000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Falha ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function goNext(opts?: { hasCompanyOverride?: boolean | null }) {
    const hasCompanyValue = opts?.hasCompanyOverride ?? data.hasCompany;
    if (step === "gate" && hasCompanyValue === false) {
      setEliminated(true);
      return;
    }
    if (step === "gate" && !startTracked.current) {
      // "Started the form" = genuinely advancing past the gate, not just
      // scrolling the section into view — matches the "form_start" event.
      startTracked.current = true;
      trackEvent("form_start");
    }
    if (step === "decision") {
      submit();
      return;
    }
    setStepIndex((i) => Math.min(STEP_KEYS.length - 1, i + 1));
  }

  // Single-choice steps advance on selection — picking an option is already
  // a complete answer, so a separate "Avançar" click is just extra friction.
  // Excluded: "goals" (multi-select), "intro" (free text), "decision" (needs
  // the consent checkbox too, and is the final submit rather than a next).
  function selectAndAdvance(opts?: { hasCompanyOverride?: boolean | null }) {
    setTimeout(() => goNext(opts), 220);
  }

  const questionNumber = Math.max(0, stepIndex - 2); // cover/gate/intro aren't scored questions
  const totalQuestions = STEP_KEYS.length - 3; // exclude cover + gate + intro
  const progress = tier
    ? 100
    : analyzing
      ? 100
      : eliminated
        ? 100
        : ((stepIndex + (canAdvance ? 0.5 : 0)) / STEP_KEYS.length) * 100;

  const showChrome = !eliminated && !tier && !analyzing && step !== "cover";

  const sceneKey = eliminated
    ? "eliminated"
    : tier === "cold"
      ? "result-cold"
      : tier === "hot" || tier === "warm"
        ? "result-approved"
        : analyzing
          ? "analyzing"
          : `step-${step}`;

  const progressRow = showChrome && (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink/40">
          {step === "gate"
            ? "triagem"
            : step === "intro"
              ? "dados iniciais"
              : `pergunta ${questionNumber} / ${totalQuestions}`}
        </span>
        <span className="font-mono text-[11px] text-ink/30 tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-sand/25">
        <motion.div
          className="h-full bg-green"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );

  const navRow = showChrome && (
    <div className="mt-7 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        disabled={stepIndex <= 1}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-ink/50 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-0"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <button
        type="button"
        disabled={!canAdvance || submitting}
        onClick={() => goNext()}
        className="group inline-flex items-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all duration-200 hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-green"
      >
        {step === "gate"
          ? "Continuar"
          : step === "intro"
            ? "Iniciar processo de qualificação"
            : step === "decision"
              ? submitting
                ? "Enviando…"
                : "Enviar respostas"
              : "Avançar"}
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>
    </div>
  );

  const trustFootnote = (
    <div className="mt-6 flex items-center gap-2 border-t border-sand-dark/20 pt-5 text-ink/30">
      <ShieldCheck className="h-3.5 w-3.5" />
      <span className="font-mono text-[11px] tracking-wide">
        seus dados são avaliados antes de qualquer contato humano
      </span>
    </div>
  );

  let body: React.ReactNode;

  if (eliminated) {
    body = (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand/25 text-ink/40 ring-1 ring-ink/10">
          <X className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-ink">
          Nossos projetos hoje são voltados para empresas em operação.
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/60">Obrigado pelo interesse na Tektone.</p>
      </div>
    );
  } else if (tier === "cold") {
    body = (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sand/25 text-ink/40 ring-1 ring-ink/10">
          <X className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-ink">Obrigado pela sua solicitação.</h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
          Com base nas suas respostas, este ainda não parece ser o momento ideal para avançarmos para uma call
          de diagnóstico com a Tektone.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
          Nosso modelo atual é direcionado a empresas em um momento específico de estrutura, investimento e
          execução. Quando esse cenário mudar, você poderá solicitar uma nova análise.
        </p>
      </div>
    );
  } else if (tier === "hot" || tier === "warm") {
    body = (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-subtle text-green ring-1 ring-green/30">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-ink">Sua empresa foi aprovada na análise inicial da Tektone.</h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
          Com base nas suas respostas há potencial para construirmos algo relevante juntos e faz sentido
          avançarmos para a próxima etapa.
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/60">
          Você terá acesso a uma call de diagnóstico diretamente com Pedro Silvestrini, fundador e CEO da
          Tektone. Para liberar o acesso à agenda, inicie o contato com nossa equipe pelo WhatsApp abaixo.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-6 inline-flex items-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all duration-200 hover:bg-green-hover"
        >
          AGENDAR MINHA CALL DE DIAGNÓSTICO
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </a>
      </div>
    );
  } else if (analyzing) {
    body = (
      <div className="flex flex-col items-center py-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-green/25 border-t-green"
        />
        <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink/60">
          Nossa IA está analisando suas respostas, cruzando as informações da sua empresa com os critérios de
          seleção da Tektone.
        </p>
        <div className="mt-6 space-y-2">
          {ANALYZING_LINES.map((line, i) => (
            <p
              key={line}
              className={`font-mono text-xs tracking-wide transition-opacity duration-500 ${
                i < analyzingLine ? "text-ink/50 opacity-100" : "opacity-0"
              }`}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  } else if (step === "cover") {
    body = (
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <p className="label-tech">Processo seletivo</p>
        <h2 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
          A Tektone seleciona seus parceiros.
        </h2>
        <p className="max-w-sm text-pretty leading-relaxed text-ink/60">
          Sem massa: no máximo duas empresas por mês, com o fundador presente em cada projeto. 9 perguntas
          rápidas para sabermos se há aderência.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-wide text-ink/40">
          {PROCESS_CHIPS.map((t, i) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full surface-paper text-[10px] text-green">
                {i + 1}
              </span>
              {t}
              {i < PROCESS_CHIPS.length - 1 && <span className="text-ink/20">→</span>}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => goNext()}
          className="group mt-2 inline-flex items-center gap-2 rounded-lg bg-green px-7 py-3.5 text-sm font-bold text-ivory transition-all duration-200 hover:bg-green-hover"
        >
          Começar
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
        <p className="font-mono text-[11px] tracking-wide text-ink/30">Leva menos de 5 minutos. Sem compromisso.</p>
      </div>
    );
  } else if (step === "gate") {
    body = (
      <div className="flex flex-col items-center gap-7 py-2 text-center">
        <h2 className="text-balance text-2xl font-bold leading-snug text-ink sm:text-3xl">
          Você tem uma empresa?
        </h2>
        <div className="grid w-full max-w-xs grid-cols-2 gap-3">
          {[
            { v: true, l: "Sim" },
            { v: false, l: "Não" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => {
                set("hasCompany", o.v);
                selectAndAdvance({ hasCompanyOverride: o.v });
              }}
              className={`rounded-xl border px-4 py-5 text-base font-semibold transition-all duration-150 ${
                data.hasCompany === o.v
                  ? "border-green bg-green-subtle text-ink"
                  : "border-sand-dark/25 bg-paper text-ink/60 hover:border-sand-dark/50"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (step === "intro") {
    body = (
      <div className="space-y-5">
        <Field label="Nome">
          <input
            className={inputCls}
            placeholder="Seu nome"
            value={data.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            className={inputCls}
            placeholder="voce@empresa.com"
            value={data.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="WhatsApp">
          <input
            className={inputCls}
            placeholder="(00) 00000-0000"
            value={data.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="@ do Instagram (opcional)">
          <input
            className={inputCls}
            placeholder="@seuinstagram"
            value={data.instagram}
            onChange={(e) => set("instagram", e.target.value)}
          />
        </Field>
      </div>
    );
  } else if (step === "businessType") {
    body = (
      <Field label="Qual dessas opções melhor descreve sua empresa?">
        <ChoiceList
          options={businessTypeOptions}
          value={data.businessType}
          onChange={(v) => {
            set("businessType", v);
            if (v !== "outro") selectAndAdvance();
          }}
        />
        {data.businessType === "outro" && (
          <input
            className={`${inputCls} mt-2`}
            placeholder="Qual?"
            value={data.businessTypeOther}
            onChange={(e) => set("businessTypeOther", e.target.value)}
          />
        )}
      </Field>
    );
  } else if (step === "teamSize") {
    body = (
      <Field label="Quantas pessoas trabalham hoje na empresa?">
        <ChoiceList
          options={teamSizeOptions}
          value={data.teamSize}
          onChange={(v) => {
            set("teamSize", v);
            selectAndAdvance();
          }}
        />
      </Field>
    );
  } else if (step === "revenue") {
    body = (
      <Field label="Qual o faturamento mensal da sua empresa em média?">
        <ChoiceList
          options={revenueOptions}
          value={data.revenue}
          onChange={(v) => {
            set("revenue", v);
            selectAndAdvance();
          }}
        />
      </Field>
    );
  } else if (step === "moment") {
    body = (
      <Field label="Qual dessas frases melhor representa o momento da sua empresa hoje?">
        <ChoiceList
          options={momentOptions}
          value={data.moment}
          onChange={(v) => {
            set("moment", v);
            selectAndAdvance();
          }}
        />
      </Field>
    );
  } else if (step === "goals") {
    body = (
      <Field label="O que você gostaria de resolver ou construir na sua empresa hoje? (pode selecionar mais de uma)">
        <div className="grid gap-2">
          {goalsOptions.map((g) => {
            const active = data.goals.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGoal(g)}
                className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-left text-[15px] leading-snug transition-all duration-150 ${
                  active
                    ? "border-green bg-green-subtle text-ink"
                    : "border-sand-dark/25 bg-paper text-ink/60 hover:border-sand-dark/50"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    active ? "border-green bg-green text-ivory" : "border-sand-dark/40"
                  }`}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
                {g}
              </button>
            );
          })}
        </div>
        {data.goals.includes("Outro") && (
          <input
            className={`${inputCls} mt-2`}
            placeholder="Qual?"
            value={data.goalsOther}
            onChange={(e) => set("goalsOther", e.target.value)}
          />
        )}
      </Field>
    );
  } else if (step === "urgency") {
    body = (
      <Field label="Caso identifiquemos uma oportunidade clara de melhoria, em quanto tempo você estaria disposto a começar?">
        <ChoiceList
          options={urgencyOptions}
          value={data.urgency}
          onChange={(v) => {
            set("urgency", v);
            selectAndAdvance();
          }}
        />
      </Field>
    );
  } else if (step === "investment") {
    body = (
      <Field label="A Tektone desenvolve projetos sob medida, com investimentos a partir de R$ 20.000. Você está preparado para esse investimento?">
        <ChoiceList
          options={investmentOptions}
          value={data.investment}
          onChange={(v) => {
            set("investment", v);
            selectAndAdvance();
          }}
        />
      </Field>
    );
  } else {
    // step === "decision"
    body = (
      <>
        <Field label="Caso exista aderência para avançarmos, qual é o seu nível de participação na decisão?">
          <ChoiceList options={decisionOptions} value={data.decision} onChange={(v) => set("decision", v)} />
        </Field>
        <label className="mt-5 flex items-start gap-2.5 text-xs leading-relaxed text-ink/50">
          <input
            type="checkbox"
            checked={data.consent}
            onChange={(e) => set("consent", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-sand-dark/40 text-green focus:ring-green"
          />
          Ao enviar este formulário, você concorda com o tratamento dos seus dados pessoais pela Tektone para
          análise da sua solicitação, contato comercial, condução do processo de qualificação e envio de
          comunicações de marketing (novidades, conteúdos e ofertas). Você pode revogar esse consentimento a
          qualquer momento, conforme nossa{" "}
          <a href="/politica-de-privacidade" className="underline hover:text-ink">
            Política de Privacidade
          </a>
          .
        </label>
        {submitError && <p className="mt-3 text-xs text-danger">{submitError}</p>}
      </>
    );
  }

  const sceneContent = (
    <>
      {progressRow}
      {body}
      {navRow}
      {showChrome && trustFootnote}
    </>
  );

  return (
    <section id="qualificacao" className="relative bg-ivory overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-40 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="ochre" className="-right-28 bottom-0 h-[30rem] w-[30rem]" />
      <ParchmentStage stageKey={sceneKey} tier={deviceTier}>
        {sceneContent}
      </ParchmentStage>
    </section>
  );
}
