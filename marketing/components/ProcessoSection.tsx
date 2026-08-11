"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ScanSearch,
  Layers,
  TrendingUp,
  AppWindow,
  Bot,
  Megaphone,
  Workflow,
  Users,
  Globe,
} from "lucide-react";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const capabilities = [
  { icon: AppWindow, label: "Aplicativos mobile e plataformas web" },
  { icon: Bot, label: "Agentes de IA" },
  {
    icon: Megaphone,
    label: "Posicionamento estratégico e construção de autoridade/audiência",
  },
  {
    icon: Workflow,
    label: "Estruturas de aquisição, vendas e retenção integradas ao produto",
  },
  { icon: Users, label: "CRMs adaptados ao seu processo comercial" },
  { icon: Globe, label: "SEO integrado ao produto" },
];

const phases = [
  {
    n: "Fase 1",
    icon: ScanSearch,
    title: "Call de diagnóstico",
    body: "Diagnosticamos o problema real da sua empresa em uma reunião.",
  },
  {
    n: "Fase 2",
    icon: Layers,
    title: "Construímos a solução exata em 30 dias",
    body: "Construímos tecnologia proprietária que resolve o gargalo exato que identificamos, seja ele:",
    capabilities,
  },
  {
    n: "Fase 3",
    icon: TrendingUp,
    title: "Transforme sua solução em uma nova receita",
    body: "Transformamos a tecnologia em um SaaS vendável e escalável. A Tektone conduz o crescimento; você participa da receita recorrente e do equity do negócio.",
  },
];

export default function ProcessoSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 65%", "end 65%"],
  });
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="processo" className="relative bg-ivory pt-12 pb-28 sm:pt-16 sm:pb-36 overflow-hidden">
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="green" className="-right-32 top-1/3 h-[30rem] w-[30rem]" />
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-16">
          <p className="label-tech mb-4">Nossa arquitetura de construção</p>
          <h2 className="text-balance text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-display text-ink">
            Três fases. Um ativo novo no final.
          </h2>
        </div>

        <div ref={containerRef} className="relative">
          {/* Connecting rail — fills as the phases are read, foundation to peak */}
          <div
            aria-hidden
            className="absolute left-6 top-2 bottom-2 w-px bg-sand-dark/25 sm:left-7"
          />
          <motion.div
            aria-hidden
            className="absolute left-6 top-2 bottom-2 w-px origin-top bg-green sm:left-7"
            style={{ scaleY: railScale }}
          />

          <ol className="space-y-14">
            {phases.map((phase, i) => {
              const Icon = phase.icon;
              return (
                <motion.li
                  key={phase.n}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
                  className="relative pl-16 sm:pl-20"
                >
                  <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-full surface-paper-raised text-green sm:h-14 sm:w-14">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>

                  <p className="label-tech mb-2">{phase.n}</p>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tightish text-ink">
                    {phase.title}
                  </h3>
                  <p className="mt-3 text-pretty leading-relaxed text-ink/70">
                    {phase.body}
                  </p>

                  {phase.capabilities && (
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {phase.capabilities.map((cap) => {
                        const CapIcon = cap.icon;
                        return (
                          <li
                            key={cap.label}
                            className="flex items-start gap-3 rounded-lg surface-paper px-4 py-3"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-subtle text-green">
                              <CapIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="pt-1 text-sm leading-snug text-ink/80">
                              {cap.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </motion.li>
              );
            })}
          </ol>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-editorial mt-16 text-balance border-l-2 border-green pl-6 text-2xl sm:text-3xl leading-snug text-ink"
        >
          Por isso, na Tektone você não é só um cliente, você é nosso
          parceiro.
        </motion.p>
      </div>
    </section>
  );
}
