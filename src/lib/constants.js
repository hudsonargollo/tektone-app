// Kanban configuration — TEKTONE themed

export const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "#64748B" },
  { id: "todo", title: "A Fazer", color: "#3B82F6" },
  { id: "inprogress", title: "Em Andamento", color: "#FFB224" },
  { id: "review", title: "Em Revisão", color: "#8B5CF6" },
  { id: "done", title: "Concluído", color: "#46FF9E" },
];

export const PRIORITY = {
  low: {
    label: "Baixa",
    color: "#64748B",
    bg: "rgba(100,116,139,0.14)",
    border: "rgba(100,116,139,0.35)",
  },
  medium: {
    label: "Média",
    color: "#FFB224",
    bg: "rgba(255,178,36,0.12)",
    border: "rgba(255,178,36,0.35)",
  },
  high: {
    label: "Alta",
    color: "#E5484D",
    bg: "rgba(229,72,77,0.14)",
    border: "rgba(229,72,77,0.4)",
  },
};

// Label palette tuned for the dark surface
export const LABEL_COLORS = [
  "#00E5FF", // action cyan
  "#C2FF00", // result lime
  "#46FF9E", // success
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#F472B6", // pink
  "#FFB224", // amber
  "#E5484D", // danger
];

export const PARTNER_COLORS = [
  "#00E5FF",
  "#C2FF00",
  "#3B82F6",
  "#8B5CF6",
  "#46FF9E",
  "#FFB224",
  "#F472B6",
  "#E5484D",
];

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
