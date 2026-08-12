"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// Video block (hub-tektone.mp4 in a glossy gold frame) temporarily
// removed — not ready to show yet. Section still stands on its own as a
// text + CTA moment; re-add the frame-gold/vignette-frame video block
// below (git history has the exact markup, see the commit that removed
// this comment) once there's a version ready to ship.
export default function HubTektoneSection() {
  return (
    <section className="relative overflow-hidden bg-ink-950 py-16 sm:py-24">
      <div className="absolute inset-0 bp-lines-ink opacity-40" aria-hidden />
      <div className="absolute inset-0 grain-dark" aria-hidden />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8 flex justify-center"
        >
          <Logo variant="ivory" className="h-14 w-auto opacity-90" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="text-balance text-2xl sm:text-4xl font-bold leading-snug tracking-display text-ivory"
        >
          Hub Tektone. A operação do seu projeto, exposta em tempo real.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
          className="text-pretty mx-auto mt-4 max-w-xl text-base sm:text-lg leading-relaxed text-sand/80"
        >
          Cada tarefa vive aqui, aberta e visível. Sem reuniões pra saber
          onde o projeto está. Sem relatórios inventados. Sem caixa-preta.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
        className="relative mt-14 flex justify-center"
      >
        <a
          href="#qualificacao"
          className="group inline-flex items-center gap-2.5 rounded-lg bg-green px-7 py-4 text-base font-bold tracking-wide text-ivory transition-all duration-200 hover:bg-green-hover glow-action-ink"
        >
          <span>AGENDAR CALL DE QUALIFICAÇÃO</span>
          <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </motion.div>
    </section>
  );
}
