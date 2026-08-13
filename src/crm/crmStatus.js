// Shared status metadata + small helpers for the pipeline board and
// dashboard. Stage colors follow the conventional new→won progression
// (blue → purple → sand → green → red) rather than reusing Código
// Internacional's own brand accent — Tektone's board reads dark like CI's,
// but with Tektone's own mineral sand/green/danger tones (see crm-theme.css).
export const LEAD_STATUSES = [
  { key: "new", label: "Novo", color: "#6FA8CF" },
  { key: "contacted", label: "Contatado", color: "#9B87C4" },
  { key: "qualified", label: "Qualificado", color: "#C7B79C" },
  { key: "won", label: "Fechado", color: "#5FAE82" },
  { key: "lost", label: "Descartado", color: "#D97B68" },
];

export const TIER_COLOR = { hot: "#D97B68", warm: "#D1A24A", cold: "#6FA8CF" };
export const TIER_LABEL = { hot: "Quente", warm: "Morno", cold: "Frio" };

export const brl = (n, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

/** Builds a wa.me click-to-chat link, auto-prefixing the 55 (BR) country
 *  code when a number was saved without it (10/11 raw digits). */
export function waLink(phone, text = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCC = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCC}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Relative "Nd"/"Nh"/"agora" — same rough-granularity convention used
 *  elsewhere in this codebase (e.g. Comments' relTime). */
export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / DAY_MS)}d`;
}
