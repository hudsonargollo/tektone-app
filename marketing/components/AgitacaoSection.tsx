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
      <SectionBlob tone="sand" className="-right-20 -top-24 h-96 w-96" />

      {/* Third pass: own generated illustration, tied to this section's
          copy — "o mercado oferece ferramentas, sistemas e plataformas, mas
          nada sob medida". A stockyard of identical, mass-produced Doric
          capitals shows the problem literally: generic, off-the-shelf,
          nothing built for a specific building. Login-page technique — one
          large painterly layer bled off the edge under mix-blend-multiply,
          plus GoldenRibbons on top — instead of pass 2's small faint corner
          icon. */}
      <div
        className="pointer-events-none absolute -right-[8%] top-1/2 h-[150%] w-[46%] -translate-y-1/2 opacity-[0.22] mix-blend-multiply mask-fade-corner sm:w-[40%] sm:opacity-[0.2]"
        aria-hidden
      >
        <Image
          src="/illustration-agitacao.png"
          alt=""
          fill
          sizes="46vw"
          className="object-cover object-right"
        />
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
