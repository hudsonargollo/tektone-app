/**
 * Soft organic gradient glow used as section background art — the
 * grainy-blob accent language (paired with the .grain-* texture utilities)
 * that gives each section its own quiet identity without a literal
 * illustration. Purely decorative.
 */

const PALETTES = {
  sand: "radial-gradient(circle at 30% 30%, #C7B79C 0%, #A9976F 55%, transparent 75%)",
  green: "radial-gradient(circle at 30% 30%, #7FA396 0%, #2E4A43 55%, transparent 75%)",
  ochre: "radial-gradient(circle at 30% 30%, #E3C88A 0%, #B8862F 55%, transparent 75%)",
  ink: "radial-gradient(circle at 30% 30%, #414345 0%, #202224 55%, transparent 75%)",
} as const;

export default function SectionBlob({
  tone = "sand",
  className = "",
}: {
  tone?: keyof typeof PALETTES;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute opacity-[0.32] blur-3xl ${className}`}
      style={{
        background: PALETTES[tone],
        borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%",
      }}
    />
  );
}
