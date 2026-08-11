"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Check, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import SectionBlob from "@/components/SectionBlob";

const steps = [
  {
    n: 1,
    title: "Briefing",
    desc: "Identidade & negócio",
    friction: "micro-atrito",
  },
  {
    n: 2,
    title: "Qualificação",
    desc: "Estágio & faturamento",
    friction: "atrito mediano",
  },
  {
    n: 3,
    title: "Dedicação",
    desc: "Orçamento & expectativa",
    friction: "atrito máximo",
  },
];

const estagios = ["Validação", "Tração", "Escala", "Consolidação"];
const gargalos = [
  "Tecnologia / Produto",
  "Tráfego / Aquisição",
  "Operação / Processos",
  "Automação / IA",
];
const faturamentos = [
  "até R$ 50k/mês",
  "R$ 50k – R$ 200k",
  "R$ 200k – R$ 1M",
  "acima de R$ 1M",
];
const orcamentos = [
  "R$ 10k – R$ 30k",
  "R$ 30k – R$ 80k",
  "acima de R$ 80k",
];

type FormState = {
  nome: string;
  email: string;
  site: string;
  estagio: string;
  gargalo: string;
  faturamento: string;
  orcamento: string;
  expectativa: string;
};

const empty: FormState = {
  nome: "",
  email: "",
  site: "",
  estagio: "",
  gargalo: "",
  faturamento: "",
  orcamento: "",
  expectativa: "",
};

function ChoiceGrid({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  cols?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
    >
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition-all duration-150 ${
              active
                ? "border-green bg-green-subtle text-ink"
                : "border-sand-dark/25 bg-paper text-ink/60 hover:border-sand-dark/50"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase text-ink/40">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-sand-dark/25 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink/30 outline-none transition-colors focus:border-green";

export default function QualificacaoSection() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormState>(empty);
  const [done, setDone] = useState(false);

  const set = (k: keyof FormState, v: string) =>
    setData((d) => ({ ...d, [k]: v }));

  const canAdvance =
    step === 0
      ? data.nome && data.email && data.site
      : step === 1
        ? data.estagio && data.gargalo && data.faturamento
        : data.orcamento && data.expectativa.trim().length > 10;

  const progress = done ? 100 : ((step + (canAdvance ? 0.5 : 0)) / 3) * 100;

  return (
    <section id="qualificacao" className="relative bg-ivory py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-40 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="ochre" className="-right-28 bottom-0 h-[30rem] w-[30rem]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* Left — pitch / selection rationale */}
          <div>
            <p className="label-tech mb-4">Processo seletivo</p>
            <h2 className="text-balance text-3xl sm:text-4xl font-bold leading-tight text-ink">
              A Tektone seleciona seus parceiros.
            </h2>
            <p className="mt-5 text-pretty leading-relaxed text-ink/60">
              Não somos uma consultoria de massas. Operamos com no máximo duas
              empresas por mês para garantir presença ativa do fundador em
              cada projeto.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-ink/60">
              Esta call funciona como um filtro de alta performance: você
              coloca o que está travado, nós analisamos o gargalo, e você sai
              com o mapa técnico e estratégico para a solução.
            </p>

            <ol className="mt-9 space-y-4">
              {[
                {
                  t: "Formulário",
                  d: "Briefing rápido sobre seu estágio atual.",
                },
                {
                  t: "Análise interna",
                  d: "Avaliamos potencial de escala e ROI.",
                },
                {
                  t: "Call de diagnóstico",
                  d: "Reunião estratégica para candidatos qualificados.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md surface-paper font-mono text-xs text-green">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{s.t}</p>
                    <p className="text-sm text-ink/50">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 font-mono text-xs tracking-wide text-ink/40">
              Leva menos de 3 minutos. Sem compromisso.
            </p>
          </div>

          {/* Right — multi-step form */}
          <div className="rounded-2xl surface-paper-raised p-6 sm:p-8">
            {/* Progress */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-ink/40">
                  {done
                    ? "candidatura enviada"
                    : `etapa ${step + 1} / 3 · ${steps[step].friction}`}
                </span>
                <span className="font-mono text-[11px] text-ink/30 tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-sand/25">
                <motion.div
                  className="h-full bg-green"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              {/* Step pips */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {steps.map((s, i) => (
                  <div
                    key={s.n}
                    className={`rounded-lg border px-3 py-2 transition-colors ${
                      i === step && !done
                        ? "border-green/40 bg-green-subtle"
                        : i < step || done
                          ? "border-sand-dark/25 bg-paper"
                          : "border-sand-dark/10 bg-transparent opacity-50"
                    }`}
                  >
                    <p className="font-mono text-[11px] text-ink/40">
                      {String(s.n).padStart(2, "0")}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-ink/70">
                      {s.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-10 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-subtle text-green ring-1 ring-green/30">
                    <Check className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-ink">
                    Candidatura recebida.
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/60">
                    Nossa equipe vai avaliar o potencial de escala do seu negócio.
                    Candidatos qualificados recebem o convite para a call de
                    diagnóstico em até 48h.
                  </p>
                  <p className="mt-5 font-mono text-[11px] tracking-wide text-ink/40">
                    {data.nome.split(" ")[0]} · {data.email}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  {step === 0 && (
                    <>
                      <Field label="Nome completo">
                        <input
                          className={inputCls}
                          placeholder="Seu nome"
                          value={data.nome}
                          onChange={(e) => set("nome", e.target.value)}
                        />
                      </Field>
                      <Field label="E-mail corporativo">
                        <input
                          type="email"
                          className={inputCls}
                          placeholder="voce@empresa.com"
                          value={data.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                      </Field>
                      <Field label="Website do negócio">
                        <input
                          className={inputCls}
                          placeholder="empresa.com.br"
                          value={data.site}
                          onChange={(e) => set("site", e.target.value)}
                        />
                      </Field>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Field label="Estágio operacional">
                        <ChoiceGrid
                          options={estagios}
                          value={data.estagio}
                          onChange={(v) => set("estagio", v)}
                        />
                      </Field>
                      <Field label="Gargalo central ativo">
                        <ChoiceGrid
                          options={gargalos}
                          value={data.gargalo}
                          onChange={(v) => set("gargalo", v)}
                        />
                      </Field>
                      <Field label="Faturamento mensal bruto">
                        <ChoiceGrid
                          options={faturamentos}
                          value={data.faturamento}
                          onChange={(v) => set("faturamento", v)}
                        />
                      </Field>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <Field label="Faixa de orçamento de intervenção">
                        <ChoiceGrid
                          options={orcamentos}
                          value={data.orcamento}
                          onChange={(v) => set("orcamento", v)}
                          cols={3}
                        />
                      </Field>
                      <Field label="O que você espera da parceria?">
                        <textarea
                          rows={4}
                          className={`${inputCls} resize-none`}
                          placeholder="Descreva o resultado que você precisa atingir e o prazo…"
                          value={data.expectativa}
                          onChange={(e) => set("expectativa", e.target.value)}
                        />
                      </Field>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nav */}
            {!done && (
              <div className="mt-7 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm text-ink/50 transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>

                {step < 2 ? (
                  <button
                    type="button"
                    disabled={!canAdvance}
                    onClick={() => setStep((s) => s + 1)}
                    className="group inline-flex items-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all duration-200 hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-green"
                  >
                    {step === 0
                      ? "Avançar para qualificação"
                      : "Avançar para dedicação"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAdvance}
                    onClick={() => setDone(true)}
                    className="group inline-flex items-center gap-2 rounded-lg bg-green px-5 py-3 text-sm font-bold text-ivory transition-all duration-200 hover:bg-green-hover disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-green"
                  >
                    Enviar candidatura
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>
            )}

            {/* Trust footnote */}
            <div className="mt-6 flex items-center gap-2 border-t border-sand-dark/20 pt-5 text-ink/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-mono text-[11px] tracking-wide">
                seus dados são avaliados antes de qualquer contato humano
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
