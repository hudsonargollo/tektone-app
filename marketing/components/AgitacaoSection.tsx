"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import SectionBlob from "@/components/SectionBlob";
import GoldenRibbons from "@/components/GoldenRibbons";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function AgitacaoSection() {
  return (
    <section className="relative bg-ivory pt-28 pb-12 sm:pt-36 sm:pb-16 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="sand" className="-left-24 -top-10 h-96 w-96" />

      {/* Fourth pass: a real flat-color vector bust (genuine alpha
          transparency, generated via Gemini + chroma-key removal — see
          public/illustration-candidates/) replaces the old sepia-engraving
          grid, which needed an increasingly elaborate CSS mask just to hide
          its own hard rectangular edge. object-contain is correct here
          (not object-cover, unlike the painterly full-bleed illustrations
          elsewhere) since the source PNG's own alpha already defines the
          silhouette — no fade trick needed to hide a background that no
          longer exists. */}
      <div
        className="pointer-events-none absolute -right-[6%] top-1/2 h-[92%] w-[38%] -translate-y-1/2 opacity-[0.9] mix-blend-multiply sm:w-[32%]"
        aria-hidden
      >
        <Image src="/bust-ink.png" alt="" fill sizes="32vw" className="object-contain object-right" />
      </div>
      <GoldenRibbons className="pointer-events-none absolute -right-[4%] top-1/2 h-[80%] w-[58%] -translate-y-1/2 opacity-50" />

      <div className="relative mx-auto max-w-3xl px-6">
        <div className="space-y-8">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-balance text-2xl sm:text-3xl leading-snug text-ink/70"
          >
            O mercado oferece ferramentas, sistemas e plataformas.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="text-balance border-l-2 border-green pl-6 text-3xl sm:text-4xl font-bold leading-snug tracking-display text-ink"
          >
            Mas nada disso foi feito sob medida para a sua empresa.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
            className="label-tech pt-4"
          >
            Da identificação do gargalo à construção de um novo ativo
          </motion.p>
        </div>
      </div>
    </section>
  );
}
