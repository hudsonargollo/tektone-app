"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Logo from "@/components/Logo";

const LINKS = [
  { label: "arquitetura", href: "#processo" },
  { label: "autoridade", href: "#autoridade" },
  { label: "faq", href: "#faq" },
];

export default function Navbar({
  theme = "dark",
}: {
  /**
   * "dark" (default) is the original homepage design: fully transparent at
   * scroll 0, fading in a dark blurred panel + ivory logo/text after 100px
   * of scroll — built for the dark photographic hero underneath. Never
   * change this default; every existing call site relies on it.
   *
   * "light" is for pages with a plain bg-ivory body and no dark hero — the
   * ivory logo/text was nearly invisible against the page at scroll 0, so
   * this variant renders the ink logo + ink-toned text on a bar that's
   * legible immediately, with no transparent-at-top phase.
   */
  theme?: "dark" | "light";
}) {
  const isLight = theme === "light";
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1]);

  return (
    <motion.header className="fixed top-0 inset-x-0 z-50">
      {isLight ? (
        <div
          aria-hidden
          className="absolute inset-0 border-b border-ink/10 bg-ivory/92 backdrop-blur-xl"
        />
      ) : (
        <>
          <motion.div
            aria-hidden
            className="absolute inset-0 backdrop-blur-xl"
            style={{ opacity: bgOpacity, background: "rgba(46,74,67,0.92)" }}
          />
          {/* grain-dark uses mix-blend-mode: screen, which lightens whatever's
              under it — on the brand's Mineral Green (#2E4A43) that washed it
              out toward a gray sage instead of the true deep green. overlay
              preserves the base color's identity while still adding texture. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 grain-dark"
            style={{ opacity: bgOpacity, mixBlendMode: "overlay" }}
          />
        </>
      )}
      {/* Thin gold ribbon line instead of the old flat ivory/10 border —
          same brand-gold (Ochre/sand) language as the login hero, just
          restrained to a hairline since this bar is always on screen. On
          the light theme it's always visible (no scroll-linked fade). */}
      <motion.div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-px"
        style={{
          opacity: isLight ? 1 : borderOpacity,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(199,183,156,0.5) 20%, rgba(184,134,47,0.85) 50%, rgba(199,183,156,0.5) 80%, transparent 100%)",
        }}
      />

      <nav className="relative mx-auto max-w-6xl px-6 h-20 flex items-center justify-between">
        {/* Wordmark */}
        <a
          href={isLight ? "/" : "#top"}
          className="flex items-center gap-3 shrink-0 group"
          aria-label="TEKTONE — início"
        >
          <span className="relative inline-flex overflow-hidden rounded-sm">
            <Logo
              variant={isLight ? "ink" : "ivory"}
              className="h-10 w-auto transition-transform duration-300 group-hover:scale-105"
            />
            <span className="logo-shimmer" aria-hidden />
          </span>
          <span
            className={`font-mono text-base font-bold tracking-[0.3em] ${
              isLight ? "text-ink" : "text-ivory"
            }`}
          >
            TEKTONE
          </span>
        </a>

        {/* Nav */}
        <ul className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={isLight ? `/${l.href}` : l.href}
                className={
                  isLight
                    ? "font-mono text-xs tracking-wide text-ink/60 hover:text-ink transition-colors duration-200"
                    : "font-mono text-xs tracking-wide text-ivory/60 hover:text-ivory transition-colors duration-200"
                }
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          {/* Entry point into the app itself (kanban/portal/CRM) — /login is
              the shared front door for every account type; it redirects by
              access_role after auth (CUSTOMER -> /portal, STAFF/ADMIN ->
              /hub), so linking here rather than straight to /hub works
              regardless of who clicks it. Secondary/outline styling so it
              doesn't compete with the primary CTA. */}
          <a
            href="/login"
            className={
              isLight
                ? "inline-flex items-center gap-1.5 rounded-md border border-ink/25 px-2.5 sm:px-4 py-2 text-[11px] sm:text-[13px] font-semibold uppercase tracking-wide text-ink transition-all duration-200 hover:border-ink/50 hover:bg-ink/5"
                : "inline-flex items-center gap-1.5 rounded-md border border-ivory/30 px-2.5 sm:px-4 py-2 text-[11px] sm:text-[13px] font-semibold uppercase tracking-wide text-ivory transition-all duration-200 hover:border-ivory/60 hover:bg-ivory/10"
            }
          >
            ACESSAR HUB
          </a>
          <a
            href={isLight ? "/#qualificacao" : "#qualificacao"}
            className={
              isLight
                ? "group inline-flex items-center gap-1.5 rounded-md bg-green px-2.5 sm:px-4 py-2 text-[11px] sm:text-[13px] font-semibold uppercase tracking-wide text-ivory transition-all duration-200 hover:bg-green-hover"
                : "group inline-flex items-center gap-1.5 rounded-md bg-ivory px-2.5 sm:px-4 py-2 text-[11px] sm:text-[13px] font-semibold uppercase tracking-wide text-ink transition-all duration-200 hover:bg-sand"
            }
          >
            Agendar call
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </nav>
    </motion.header>
  );
}
