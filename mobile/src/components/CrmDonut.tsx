import Svg, { Circle } from "react-native-svg";

// Port of CrmDashboard.jsx's hand-rolled SVG donut — react-native-svg is
// already a dependency (LogoMark.tsx), so no chart library needed here
// either.
export default function CrmDonut({ data, size = 110, strokeWidth = 16 }: { data: { value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(20,22,24,0.08)" strokeWidth={strokeWidth} />
      {total > 0 &&
        data.map((d, i) => {
          const frac = d.value / total;
          const dash = Math.max(frac * circumference - 1.5, 0);
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          );
          offset += frac * circumference;
          return el;
        })}
    </Svg>
  );
}
