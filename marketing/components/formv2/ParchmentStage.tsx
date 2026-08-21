"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { DeviceTier } from "@/lib/device-tier";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN: [number, number, number, number] = [0.7, 0, 0.84, 0];

type AmbienceHandle = { pulse: (intensity: number) => void; destroy: () => void };

// Every scene of formv2's qualification flow (cover, gate, each of the 9
// questions, results) passes through here. It's the parchment metaphor: the
// outgoing scene rolls shut toward a center line, the incoming one unrolls
// back open — full viewport, one scene visible at a time. The roll itself is
// pure CSS clip-path + Framer Motion (works on any device); the drifting-dust
// backdrop is a real three.js layer, mounted only when `tier === "full"`
// (see lib/device-tier.ts) so low-end/reduced-motion devices still get the
// full roll animation, just without the extra WebGL layer behind it.
export default function ParchmentStage({
  stageKey,
  tier,
  children,
}: {
  stageKey: string;
  tier: DeviceTier;
  children: React.ReactNode;
}) {
  const progress = useMotionValue(0);
  const [displayKey, setDisplayKey] = useState(stageKey);
  const [content, setContent] = useState(children);
  const firstRun = useRef(true);
  const ambienceRef = useRef<AmbienceHandle | null>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);

  // Keeps the displayed content live while the scene ISN'T changing — typing
  // into a field, picking an option, a submit-error message appearing all
  // re-render `children` without changing `stageKey`, and those updates must
  // reach the screen immediately (no roll). The roll transition below only
  // ever swaps `content` at the boundary between two different stageKeys, so
  // this effect and that one never fight over the same moment.
  useEffect(() => {
    if (stageKey === displayKey) {
      setContent(children);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, stageKey, displayKey]);

  useEffect(() => {
    let cancelled = false;

    if (firstRun.current) {
      firstRun.current = false;
      animate(progress, 1, { duration: 0.8, ease: EASE_OUT });
      return;
    }

    if (stageKey === displayKey) return;

    (async () => {
      ambienceRef.current?.pulse(1);
      await animate(progress, 0, { duration: 0.4, ease: EASE_IN }).finished;
      if (cancelled) return;
      setContent(children);
      setDisplayKey(stageKey);
      await animate(progress, 1, { duration: 0.85, ease: EASE_OUT }).finished;
      if (cancelled) return;
      ambienceRef.current?.pulse(0);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageKey]);

  useEffect(() => {
    if (tier !== "full" || !canvasHostRef.current) return;
    let destroyed = false;
    import("@/lib/three/parchment-ambience.js").then((mod) => {
      if (destroyed || !canvasHostRef.current) return;
      ambienceRef.current = mod.mountAmbience(canvasHostRef.current);
    });
    return () => {
      destroyed = true;
      ambienceRef.current?.destroy();
      ambienceRef.current = null;
    };
  }, [tier]);

  const clipPath = useTransform(progress, (p) => {
    const inset = (1 - p) * 50;
    return `inset(${inset}% 0% ${inset}% 0% round 20px)`;
  });
  const rodOffset = useTransform(progress, (p) => `${50 - p * 50}%`);
  const rodOpacity = useTransform(progress, [0, 0.12, 1], [0, 1, 1]);
  const contentOpacity = useTransform(progress, [0.45, 0.85], [0, 1]);
  const contentY = useTransform(progress, [0.45, 1], [14, 0]);

  return (
    <div className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden py-16">
      {tier === "full" && (
        <div ref={canvasHostRef} className="pointer-events-none absolute inset-0 z-0" aria-hidden />
      )}

      <motion.div
        style={{ top: rodOffset, opacity: rodOpacity }}
        className="pointer-events-none absolute left-1/2 z-20 h-[3px] w-28 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#C79A55] to-transparent sm:w-44"
        aria-hidden
      />
      <motion.div
        style={{ bottom: rodOffset, opacity: rodOpacity }}
        className="pointer-events-none absolute left-1/2 z-20 h-[3px] w-28 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#C79A55] to-transparent sm:w-44"
        aria-hidden
      />

      <motion.div style={{ clipPath }} className="relative z-10 mx-5 w-full max-w-xl">
        <div className="rounded-[20px] border border-sand-dark/25 bg-paper px-6 py-9 shadow-2xl sm:px-10 sm:py-12">
          <motion.div style={{ opacity: contentOpacity, y: contentY }}>{content}</motion.div>
        </div>
      </motion.div>
    </div>
  );
}
