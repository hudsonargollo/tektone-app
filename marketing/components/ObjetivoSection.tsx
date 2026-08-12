"use client";

import { motion } from "framer-motion";
import { Clock, Rocket, TrendingUp } from "lucide-react";
import SectionBlob from "@/components/SectionBlob";
import GoldenRibbons from "@/components/GoldenRibbons";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// Card treatment adapted from a CodePen reference (GSAP team-grid cards:
// layered shadow, diagonal gloss overlay, hover lift+tilt). Kept the
// *mechanics* — depth via stacked shadows, a subtle inset gloss, a slight
// rotation that straightens on hover — but swapped the reference's bold
// saturated orange gradient for Tektone's own restrained palette (a paper
// surface with a soft corner tint per card), since a loud full-bleed
// gradient would fight the rest of the site's editorial, muted language.
const PROFILES = [
  {
    icon: Clock,
    tone: "green" as const,
    title: "Alguns querem recuperar o próprio tempo.",
    body: "Construíram uma empresa que depende demais deles e precisam criar uma operação mais organizada, eficiente e preparada para funcionar melhor.",
    rot: -2,
  },
  {
    icon: Rocket,
    tone: "ochre" as const,
    title: "Outros querem transformar uma ideia em realidade.",
    items: [
      "Criar um aplicativo.",
      "Lançar um produto.",
      "Construir uma nova marca.",
      "Criar uma nova fonte de receita.",
    ],
    rot: 1.5,
  },
  {
    icon: TrendingUp,
    tone: "sand" as const,
    title: "Outros sabem que existe mais potencial dentro da empresa atual.",
    items: [
      "Vender mais.",
      "Melhorar processos.",
      "Aumentar eficiência.",
      "Encontrar novas oportunidades.",
      "Explorar caminhos que ainda não foram construídos.",
    ],
    rot: -1,
  },
];

const TONE_STYLES = {
  green: {
    tint: "radial-gradient(circle at 85% 15%, rgba(46,74,67,0.14), transparent 60%)",
    badge: "bg-green-subtle text-green",
  },
  ochre: {
    tint: "radial-gradient(circle at 85% 15%, rgba(184,134,47,0.16), transparent 60%)",
    badge: "bg-[#B8862F]/12 text-[#8A6423]",
  },
  sand: {
    tint: "radial-gradient(circle at 85% 15%, rgba(169,151,111,0.18), transparent 60%)",
    badge: "bg-sand/25 text-sand-dark",
  },
};

export default function ObjetivoSection() {
  return (
    <section className="relative bg-ivory py-16 sm:py-24 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="sand" className="-left-24 top-0 h-[28rem] w-[28rem]" />
      <GoldenRibbons className="pointer-events-none absolute -right-[3%] top-0 h-[46%] w-[54%] opacity-30" />

      <div className="relative mx-auto max-w-6xl px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto max-w-3xl text-balance border-l-2 border-green pl-6 text-3xl sm:text-4xl font-bold leading-snug tracking-display text-ink"
        >
          Cada empresário chega até a Tektone buscando construir algo
          diferente.
        </motion.p>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {PROFILES.map((p, i) => {
            const Icon = p.icon;
            const styles = TONE_STYLES[p.tone];
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 32, rotate: p.rot * 3 }}
                whileInView={{ opacity: 1, y: 0, rotate: p.rot }}
                whileHover={{ y: -8, rotate: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
                className="group relative rounded-2xl surface-paper-raised p-7"
                style={{
                  boxShadow:
                    "0 20px 34px -18px rgba(20,22,24,0.14), 0 8px 16px -8px rgba(20,22,24,0.08)",
                }}
              >
                {/* Corner tint (per-card brand color) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{ background: styles.tint }}
                  aria-hidden
                />
                {/* Diagonal gloss, reference's card technique — much
                    fainter here to match the site's restraint */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.35] transition-opacity duration-500 group-hover:opacity-[0.55]"
                  style={{
                    background:
                      "linear-gradient(155deg, rgba(255,255,255,0.5) 0%, transparent 32%, transparent 70%, rgba(20,22,24,0.04) 100%)",
                  }}
                  aria-hidden
                />

                <div className="relative">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${styles.badge}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <p className="mt-5 text-balance text-xl font-bold leading-snug tracking-tightish text-ink">
                    {p.title}
                  </p>

                  {p.body && (
                    <p className="mt-3 text-pretty text-sm leading-relaxed text-ink/60">
                      {p.body}
                    </p>
                  )}

                  {p.items && (
                    <ul className="mt-3 space-y-1.5">
                      {p.items.map((item) => (
                        <li
                          key={item}
                          className="text-pretty text-sm leading-relaxed text-ink/60"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          className="label-tech mx-auto mt-14 max-w-3xl pt-2 text-center"
        >
          O objetivo muda. O desafio muda.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
          className="text-editorial mx-auto mt-6 max-w-3xl text-balance border-l-2 border-green pl-6 text-2xl sm:text-3xl leading-snug text-ink"
        >
          Mas todos chegam com a mesma dúvida interna: &ldquo;Quais decisões
          eu preciso tomar para chegar onde quero?&rdquo;
        </motion.p>
      </div>
    </section>
  );
}
