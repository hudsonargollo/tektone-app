// Capability gate for the formv2 parchment experience. The CSS/Framer Motion
// roll animation (clip-path + rod bars) runs on every device — it's cheap.
// Only the three.js ambience layer (dust particles + glow) is gated here,
// since that's the part with real GPU/battery cost on low-end phones.
export type DeviceTier = "full" | "minimized";

export function detectDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "minimized";
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "minimized";

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return "minimized";

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const smallViewport = window.innerWidth < 820;
    const nav = window.navigator as Navigator & { deviceMemory?: number };
    const lowCores = (nav.hardwareConcurrency ?? 8) <= 4;
    const lowMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory <= 4 : false;

    // Touch device that's also small and either low-core or low-memory reads
    // as a budget phone — skip the WebGL layer there, keep the CSS roll.
    if (coarsePointer && smallViewport && (lowCores || lowMemory)) return "minimized";

    return "full";
  } catch {
    return "minimized";
  }
}
