"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function AgitacaoSection() {
  return (
    <section className="relative bg-ivory pt-28 pb-12 sm:pt-36 sm:pb-16 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="sand" className="-right-20 -top-24 h-96 w-96" />

      {/* Second pass: one shared painterly column motif — same medium and
          palette family as the new hero illustration — repeated with
          variation (corner, mirroring, size) across the page's editorial
          sections, instead of a different literal object bolted onto every
          section. This is the first and largest instance, top-right. */}
      <div
        className="pointer-events-none absolute -right-8 -top-4 h-44 w-36 opacity-[0.4] mix-blend-multiply mask-fade-corner sm:-right-4 sm:top-2 sm:h-60 sm:w-48"
        aria-hidden
      >
        <Image
          src="/illustration-column-motif-light.jpg"
          alt=""
          fill
          sizes="(max-width: 640px) 144px, 192px"
          className="object-contain"
        />
      </div>

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
