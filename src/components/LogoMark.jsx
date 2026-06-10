// TEKTONE "Mineral T" — recreated from the brand system (v2).
// Three structural layers: Architrave (sand frame + carved black beam),
// Pillar (green outer / black core / sand flute), Foundation (stepped strata).

const SAND = "#C7B79C";
const BLACK = "#141618";
const GREEN = "#2E4A43";

export default function LogoMark({ className = "", title = "TEKTONE" }) {
  return (
    <svg
      viewBox="0 0 100 116"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Architrave ── */}
      <rect x="15" y="18" width="70" height="22" fill={SAND} />
      <rect x="18" y="21" width="64" height="16" fill={BLACK} />

      {/* ── Pillar ── */}
      <rect x="42" y="37" width="16" height="58" fill={GREEN} />
      <rect x="45" y="37" width="10" height="56" fill={BLACK} />
      <rect x="49.2" y="41" width="1.6" height="46" fill={SAND} />

      {/* ── Foundation ── */}
      <rect x="38" y="95" width="24" height="5" fill={SAND} />
      <rect x="33" y="100" width="34" height="4" fill={BLACK} />
      <rect x="26" y="106.5" width="48" height="1.8" fill={BLACK} />
      <rect x="21" y="110.5" width="58" height="1.2" fill={SAND} />
    </svg>
  );
}
