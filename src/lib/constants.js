// Kanban configuration — TEKTONE v2 "Mineral" palette (ancient + tech)

export const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "#8A8579" }, // stone
  { id: "todo", title: "A Fazer", color: "#4C6B7A" }, // slate
  { id: "inprogress", title: "Em Andamento", color: "#B8862F" }, // ochre
  { id: "review", title: "Em Revisão", color: "#7A5A6E" }, // plum
  { id: "done", title: "Concluído", color: "#2E4A43" }, // mineral green
];

export const PRIORITY = {
  low: {
    label: "Baixa",
    color: "#8A8579",
    bg: "rgba(138,133,121,0.14)",
    border: "rgba(138,133,121,0.4)",
  },
  medium: {
    label: "Média",
    color: "#B8862F",
    bg: "rgba(184,134,47,0.14)",
    border: "rgba(184,134,47,0.4)",
  },
  high: {
    label: "Alta",
    color: "#9B3D2E",
    bg: "rgba(155,61,46,0.14)",
    border: "rgba(155,61,46,0.42)",
  },
};

// Earthy label palette for cards
export const LABEL_COLORS = [
  "#2E4A43", // mineral green
  "#9B3D2E", // terracotta
  "#B8862F", // ochre
  "#4C6B7A", // slate
  "#7A5A6E", // plum
  "#5B7A4E", // olive
  "#C7B79C", // sand
  "#141618", // mineral black
];

export const PARTNER_COLORS = [
  "#2E4A43",
  "#9B3D2E",
  "#B8862F",
  "#4C6B7A",
  "#7A5A6E",
  "#5B7A4E",
  "#C7B79C",
  "#8A8579",
];

// Deterministic accent color for a name (project, label, etc.) — stays within
// a given earthy palette rather than an arbitrary hue.
export function hashColor(str, palette = LABEL_COLORS) {
  if (!str) return palette[0];
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return palette[sum % palette.length];
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
