"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import AnimatedNumber from "@/components/AnimatedNumber";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const stats = [
  { value: 5, suffix: "+", label: "anos estruturando operações digitais" },
  { value: 3, label: "continentes de operação" },
  { value: 24, label: "países conhecidos" },
  { value: 4, label: "idiomas falados" },
];

export default function AutoridadeSection() {
  return (
    <section id="autoridade" className="relative bg-ivory py-28 sm:py-36 overflow-hidden">
      <div className="absolute inset-0 bp-dots opacity-40 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="ochre" className="-left-24 top-10 h-[26rem] w-[26rem]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <p className="label-tech mb-4">Quem lidera a Tektone</p>

        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-start">
          {/* Portrait */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="relative w-full max-w-sm rounded-2xl surface-paper-raised p-3">
              {/* Passe-partout mat, in the stone/parchment texture */}
              <div className="absolute inset-0 rounded-2xl grain-heavy" aria-hidden />

              {/* Corner registration marks — architectural-drawing convention */}
              {[
                "left-2 top-2 border-l-2 border-t-2",
                "right-2 top-2 border-r-2 border-t-2",
                "left-2 bottom-2 border-l-2 border-b-2",
                "right-2 bottom-2 border-r-2 border-b-2",
              ].map((pos) => (
                <span
                  key={pos}
                  aria-hidden
                  className={`absolute z-10 h-3 w-3 border-green/50 ${pos}`}
                />
              ))}

              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg ring-1 ring-inset ring-ink/10">
                <Image
                  src="/pedro-silvestrini.jpeg"
                  alt="Pedro Silvestrini, CEO e fundador da Tektone, em seu escritório"
                  fill
                  className="object-cover"
                  style={{ objectPosition: "50% 30%" }}
                  sizes="(min-width: 1024px) 24rem, 100vw"
                  priority
                />
                <div className="absolute inset-0 grain-light" aria-hidden />
              </div>
            </div>
            <p className="mt-4 text-lg font-bold text-ink">
              Pedro Silvestrini
            </p>
            <p className="font-mono text-sm tracking-wide text-green">
              CEO &amp; Fundador da Tektone
            </p>
          </motion.div>

          {/* Narrative + stats */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
              className="space-y-5 text-pretty text-lg leading-relaxed text-ink/70"
            >
              <p>
                Há mais de 5 anos, estruturando operações de marketing
                digital de 7 dígitos em 3 continentes, já conheceu 24 países
                e fala 4 idiomas.
              </p>
              <p>
                Descobriu que o mercado vende tecnologia que “funciona”. Mas
                ninguém vende tecnologia que converte, escala e gera equity.
              </p>
              <p className="font-semibold text-ink">Então construiu a Tektone.</p>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4"
            >
              {stats.map((s) => (
                <div key={s.label}>
                  <dt>
                    <AnimatedNumber
                      value={s.value}
                      suffix={s.suffix}
                      className="font-mono text-3xl font-bold tracking-tight text-ink tabular-nums"
                    />
                  </dt>
                  <dd className="mt-1.5 text-xs leading-snug text-ink/50">
                    {s.label}
                  </dd>
                </div>
              ))}
            </motion.dl>

            <motion.blockquote
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
              className="text-editorial mt-10 border-l-2 border-green pl-6 text-xl leading-relaxed text-ink"
            >
              “Queremos que seu projeto funcione. Queremos que ele dê lucro.
              Queremos que você fique feliz, vendo a sua ideia tomando
              forma. Desde a primeira reunião, oficializamos: vamos te
              ajudar a melhorar sua ideia, mas você será o responsável por
              trazê-la ao mundo.”
              <footer className="mt-3 font-sans text-sm not-italic font-semibold text-ink/60">
                — Pedro Silvestrini
              </footer>
            </motion.blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
