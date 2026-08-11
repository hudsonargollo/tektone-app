"use client";

import { motion } from "framer-motion";

/**
 * Abstract colonnade blueprint — vertical flutes rising from a stepped
 * plinth, drawn in like a construction diagram. Carries the brand's
 * classical-foundation narrative (architrave / shaft / foundation) as an
 * ambient structural backdrop, without touching the protected logo mark.
 * Deterministic geometry — no RNG — so SSR and resume stay stable.
 */

const FLUTE_X = [70, 130, 190, 260, 340, 430, 530, 640, 760, 890, 1010, 1120];
const FLUTE_TOP = [180, 120, 200, 90, 150, 60, 150, 90, 200, 120, 180, 140];
const BASE_Y = 760;

export default function ColumnBlueprint() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Stepped foundation — three plinth lines, widest at the base */}
      <g stroke="#C7B79C" strokeOpacity="0.14" strokeWidth="1.5">
        <line x1="0" y1={BASE_Y} x2="1200" y2={BASE_Y} />
        <line x1="60" y1={BASE_Y + 18} x2="1140" y2={BASE_Y + 18} />
        <line x1="120" y1={BASE_Y + 36} x2="1080" y2={BASE_Y + 36} />
      </g>

      {/* Flutes — drawn in from the foundation upward, staggered */}
      <g stroke="#C7B79C" strokeWidth="1" strokeLinecap="round">
        {FLUTE_X.map((x, i) => {
          const top = FLUTE_TOP[i];
          const length = BASE_Y - top;
          return (
            <motion.line
              key={i}
              x1={x}
              y1={BASE_Y}
              x2={x}
              y2={top}
              strokeOpacity={0.16}
              strokeDasharray={length}
              initial={{ strokeDashoffset: length }}
              animate={{ strokeDashoffset: 0 }}
              transition={{
                duration: 1.6,
                delay: 0.5 + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          );
        })}
      </g>

      {/* Capitals — small resting marks at the top of each flute */}
      <g fill="#A1AEAA">
        {FLUTE_X.map((x, i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={FLUTE_TOP[i]}
            r={2}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.3] }}
            transition={{
              duration: 1,
              delay: 1.9 + i * 0.06,
              ease: "easeOut",
            }}
          />
        ))}
      </g>
    </svg>
  );
}
