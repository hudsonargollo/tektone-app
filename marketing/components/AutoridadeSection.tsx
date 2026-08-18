"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import pedroVideo from "/videos/pedro-silvestrini.mp4";
import AnimatedNumber from "@/components/AnimatedNumber";
import SectionBlob from "@/components/SectionBlob";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const stats = [
  { value: 5, suffix: "+", label: "anos estruturando operações digitais" },
  { value: 3, label: "continentes de operação" },
  { value: 24, label: "países conhecidos" },
  { value: 4, label: "idiomas falados" },
];

// Mounts the Tektone 3D "Autoridade" stele (lib/three/tektone-stele.js) — a
// Greek aedicula whose recessed panel carries Pedro's portrait video as a
// VideoTexture. Plays a plain native <video> — NOT next-video's <Video>
// player component, which was tried first and never worked (readyState
// stuck at 0, React hydration error #418 in console) — bypassing its
// Media-Chrome-based player removes an entire class of problems the
// texture-only use case doesn't need (UI/controls/adaptive-bitrate).
// pedroVideo.sources[0].src is the same R2-backed URL next-video's own
// asset metadata already resolves to (see videos/pedro-silvestrini.mp4.json)
// — stays in sync with whatever `npx next-video sync` produces, no
// hardcoded URL. See the crossOrigin comment below for the actual bug
// that kept the panel black even once playback itself was fine.
function useAutoridadeStele(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const steleContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!steleContainerRef.current) return;
    let destroyed = false;
    let cleanup: (() => void) | undefined;
    let raf = 0;

    // A plain <video ref={...}> attaches synchronously, but keep the rAF
    // wait anyway — cheap, and removes any doubt about ref-timing as a
    // variable while diagnosing the real (now-fixed) player issue above.
    const tryMount = () => {
      if (destroyed) return;
      const videoEl = videoRef.current;
      if (!videoEl) {
        raf = requestAnimationFrame(tryMount);
        return;
      }
      // Muted, so browser autoplay policy allows it without a user
      // gesture; the rejection catch is a safety net, not an expected path.
      videoEl.play().catch(() => {});
      import("@/lib/three/tektone-stele.js").then((mod) => {
        if (destroyed || !steleContainerRef.current) return;
        const inst = mod.mountStele(steleContainerRef.current, {
          video: videoEl,
          scrollTarget: sectionRef.current,
        });
        cleanup = () => inst.destroy();
      });
    };
    tryMount();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { steleContainerRef, sectionRef };
}

export default function AutoridadeSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { steleContainerRef, sectionRef } = useAutoridadeStele(videoRef);

  return (
    <section
      id="autoridade"
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="relative bg-ivory py-16 sm:py-24 overflow-hidden"
    >
      <div className="absolute inset-0 bp-dots opacity-40 mask-fade" aria-hidden />
      <div className="absolute inset-0 grain-light mask-fade" aria-hidden />
      <SectionBlob tone="ochre" className="-left-24 top-10 h-[26rem] w-[26rem]" />
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-4 text-3xl font-bold leading-tight tracking-display text-ink sm:text-4xl">
          Quem lidera a Tektone
        </h2>

        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-start">
          {/* Portrait — the 3D stele carries the video in a recessed panel
              (see tektone-stele.js) instead of the flat passe-partout mat
              this section used before. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div
              ref={steleContainerRef}
              className="relative w-full"
              style={{ height: "min(58vh, 440px)", minHeight: 340 }}
              role="img"
              aria-label="Estela grega com o vídeo de Pedro Silvestrini"
            />
            {/* The actual video element — its pixels are sampled into the
                stele's VideoTexture, never displayed directly. It's tucked
                into a 2x2px corner with opacity 0.01 rather than display:none
                or opacity:0, as a defensive measure against browsers that
                throttle decoding of genuinely-invisible video.

                crossOrigin="anonymous" is the real fix for the panel staying
                solid black: video.tektone.com.br DOES send
                Access-Control-Allow-Origin (confirmed via `curl` with an
                Origin header — a plain `curl -I` doesn't send one, which is
                why an earlier check here missed it), but only a browser
                request that actually asks for CORS clearance gets it. Without
                crossOrigin, the <video> plays back completely normally
                (autoplay/readyState/paint all look fine) — but the frame data
                counts as tainted cross-origin content, and WebGL silently
                refuses to upload a tainted source into a texture. The panel
                stays black forever with no error anywhere, which is exactly
                what made this so hard to pin down: playback itself was never
                the problem. Plain native <video>, not next-video's <Video>
                player — see the comment on useAutoridadeStele above for why. */}
            <div
              className="pointer-events-none fixed left-0 top-0 h-0.5 w-0.5 overflow-hidden opacity-[0.01]"
              aria-hidden
            >
              <video
                ref={videoRef}
                src={pedroVideo.sources?.[0]?.src}
                crossOrigin="anonymous"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
            <p className="mt-4 text-lg font-bold text-ink text-center">
              Pedro Silvestrini
            </p>
            <p className="font-mono text-sm tracking-wide text-green text-center">
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
              <p>Conheça o Pedro Silvestrini.</p>
              <p>
                Aos 24 anos, Pedro já construiu uma trajetória um pouquinho
                acima da média.
              </p>
              <p>
                Há mais de 5 anos, atua na construção e escala de negócios
                digitais, participando de operações de marketing de múltiplos
                7 dígitos, produtos de tecnologia e aplicativos que já
                alcançaram milhões de downloads.
              </p>
              <p>
                Nesse período, construiu negócios em 3 continentes, viveu
                como nômade digital por 24 países e aprendeu 4 idiomas,
                repertório que ampliou sua forma de enxergar empresas,
                mercados e tecnologia.
              </p>
              <p>
                Ao longo dessa trajetória, ajudou mais de 50 empresários a
                fortalecer posicionamento e aquisição, implementar IA,
                automatizar processos e transformar operações manuais em
                estruturas mais eficientes, enxutas e escaláveis.
              </p>
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
              “Você já construiu uma empresa que funciona. Nosso papel é
              ajudar a construir a empresa que pode se tornar mais
              tecnológica, mais eficiente, mais escalável e menos
              dependente de você.”
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
