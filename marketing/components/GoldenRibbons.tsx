/**
 * Two drawn ribbon shapes in the brand's Ochre/gold and sand tones, framing
 * the login hero. Deliberately NOT a drop-shadow/box-shadow glow filter —
 * these are real gradient-stroked paths that draw themselves in once (see
 * .ribbon-path in globals.css) and drift gently afterward, so the "glow"
 * reads as gold ribbon light rather than a generic web halo.
 */
export default function GoldenRibbons({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 600"
      className={className}
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="ribbonGoldA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C7B79C" stopOpacity="0" />
          <stop offset="32%" stopColor="#B8862F" stopOpacity="0.7" />
          <stop offset="52%" stopColor="#E7CE93" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#B8862F" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#C7B79C" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ribbonGoldB" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#7FA396" stopOpacity="0" />
          <stop offset="40%" stopColor="#B8862F" stopOpacity="0.45" />
          <stop offset="58%" stopColor="#E7CE93" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7FA396" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="ribbon-path ribbon-path-a"
        d="M -60 420 C 170 210, 340 570, 500 320 S 780 130, 970 260"
        stroke="url(#ribbonGoldA)"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <path
        className="ribbon-path ribbon-path-b"
        d="M 960 110 C 760 180, 620 -50, 440 160 S 130 350, -60 190"
        stroke="url(#ribbonGoldB)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
