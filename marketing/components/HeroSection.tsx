"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import ColumnBlueprint from "@/components/ColumnBlueprint";
import Logo from "@/components/Logo";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: EASE },
  }),
};

// Word-by-word headline reveal. The second sentence — the resolution —
// carries the brand accent; the first sentence, the problem, stays neutral.
const headWords = [
  { t: "A" },
  { t: "tecnologia" },
  { t: "certa" },
  { t: "pode" },
  { t: "resolver" },
  { t: "qualquer" },
  { t: "problema" },
  { t: "da" },
  { t: "sua" },
  { t: "empresa." },
  { t: "A", hl: true },
  { t: "Tektone", hl: true },
  { t: "constrói", hl: true },
  { t: "essa", hl: true },
  { t: "solução.", hl: true },
];

const headContainer: Variants = {
  hidden: {},
  show: {
    transition: { delayChildren: 0.3, staggerChildren: 0.045 },
  },
};

const headWord: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: EASE },
  },
};

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-ink-950"
    >
      {/* Structural backdrop — stepped foundation + rising flutes */}
      <div className="absolute inset-0 bp-lines-ink mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-dark" aria-hidden />
      <div className="absolute inset-0 opacity-80 mask-fade" aria-hidden>
        <ColumnBlueprint />
      </div>

      {/* Third pass: the columns-under-construction scene now shares the
          same visual plane as the bp-lines-ink grid above instead of
          living in its own thin strip below it — tall enough (85% of the
          section) to actually read as atmosphere behind the whole hero,
          not just a sliver pasted along the bottom edge. mask-fade-top
          still feathers the top into the dark background so the headline
          column stays legible; opacity is higher than the first attempt
          (0.09) since that read as barely-there against a busy scene. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] opacity-[0.32] mix-blend-screen mask-fade-top"
        aria-hidden
      >
        <Image
          src="/hero-columns-construction.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom"
          priority
        />
      </div>

      {/* Single, contained light source — never a neon halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-6%] left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-[#A1AEAA] opacity-[0.06] blur-[160px]"
      />

      {/* Measuring line — one precise sweep on load, not a repeating loop */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-sand/40 to-transparent"
        initial={{ top: "14%", opacity: 0 }}
        animate={{ top: "82%", opacity: [0, 0.7, 0.7, 0] }}
        transition={{ duration: 2.4, ease: EASE, delay: 1.1 }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-28 pb-20 text-center">
        {/* Wordmark */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mb-10 flex justify-center"
        >
          <Logo variant="ivory" className="h-16 w-auto sm:h-[4.5rem]" />
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="label-tech-ink mb-6"
        >
          Consultoria de Tecnologia &amp; Negócios, Sob Medida
        </motion.p>

        {/* Headline — word-by-word reveal */}
        <motion.h1
          variants={headContainer}
          initial="hidden"
          animate="show"
          className="flex flex-wrap justify-center gap-x-[0.28em] gap-y-1 text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.12] tracking-display text-ivory"
        >
          {headWords.map((w, i) => (
            <motion.span
              key={i}
              variants={headWord}
              className={w.hl ? "text-green-mist" : ""}
            >
              {w.t}
            </motion.span>
          ))}
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-pretty mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-sand"
        >
          Transformamos necessidades empresariais em produtos, sistemas e
          ativos digitais construídos para gerar eficiência, diferenciação e
          escala.
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-10 flex flex-col items-center gap-4"
        >
          <a
            href="#qualificacao"
            className="group inline-flex items-center gap-2.5 rounded-lg bg-green px-7 py-4 text-base font-bold tracking-wide text-ivory transition-all duration-200 hover:bg-green-hover active:bg-green-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mist glow-action-ink"
          >
            <span>AGENDAR CALL DE QUALIFICAÇÃO</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
          <p className="font-mono text-xs tracking-wide text-sand/70">
            Leva menos de 3 minutos. Sem compromisso.
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.7 }}
      >
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-ivory/15 p-1">
          <motion.div
            className="h-1.5 w-1 rounded-full bg-sand"
            animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
