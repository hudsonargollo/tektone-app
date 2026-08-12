import Image from "next/image";

/**
 * Section background art. Two layered pieces:
 *   1. The original soft gradient wash — ambient color, heavily blurred.
 *   2. A flat-color classical bust silhouette on top, crisp (not blurred),
 *      mask-faded at its own edges — the actual Greek/Tektone graphic that
 *      was missing when this was just a blurred color blob. Blur can't
 *      apply to this layer (CSS filters cascade to children), so it's a
 *      separate absolutely-positioned element sharing the same box as the
 *      gradient wash below it, not a child of the blurred div.
 */

const PALETTES = {
  sand: "radial-gradient(circle at 30% 30%, #C7B79C 0%, #A9976F 55%, transparent 75%)",
  green: "radial-gradient(circle at 30% 30%, #7FA396 0%, #2E4A43 55%, transparent 75%)",
  ochre: "radial-gradient(circle at 30% 30%, #E3C88A 0%, #B8862F 55%, transparent 75%)",
  ink: "radial-gradient(circle at 30% 30%, #414345 0%, #202224 55%, transparent 75%)",
} as const;

// Which flat-color bust variant reads best against each glow tone.
const BUST_BY_TONE = {
  sand: "/bust-gold.png",
  green: "/bust-green.png",
  ochre: "/bust-gold.png",
  ink: "/bust-ink.png",
} as const;

export default function SectionBlob({
  tone = "sand",
  className = "",
}: {
  tone?: keyof typeof PALETTES;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.32] blur-3xl mask-fade-corner"
        style={{
          background: PALETTES[tone],
          borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%",
        }}
      />
      <div className="absolute inset-[8%] opacity-[0.5] mix-blend-multiply mask-fade-corner-soft">
        <Image src={BUST_BY_TONE[tone]} alt="" fill sizes="30rem" className="object-contain" />
      </div>
    </div>
  );
}
