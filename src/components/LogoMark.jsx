// TEKTONE mark — the flat "adaptive-foreground" geometry from the delivered
// 3D icon system (delivery/appicons/_src/adaptive-foreground.svg), the same
// artwork used for the app icon everywhere. Replaces an earlier hand-coded
// approximation that had drifted from the real brand mark.

export default function LogoMark({ className = "", title = "TEKTONE" }) {
  return (
    <svg
      viewBox="0 0 432 432"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="tk-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4D9C3" />
          <stop offset=".55" stopColor="#C7B79C" />
          <stop offset="1" stopColor="#A29174" />
        </linearGradient>
        <linearGradient id="tk-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2C3238" />
          <stop offset=".5" stopColor="#171A1D" />
          <stop offset="1" stopColor="#0A0C0D" />
        </linearGradient>
        <linearGradient id="tk-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#456B60" />
          <stop offset="1" stopColor="#20342E" />
        </linearGradient>
        <linearGradient id="tk-flute" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D3DCD8" />
          <stop offset="1" stopColor="#8B9C96" />
        </linearGradient>
        <linearGradient id="tk-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".45" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(216 216) scale(0.3024) translate(-300 -274)">
        <rect x="0" y="0" width="600" height="147" rx="6" fill="url(#tk-sand)" />
        <rect x="0" y="0" width="600" height="5" rx="2.5" fill="#F6EEDD" opacity=".65" />
        <path d="M17 17H583V130H381.4V112.9H364.3V484H235.7V112.9H218.6V130H17Z" fill="url(#tk-ink)" />
        <rect x="17" y="17" width="566" height="16" fill="url(#tk-shadow)" />
        <rect x="241.7" y="147" width="13.8" height="337" rx="1.5" fill="url(#tk-green)" />
        <rect x="241.7" y="147" width="3" height="337" fill="#5C877A" opacity=".55" />
        <rect x="344.5" y="147" width="13.8" height="337" rx="1.5" fill="url(#tk-green)" />
        <rect x="344.5" y="147" width="3" height="337" fill="#5C877A" opacity=".55" />
        <rect x="297" y="165" width="6" height="293" rx="2" fill="url(#tk-flute)" />
        <rect x="162.5" y="484" width="275" height="30.6" rx="2" fill="url(#tk-sand)" />
        <rect x="162.5" y="484" width="275" height="3" fill="#F0E6D3" opacity=".55" />
        <rect x="130" y="514.6" width="340" height="23.3" rx="1.5" fill="url(#tk-ink)" />
        <rect x="68.5" y="537.9" width="463" height="7.3" rx="1" fill="#15181A" />
        <rect x="128.5" y="545.2" width="343" height="2.4" fill="#BCAB90" />
      </g>
    </svg>
  );
}
