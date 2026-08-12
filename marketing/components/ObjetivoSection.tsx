"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function ObjetivoSection() {
  return (
    <section className="relative bg-ivory py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-60 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="sand" className="-left-24 top-0 h-[28rem] w-[28rem]" />

      {/* Third and smallest instance of the shared column motif — top-right,
          slightly rotated. Consistent placement logic (corner + feathered
          mask + multiply blend), varied just enough to avoid feeling like a
          stamped repeat as the page scrolls. */}
      <div
        className="pointer-events-none absolute -right-6 top-0 h-36 w-28 opacity-[0.28] mix-blend-multiply mask-fade-corner [transform:rotate(4deg)] sm:-right-8 sm:h-48 sm:w-40"
        aria-hidden
      >
        <Image
          src="/illustration-column-motif-light.jpg"
          alt=""
          fill
          sizes="(max-width: 640px) 112px, 160px"
          className="object-contain"
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6">
        <div className="space-y-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-balance border-l-2 border-green pl-6 text-3xl sm:text-4xl font-bold leading-snug tracking-display text-ink"
          >
            Cada empresário chega até a Tektone buscando construir algo
            diferente.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          >
            <p className="text-balance text-2xl sm:text-3xl leading-snug text-ink/70">
              Alguns querem recuperar o próprio tempo.
            </p>
            <p className="mt-3 text-pretty leading-relaxed text-ink/60">
              Construíram uma empresa que depende demais deles e precisam
              criar uma operação mais organizada, eficiente e preparada para
              funcionar melhor.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
          >
            <p className="text-balance text-2xl sm:text-3xl leading-snug text-ink/70">
              Outros querem transformar uma ideia em realidade.
            </p>
            <div className="mt-3 space-y-1 text-pretty leading-relaxed text-ink/60">
              <p>Criar um aplicativo.</p>
              <p>Lançar um produto.</p>
              <p>Construir uma nova marca.</p>
              <p>Criar uma nova fonte de receita.</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          >
            <p className="text-balance text-2xl sm:text-3xl leading-snug text-ink/70">
              Outros sabem que existe mais potencial dentro da empresa atual.
            </p>
            <div className="mt-3 space-y-1 text-pretty leading-relaxed text-ink/60">
              <p>Querem vender mais.</p>
              <p>Melhorar processos.</p>
              <p>Aumentar eficiência.</p>
              <p>Encontrar novas oportunidades.</p>
              <p>Explorar caminhos que ainda não foram construídos.</p>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
            className="label-tech pt-2"
          >
            O objetivo muda. O desafio muda.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
            className="text-editorial mt-6 text-balance border-l-2 border-green pl-6 text-2xl sm:text-3xl leading-snug text-ink"
          >
            Mas todos chegam com a mesma dúvida interna: &ldquo;Quais decisões
            eu preciso tomar para chegar onde quero?&rdquo;
          </motion.p>
        </div>
      </div>
    </section>
  );
}
