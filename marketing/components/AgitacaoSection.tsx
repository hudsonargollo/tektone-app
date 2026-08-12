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
          icon.
          Unlike Processo/Objetivo's illustrations, this source image is a
          dense tiled pattern with no blank margin of its own, so it can't
          rely on a shallow edge fade the way a sparse single-subject image
          can — the source content itself would still read as "a rectangle
          pasted on top" right up to where the fade kicks in. Two fixes
          together: mask-fade-corner-soft (fades from 25% instead of 55%,
          so the dissolve starts almost at the center) and a container
          height close to the section's own bounds (h-[108%] instead of a
          much taller box) so the fade zone actually lands inside the
          visible, non-clipped area — a much taller box's own fade zone
          sits past the section's overflow-hidden edge and never renders,
          which is what produced the hard bottom edge originally. */}
      <div
        className="pointer-events-none absolute -right-[10%] top-1/2 h-[108%] w-[42%] -translate-y-1/2 opacity-[0.16] mix-blend-multiply mask-fade-corner-soft sm:w-[36%] sm:opacity-[0.15]"
        aria-hidden
      >
        <Image
          src="/illustration-agitacao.png"
          alt=""
          fill
          sizes="42vw"
          className="object-cover"
          style={{ objectPosition: "85% 35%" }}
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
