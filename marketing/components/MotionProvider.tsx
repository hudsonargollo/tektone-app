"use client";

import { MotionConfig } from "framer-motion";

// Honors the OS "reduce motion" setting — entrance/transform animations
// become instant for users who request it.
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
