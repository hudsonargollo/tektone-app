/**
 * The brand mark — a classical column cross-section (architrave, fuste,
 * fundação), per app/brand/route.ts. Never recolor outside these two
 * variants, never stretch off the 100×116 viewBox.
 */

const VARIANTS = {
  ink: {
    sand: "#C7B79C",
    panel: "#141618",
    shaft: "#2E4A43",
  },
  ivory: {
    sand: "#C7B79C",
    panel: "#F5EFE3",
    shaft: "#4A6F62",
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
      {/* Architrave — 7:9 inner:outer height ratio per spec */}
      <rect x="15" y="18" width="70" height="22" fill={c.sand} />
      <rect x="18" y="20.5" width="64" height="17" fill={c.panel} />
      {/* Pillar — 32:18:2 pillar:core:flute width ratio per spec */}
      <rect x="42" y="37" width="16" height="58" fill={c.shaft} />
      <rect x="45.5" y="37" width="9" height="56" fill={c.panel} />
      <rect x="49.5" y="41" width="1" height="46" fill={c.sand} />
      {/* Foundation — four descending strata: sand, stone, horizon, echo */}
      <rect x="38" y="95" width="24" height="5" fill={c.sand} />
      <rect x="33" y="100" width="34" height="4" fill={c.panel} />
      <rect x="26" y="106.5" width="48" height="1.8" fill={c.panel} />
      <rect x="21" y="110.5" width="58" height="1.2" fill={c.sand} />
    </svg>
  );
}
