import confetti from "canvas-confetti";

// Duotone burst in the app's "Mineral" palette — mineral green + sand —
// fired whenever a card is reviewed and moved to Done.
const GREEN = "#2E4A43";
const SAND = "#C7B79C";

export function fireDuotoneConfetti() {
  const shared = { colors: [GREEN, SAND], ticks: 220, scalar: 0.9, disableForReducedMotion: true };
  confetti({ ...shared, particleCount: 70, spread: 65, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  confetti({ ...shared, particleCount: 70, spread: 65, origin: { x: 0.8, y: 0.7 }, angle: 120 });
}
