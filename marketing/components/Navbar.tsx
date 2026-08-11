"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Logo from "@/components/Logo";

const LINKS = [
  { label: "arquitetura", href: "#processo" },
  { label: "autoridade", href: "#autoridade" },
  { label: "faq", href: "#faq" },
];

export default function Navbar() {
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1]);

  return (
    <motion.header className="fixed top-0 inset-x-0 z-50">
      <motion.div
        aria-hidden
        className="absolute inset-0 backdrop-blur-xl"
        style={{ opacity: bgOpacity, background: "rgba(46,74,67,0.92)" }}
      />
      <motion.div aria-hidden className="absolute inset-0 grain-dark" style={{ opacity: bgOpacity }} />
      {/* Thin gold ribbon line instead of the old flat ivory/10 border —
          same brand-gold (Ochre/sand) language as the login hero, just
          restrained to a hairline since this bar is always on screen. */}
      <motion.div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-px"
        style={{
          opacity: borderOpacity,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(199,183,156,0.5) 20%, rgba(184,134,47,0.85) 50%, rgba(199,183,156,0.5) 80%, transparent 100%)",
        }}
      />

      <nav className="relative mx-auto max-w-6xl px-6 h-20 flex items-center justify-between">
        {/* Wordmark */}
        <a
          href="#top"
          className="flex items-center gap-3 shrink-0 group"
          aria-label="TEKTONE — início"
        >
          <span className="relative inline-flex overflow-hidden rounded-sm">
            <Logo
              variant="ivory"
              className="h-10 w-auto transition-transform duration-300 group-hover:scale-105"
            />
            <span className="logo-shimmer" aria-hidden />
          </span>
          <span className="font-mono text-base font-bold tracking-[0.3em] text-ivory">
            TEKTONE
          </span>
        </a>

        {/* Nav */}
        <ul className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="font-mono text-xs tracking-wide text-ivory/60 hover:text-ivory transition-colors duration-200"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a
          href="#qualificacao"
          className="group inline-flex items-center gap-1.5 rounded-md bg-ivory px-4 py-2 text-[13px] font-semibold text-ink transition-all duration-200 hover:bg-sand"
        >
          Agendar call
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </nav>
    </motion.header>
  );
}
