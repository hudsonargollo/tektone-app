import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        editorial: ["var(--font-eb-garamond)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // Sistema Mineral — light surfaces (dominant palette site-wide)
        ivory: "#EFE8DC", // page background
        paper: "#F8F3EA", // elevated card background
        ink: {
          DEFAULT: "#141618", // body text on light surfaces / inverted-surface base
          // Dark elevation ramp, derived from Ink #141618 — reserved for the
          // hero and Hub Tektone cinematic sections, never the whole page.
          950: "#141618",
          900: "#1A1C1E",
          800: "#202224",
          700: "#282A2C",
          600: "#323436",
          500: "#414345",
        },
        sand: {
          DEFAULT: "#C7B79C", // borders / warm accent — decorative only, fails AA as text
          dark: "#A9976F",
        },
        green: {
          DEFAULT: "#2E4A43", // primary / action / links — 7.9:1 on ivory (AAA)
          hover: "#29433C",
          active: "#263D37",
          tint: "#D2D0C5",
          subtle: "#E3DFD3",
          mist: "#7FA396", // accent on dark ink surfaces — the logo's own dark-variant shaft color, 6.6:1 on ink (AA)
        },
        success: {
          DEFAULT: "#3E6B4E",
          mist: "#9EB5A6", // for use on dark ink surfaces
        },
        warning: "#B8862F", // Ochre — 2.7:1 on ivory, fails AA as text; use for icons/borders/chips only
        "warning-text": "#8A6423", // darkened Ochre for warning copy on light surfaces
        danger: "#9B3D2E", // Terracota — 5.6:1 on ivory (AA pass, safe as error text)
      },
      letterSpacing: {
        tightish: "-0.01em",
        display: "-0.025em",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--base-ui-collapsible-panel-height, auto)" },
        },
        "accordion-up": {
          from: { height: "var(--base-ui-collapsible-panel-height, auto)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.25s cubic-bezier(0.22,1,0.36,1)",
        "accordion-up": "accordion-up 0.2s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
