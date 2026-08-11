"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import HubBoard from "@/components/HubBoard";
import Logo from "@/components/Logo";

/**
 * Scroll-driven cinematic sequence — the page's storytelling centerpiece.
 * A tall scroll track with a sticky viewport; scroll position drives a
 * single continuous "camera move" across the Hub Tektone mock board,
 * native framer-motion, no video asset.
 *
 * Beats (proportional to the source 35s script):
 * 0.00–0.14  black screen, logo forms
 * 0.14–0.30  cut to the Hub, camera settles on the board
 * 0.30–0.48  zoom on the three columns
 * 0.48–0.66  highlight a card (deadline + assignee)
 * 0.66–0.82  pull back to the full board
 * 0.82–1.00  fade to black, closing line, logo + CTA
 */

const BP = [0, 0.14, 0.3, 0.48, 0.66, 0.82, 1];

function useBeat(
  progress: ReturnType<typeof useScroll>["scrollYProgress"],
  start: number,
  end: number,
  inset = 0.02
) {
  return useTransform(
    progress,
    [start, Math.min(start + inset, end), Math.max(end - inset, start), end],
    [0, 1, 1, 0]
  );
}

export default function HubTektoneSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Camera — scale and pan across the board
  const boardScale = useTransform(
    scrollYProgress,
    BP,
    [0.92, 0.92, 1.28, 1.7, 1, 1, 1]
  );
  const boardX = useTransform(
    scrollYProgress,
    BP,
    [0, 0, 0, "-8%", 0, 0, 0]
  );
  const boardY = useTransform(
    scrollYProgress,
    BP,
    [24, 24, -10, -18, 0, 0, 0]
  );
  const boardOpacity = useTransform(
    scrollYProgress,
    [0, BP[1], BP[1] + 0.03, BP[4], BP[4] + 0.06],
    [0, 0, 1, 1, 0]
  );

  // Black overlay — opaque at the open and the close, transparent while the
  // board is on screen
  const overlayOpacity = useTransform(
    scrollYProgress,
    [0, BP[1], BP[1] + 0.04, BP[4] + 0.02, BP[4] + 0.08, 1],
    [1, 1, 0, 0, 1, 1]
  );

  // Opening logo (beat 0)
  const openLogoOpacity = useTransform(
    scrollYProgress,
    [0, BP[1] * 0.6, BP[1]],
    [0, 1, 0]
  );
  const openLogoScale = useTransform(
    scrollYProgress,
    [0, BP[1]],
    [0.85, 1.05]
  );

  // Closing logo + CTA (tail of beat 5)
  const closeStart = BP[5] + 0.08;
  const closeOpacity = useTransform(
    scrollYProgress,
    [closeStart, closeStart + 0.06],
    [0, 1]
  );
  const ctaPointerEvents = useTransform(scrollYProgress, (v) =>
    v > closeStart + 0.05 ? "auto" : "none"
  );

  const captions = [
    useBeat(scrollYProgress, BP[0], BP[1]),
    useBeat(scrollYProgress, BP[1], BP[2]),
    useBeat(scrollYProgress, BP[2], BP[3]),
    useBeat(scrollYProgress, BP[3], BP[4]),
    useBeat(scrollYProgress, BP[4], BP[5]),
  ];
  const closingLineOpacity = useTransform(
    scrollYProgress,
    [BP[5] + 0.02, closeStart, closeStart + 0.02, closeStart + 0.06],
    [0, 1, 1, 0]
  );

  // Highlight-card beat — drives the spotlight ring/scale on the one card
  // with a deadline + assignee, entirely through motion values (no React
  // state, so it stays in sync with scroll on every frame)
  const highlightIntensity = useBeat(scrollYProgress, BP[3], BP[4], 0.03);

  return (
    <section ref={sectionRef} className="relative h-[420vh] bg-ink-950">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 bp-lines-ink opacity-40" aria-hidden />
        <div className="absolute inset-0 grain-dark" aria-hidden />

        {/* Camera stage */}
        <motion.div
          style={{ opacity: boardOpacity, scale: boardScale, x: boardX, y: boardY }}
          className="absolute inset-0 flex items-center justify-center px-6"
        >
          <HubBoard highlightIntensity={highlightIntensity} />
        </motion.div>

        {/* Opening logo */}
        <motion.div
          style={{ opacity: openLogoOpacity, scale: openLogoScale }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Logo variant="ivory" className="h-16 w-auto opacity-90" />
        </motion.div>

        {/* Black overlay for open/close beats */}
        <motion.div
          aria-hidden
          style={{ opacity: overlayOpacity }}
          className="pointer-events-none absolute inset-0 bg-ink-950"
        />

        {/* Closing line */}
        <motion.p
          style={{ opacity: closingLineOpacity }}
          className="text-balance pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-2xl sm:text-4xl font-bold leading-snug tracking-display text-ivory"
        >
          Hub Tektone. A operação do seu projeto, exposta em tempo real.
        </motion.p>

        {/* Closing logo + CTA */}
        <motion.div
          style={{ opacity: closeOpacity, pointerEvents: ctaPointerEvents }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-8"
        >
          <Logo variant="ivory" className="h-14 w-auto" />
          <a
            href="#qualificacao"
            className="group inline-flex items-center gap-2.5 rounded-lg bg-green px-7 py-4 text-base font-bold tracking-wide text-ivory transition-all duration-200 hover:bg-green-hover glow-action-ink"
          >
            <span>AGENDAR CALL DE QUALIFICAÇÃO</span>
            <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </motion.div>

        {/* Captions */}
        {[
          "No mercado, contratar tecnologia virou sinônimo de esperar no escuro.",
          "Na Tektone, não.",
          "Cada tarefa do seu projeto vive aqui. Aberta. Visível. Em tempo real.",
          "Você acompanha o que está sendo feito, por quem, e para quando.",
          "Sem reuniões pra saber onde o projeto está. Sem relatórios inventados. Sem caixa-preta.",
        ].map((line, i) => (
          <motion.p
            key={line}
            style={{ opacity: captions[i] }}
            className="text-balance pointer-events-none absolute inset-x-0 bottom-14 px-6 text-center text-lg sm:text-2xl font-medium leading-snug text-ivory"
          >
            {line}
          </motion.p>
        ))}
      </div>
    </section>
  );
}
