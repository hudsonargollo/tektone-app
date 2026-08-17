// Port of web's src/components/LogoMark.jsx — the flat "adaptive-foreground"
// geometry from the delivered 3D icon system (same artwork as the app icon).
// Keep in sync by hand.
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G } from "react-native-svg";

export default function LogoMark({ width = 100, height = 100 }: { width?: number; height?: number }) {
  return (
    <Svg viewBox="0 0 432 432" width={width} height={height}>
      <Defs>
        <LinearGradient id="tk-sand" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E4D9C3" />
          <Stop offset=".55" stopColor="#C7B79C" />
          <Stop offset="1" stopColor="#A29174" />
        </LinearGradient>
        <LinearGradient id="tk-ink" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2C3238" />
          <Stop offset=".5" stopColor="#171A1D" />
          <Stop offset="1" stopColor="#0A0C0D" />
        </LinearGradient>
        <LinearGradient id="tk-green" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#456B60" />
          <Stop offset="1" stopColor="#20342E" />
        </LinearGradient>
        <LinearGradient id="tk-flute" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#D3DCD8" />
          <Stop offset="1" stopColor="#8B9C96" />
        </LinearGradient>
        <LinearGradient id="tk-shadow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity=".45" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <G transform="translate(216 216) scale(0.3024) translate(-300 -274)">
        <Rect x="0" y="0" width="600" height="147" rx="6" fill="url(#tk-sand)" />
        <Rect x="0" y="0" width="600" height="5" rx="2.5" fill="#F6EEDD" opacity={0.65} />
        <Path d="M17 17H583V130H381.4V112.9H364.3V484H235.7V112.9H218.6V130H17Z" fill="url(#tk-ink)" />
        <Rect x="17" y="17" width="566" height="16" fill="url(#tk-shadow)" />
        <Rect x="241.7" y="147" width="13.8" height="337" rx="1.5" fill="url(#tk-green)" />
        <Rect x="241.7" y="147" width="3" height="337" fill="#5C877A" opacity={0.55} />
        <Rect x="344.5" y="147" width="13.8" height="337" rx="1.5" fill="url(#tk-green)" />
        <Rect x="344.5" y="147" width="3" height="337" fill="#5C877A" opacity={0.55} />
        <Rect x="297" y="165" width="6" height="293" rx="2" fill="url(#tk-flute)" />
        <Rect x="162.5" y="484" width="275" height="30.6" rx="2" fill="url(#tk-sand)" />
        <Rect x="162.5" y="484" width="275" height="3" fill="#F0E6D3" opacity={0.55} />
        <Rect x="130" y="514.6" width="340" height="23.3" rx="1.5" fill="url(#tk-ink)" />
        <Rect x="68.5" y="537.9" width="463" height="7.3" rx="1" fill="#15181A" />
        <Rect x="128.5" y="545.2" width="343" height="2.4" fill="#BCAB90" />
      </G>
    </Svg>
  );
}
