/**
 * The brand mark — a classical column cross-section (architrave, fuste,
 * fundação), per app/brand/route.ts. Never recolor outside these
 * variants, never stretch off the 100×116 viewBox.
 */

// "ink" and "ivory" both render the same true brand-guide colors (Mineral
// Black core, Mineral Green pillar, Sand frame — matches src/components/
// LogoMark.jsx, the Hub's own logo, which never had a separate "light
// background" palette). The sand frame is what silhouettes the mark
// against a dark background — it doesn't need a brightened core to read;
// a brightened core just collapses the panel/frame contrast that makes
// the three materials legible in the first place. Kept as two distinct
// keys so call sites can still express intent even though they resolve
// identically today.
//
// "onBlack" is different on purpose: against TRUE black (#000, not the
// --ink #141618 the other two read fine against), even the sand frame's
// contrast advantage isn't enough on its own to be worth a second color —
// so the core swaps to a dark beige (same hue family as the sand frame,
// just lower lightness) instead of black, preserving the three-layer
// read (light frame / dark-beige core / green pillar) purely through
// value contrast within one warm palette. For business cards, wax-seal
// style stamps, papelaria fundadora — see app/brand/route.ts's "Selo ·
// sobre preto puro" swatch.
const VARIANTS = {
  ink: {
    sand: "#C7B79C",
    panel: "#141618",
    shaft: "#2E4A43",
  },
  ivory: {
    sand: "#C7B79C",
    panel: "#141618",
    shaft: "#2E4A43",
  },
  onBlack: {
    sand: "#C7B79C",
    panel: "#6B5D45",
    shaft: "#2E4A43",
  },
} as const;

export default function Logo({
  variant = "ink",
  className,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const c = VARIANTS[variant];
  return (
    <svg
      viewBox="0 0 100 116"
      role="img"
      aria-label="Tektone"
      className={className}
    >
      {/* Architrave — inner:outer width ratio 0.914 (64/70), height ratio
          0.773 (17/22). Verified by pixel-measuring the brand guide's
          reference render directly (nearest-color classification across
          many rows of a clean high-res crop): measured ratio 0.920 — a
          near-exact match, confirming these original values were already
          correct. (An earlier pass here briefly widened this to 68 off a
          noisier measurement that turned out to be contaminated by the
          reference page's caption text; reverted.) */}
      <rect x="15" y="18" width="70" height="22" fill={c.sand} />
      <rect x="18" y="20.5" width="64" height="17" fill={c.panel} />
      {/* Pillar — core:pillar width ratio 0.5625 (9/16). Same verified
          pixel measurement gave 0.572 — again a near-exact match. (Also
          briefly widened to 13 off the same bad measurement; reverted.) */}
      <rect x="42" y="37" width="16" height="58" fill={c.shaft} />
      <rect x="45.5" y="37" width="9" height="56" fill={c.panel} />
      <rect x="49.5" y="41" width="1" height="46" fill={c.sand} />
      {/* Foundation — four descending strata: sand, stone, horizon, echo.
          Strata 1-2 widened based on the same pixel measurement (their
          width relative to the architrave's inner black band measured
          noticeably wider than originally coded — 0.50 and 0.61 vs the
          previous 0.375 and 0.531). Strata 3-4 measurements were too
          noisy (contaminated by the reference page's center-axis
          guideline) to trust, so left as-is. */}
      <rect x="34" y="95" width="32" height="5" fill={c.sand} />
      <rect x="30.5" y="100" width="39" height="4" fill={c.panel} />
      <rect x="26" y="106.5" width="48" height="1.8" fill={c.panel} />
      <rect x="21" y="110.5" width="58" height="1.2" fill={c.sand} />
    </svg>
  );
}
