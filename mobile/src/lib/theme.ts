// Exact port of tektone-app's web `src/index.css` @theme block + surface
// classes. Keep these two files in sync by hand — small enough that a build
// step to share them isn't worth it.

export const colors = {
  clay: "#efe8dc",
  paper: "#f8f3ea",
  ink: "#141618",
  green: "#2e4a43",
  action: "#2e4a43",
  sand: "#c7b79c",
  pillar: "#c7b79c",
  success: "#3e6b4e",
  danger: "#9b3d2e",
  warning: "#b8862f",
  stone400: "#8a8579",
  stone500: "#6b6355",
};

export const surfaces = {
  1: { backgroundColor: "#e9e1d2", borderColor: "rgba(20,22,24,0.07)", borderWidth: 1 },
  2: {
    backgroundColor: "#f8f3ea",
    borderColor: "rgba(20,22,24,0.1)",
    borderWidth: 1,
    shadowColor: "#141618",
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  3: { backgroundColor: "#fcf9f2", borderColor: "rgba(20,22,24,0.1)", borderWidth: 1 },
} as const;

// Font family names as exposed by @expo-google-fonts/* — loaded via useFonts
// in the root layout before anything renders.
export const fonts = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  serifItalic: "EBGaramond_500Medium_Italic",
};

export const radii = { sm: 6, md: 8, lg: 12, xl: 16 };
