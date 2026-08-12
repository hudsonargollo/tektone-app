"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const criteria = [
  {
    title: "Já validaram o negócio",
    detail: "clientes recorrentes, receita consolidada, operação rodando",
  },
  {
    title: "Operam abaixo do próprio potencial",
    detail: "processos manuais, ferramentas que não conversam, time sobrecarregado",
  },
  {
    title: "Querem estrutura, não paliativo",
    detail: "arquitetura integrada, não “mais uma ferramenta genérica”",
  },
  {
    title: "Valorizam parceria de longo prazo",
    detail: "alguém que entende o jogo, diagnostica fundo, constrói com visão de futuro",
  },
];

export default function QualificacaoFitSection() {
  return (
    <section className="relative bg-ivory py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="green" className="-left-24 bottom-0 h-[28rem] w-[28rem]" />

      {/* Second pass: no corner illustration here. This section is a dense
          2x2 requirement grid — the "concise" system means not every
          section gets one of the shared column motifs; a busy functional
          grid reads cleaner without decorative art competing for corner
          space. SectionBlob + grain + dots carry the section's identity. */}

      <div className="relative mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-14 max-w-2xl"
        >
          <p className="label-tech mb-4">Na prática</p>
          <h2 className="text-balance text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-display text-ink">
            Criamos parcerias somente com empresários que se encaixam nos
            requisitos.
          </h2>
          <p className="mt-4 text-lg text-ink/60">
            Por isso, selecionamos empresários que:
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {criteria.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
              className="flex items-start gap-4 rounded-xl surface-paper p-6"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green text-ivory">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-ink">{c.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">
                  {c.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="mt-10 rounded-xl border border-sand-dark/30 bg-paper p-8 text-center"
        >
          <p className="text-balance text-xl sm:text-2xl font-semibold tracking-tightish leading-snug text-ink">
            Porque são duas empresas por mês. Não mais do que isso.
          </p>
          <p className="mt-3 text-pretty mx-auto max-w-xl leading-relaxed text-ink/60">
            Esse é o limite para manter o fundador presente, o diagnóstico
            profundo e a qualidade que uma solução sob medida exige.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button size="lg" nativeButton={false} render={<a href="#qualificacao" />}>
              AGENDAR CALL DE QUALIFICAÇÃO
            </Button>
            <p className="font-mono text-xs tracking-wide text-ink/50">
              Leva menos de 3 minutos. Sem compromisso.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
