/**
 * Section background art. Was a saturated multi-stop color gradient blob;
 * replaced with a much quieter treatment — a faint single-tone wash (no
 * longer a 3-stop color gradient) plus visible paper-fiber grain
 * (.grain-heavy) confined to the same soft blob shape, so it reads as a
 * patch of textured stone/parchment catching soft light rather than a
 * colored glow. `tone` now only nudges the wash's hue very slightly —
 * texture carries the effect, not color.
 */

const TONES = {
  sand: "#A9976F",
  green: "#2E4A43",
  ochre: "#B8862F",
  ink: "#202224",
} as const;

export default function SectionBlob({
  tone = "sand",
  className = "",
}: {
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.14] blur-3xl mask-fade-corner"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${TONES[tone]} 0%, transparent 70%)`,
          borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%",
        }}
      />
      <div
        className="absolute inset-0 grain-heavy opacity-[0.6] mask-fade-corner"
        style={{ borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%" }}
      />
    </div>
  );
}
