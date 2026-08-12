"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useTransform, animate, motion } from "framer-motion";

export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // margin is a CSS-margin-shorthand string forwarded straight to
  // IntersectionObserver's rootMargin — a single value shrinks all four
  // sides, not just top/bottom. On narrow (mobile, multi-column) grids the
  // left-column items sit inside that horizontal exclusion zone and would
  // never register as intersecting, no matter how far you scroll, leaving
  // their counters frozen at 0. Use the two-value form ("vertical
  // horizontal") so only the top/bottom edges are inset.
  const inView = useInView(ref, { once: true, margin: "-60px 0px" });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) =>
    prefix +
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix
  );

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration: 1.5,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [inView, mv, value]);

  return (
    <span ref={ref} className={className}>
      <motion.span>{text}</motion.span>
    </span>
  );
}
