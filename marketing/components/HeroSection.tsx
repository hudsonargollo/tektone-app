"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: EASE },
  }),
};

// Word-by-word headline reveal. The second sentence — the resolution —
// carries the brand accent; the first sentence, the problem, stays neutral.
const headWords = [
  { t: "A" },
  { t: "tecnologia" },
  { t: "certa" },
  { t: "pode" },
  { t: "resolver" },
  { t: "qualquer" },
  { t: "problema" },
  { t: "da" },
  { t: "sua" },
  { t: "empresa." },
  { t: "A", hl: true },
  { t: "Tektone", hl: true },
  { t: "constrói", hl: true },
  { t: "essa", hl: true },
  { t: "solução.", hl: true },
];

const headContainer: Variants = {
  hidden: {},
  show: {
    transition: { delayChildren: 0.3, staggerChildren: 0.045 },
  },
};

const headWord: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: EASE },
  },
};

// Mounts the Tektone 3D hero scene (lib/three/tektone-scene.js) as a
// full-bleed background layer behind the existing copy. Dynamic-imported
// inside this effect (which only ever runs client-side) rather than via
// next/dynamic's ssr:false wrapper — this component is already "use
// client" and mountScene() is an imperative function, not a React
// component, so there's nothing next/dynamic would add here; the effect
// alone already guarantees this never runs during SSR.
//
// Scoped down from the delivery's reference implementation
// (delivery/src/tektone-hero-scene.html) in one deliberate way: the
// reference pins the hero via `.stage { position: sticky }` and pulls the
// section immediately after it up with `margin-top: -100vh`, so the mark
// flies past the camera into the NEXT section as part of the scroll exit.
// That trick assumes the following section is nearly empty (the
// reference's own "after" section is a single centered paragraph). This
// site's real next section (AgitacaoSection) is a full, content-rich
// section with its own imagery — retrofitting a -100vh negative margin
// onto it risks visibly breaking that section's layout in a way I can't
// verify without a browser. So: the 3D scene, the data-band-* camera
// framing, and the CTA departure animation are all here faithfully: only
// the sticky-pin/scroll-exit cinematic transition is NOT implemented.
// Flagged in the PR description as the one open follow-up.
function useHeroScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sceneRef.current || !stageRef.current) return;
    let destroyed = false;
    let cleanup: (() => void) | undefined;

    import("@/lib/three/tektone-scene.js").then((mod) => {
      if (destroyed || !sceneRef.current) return;
      const inst = mod.mountScene(sceneRef.current, { scrollTarget: stageRef.current });

      // Every CTA that points at #qualificacao (not just this section's own
      // button) plays the hero's departure before the page scrolls there —
      // matches the delivery's reference script exactly.
      let going = false;
      const links = Array.from(document.querySelectorAll('a[href="#qualificacao"]'));
      const onClick = (e: Event) => {
        e.preventDefault();
        if (going) return;
        going = true;
        document.body.classList.add("departing");
        inst.depart().then(() => {
          const t = document.querySelector("#qualificacao");
          window.scrollTo({ top: t ? (t as HTMLElement).offsetTop : window.innerHeight, behavior: "smooth" });
          setTimeout(() => {
            document.body.classList.remove("departing");
            going = false;
          }, 1400);
        });
      };
      links.forEach((el) => el.addEventListener("click", onClick));

      cleanup = () => {
        links.forEach((el) => el.removeEventListener("click", onClick));
        inst.destroy();
      };
    });

    return () => {
      destroyed = true;
      cleanup?.();
    };
  }, []);

  return { sceneRef, stageRef };
}

export default function HeroSection() {
  const { sceneRef, stageRef } = useHeroScene();

  return (
    <section
      id="top"
      ref={stageRef as React.RefObject<HTMLElement>}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-ink-950"
    >
      {/* 3D scene — colonnade, god rays, impact dust, the Mineral T assembly */}
      <div ref={sceneRef} className="absolute inset-0 z-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(6,7,8,.72) 100%)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 z-[1] grain-dark" aria-hidden />

      {/* Desktop (>820px): a two-column stage — copy flush left in ~62% of
          the width, the mark framed into the [data-band-box] guide in the
          remaining column (see tektone-scene.js's resize()). Below that the
          guide collapses to nothing and the single centred column below
          takes over — the mobile layout is untouched. */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-6 pt-16 pb-16 min-[821px]:grid-cols-[minmax(0,62%)_minmax(0,1fr)] min-[821px]:gap-10 min-[821px]:pt-20 min-[821px]:pb-16">
        <div className="mx-auto max-w-5xl text-center min-[821px]:mx-0 min-[821px]:max-w-none min-[821px]:text-left">
          {/* Eyebrow — the mark wordmark block that used to sit above this was
              removed: redundant now that the 3D T mark is the hero's own
              centerpiece, and it was eating vertical space the mark's camera
              solver needs to keep clear of the headline (see tektone-scene.js's
              resize()). */}
          <motion.p
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="label-tech-ink mb-3 min-[821px]:mb-5"
          >
            Consultoria de Tecnologia &amp; Negócios, Sob Medida
          </motion.p>

          {/* Headline — word-by-word reveal. data-band-top: the 3D scene
              measures this element's real rendered position on every resize
              to solve where the mark's camera framing should land (used as
              the fallback below 820px, once the band-box guide is hidden).
              Sized much smaller on mobile than the old text-4xl default —
              that size wrapped to 5-6 lines on a phone, which left no real
              room for the mark below regardless of how the camera solver
              was tuned. Below min-[821px] a dedicated [data-band-box] guide
              (right after this) reserves the mark's own space directly
              instead of relying on whatever's left over from the text. */}
          <motion.h1
            data-band-top
            variants={headContainer}
            initial="hidden"
            animate="show"
            className="flex flex-wrap justify-center gap-x-[0.22em] gap-y-0.5 text-[1.65rem] leading-[1.18] sm:text-4xl sm:gap-x-[0.28em] sm:gap-y-1 sm:leading-[1.12] min-[821px]:text-5xl lg:text-[3.25rem] font-bold tracking-display text-ivory min-[821px]:justify-start"
          >
            {headWords.map((w, i) => (
              <motion.span
                key={i}
                variants={headWord}
                className={w.hl ? "text-green-mist" : ""}
              >
                {w.t}
              </motion.span>
            ))}
          </motion.h1>

          {/* Sub-headline — also part of the top band the camera measures */}
          <motion.p
            data-band-top
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-pretty mx-auto mt-3 max-w-xs text-sm leading-relaxed text-sand sm:mt-5 sm:max-w-2xl sm:text-lg min-[821px]:mx-0"
          >
            Transformamos necessidades empresariais em produtos, sistemas e
            ativos digitais construídos para gerar eficiência, diferenciação e
            escala.
          </motion.p>

          {/* Mobile-only stage for the mark — a real, guaranteed slot instead
              of whatever space the [data-band-top]/[data-band-bottom]/
              [data-band-seat] measurement fallback happens to find. That
              fallback's own minimum-size floor (tektone-scene.js's MIN) had
              to be dropped so low to stop it overlapping the copy that the
              mark ended up nearly invisible instead — this guide fixes the
              actual complaint (can't see the mark) rather than trading it
              for a different one. Hidden at min-[821px]: the desktop guide
              further down takes over there instead. */}
          <div
            data-band-box
            aria-hidden
            className="mx-auto mt-2 h-[min(30vh,210px)] w-full max-w-[220px] min-[821px]:hidden"
          />

          {/* CTA — bottom band. data-band-seat on the button itself: its top
              edge becomes the mark's base line when the band-box guide above
              is hidden (desktop, before min-[821px] layout settles) — with
              the mobile guide present, the guide wins and this seat/bottom
              measurement is unused on phones. */}
          <motion.div
            data-band-bottom
            custom={4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-4 flex flex-col items-center gap-3 sm:mt-8 sm:gap-4 min-[821px]:items-start"
          >
            <a
              href="#qualificacao"
              data-band-seat
              className="group inline-flex items-center gap-2.5 rounded-lg bg-green px-7 py-4 text-base font-bold tracking-wide text-ivory transition-all duration-200 hover:bg-green-hover active:bg-green-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mist glow-action-ink"
            >
              <span>AGENDAR CALL DE QUALIFICAÇÃO</span>
              <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <p className="font-mono text-xs tracking-wide text-sand/70">
              Leva menos de 3 minutos. Sem compromisso.
            </p>
          </motion.div>
        </div>

        {/* Invisible geometry: the scene reads its rect and frames the mark
            inside it, so the object follows the layout instead of the
            reverse. Hidden below 820px — the scene's data-band-top/bottom/
            seat measurement fallback (above) frames the mark into the
            mobile stacked layout instead. */}
        <div
          data-band-box
          aria-hidden
          className="hidden min-[821px]:block min-[821px]:h-[min(40vh,18rem)] min-[821px]:w-full min-[821px]:max-w-xs min-[821px]:justify-self-center"
        />
      </div>

      {/* Scroll indicator */}
      <motion.div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.7 }}
      >
        <div className="flex h-9 w-5 items-start justify-center rounded-full border border-ivory/15 p-1">
          <motion.div
            className="h-1.5 w-1 rounded-full bg-sand"
            animate={{ y: [0, 10, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
