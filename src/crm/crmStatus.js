// Shared status metadata + small helpers for the pipeline board and
// dashboard. Stage/tier colors reference the SAME design tokens
// index.css's @theme block defines (sand/action/success/danger/warning)
// instead of hardcoded hex or borrowed hues from Código Internacional's
// own board — every color here is one already in Tektone's brand system,
// so the board always stays bound to Tektone's own palette.
export const LEAD_STATUSES = [
  { key: "new", label: "Novo", color: "var(--color-sand)" },
  { key: "contacted", label: "Contatado", color: "var(--color-warning)" },
  { key: "qualified", label: "Qualificado", color: "var(--color-action)" },
  { key: "won", label: "Fechado", color: "var(--color-success)" },
  { key: "lost", label: "Descartado", color: "var(--color-danger)" },
];

export const TIER_COLOR = { hot: "var(--color-danger)", warm: "var(--color-warning)", cold: "var(--color-sand)" };
export const TIER_LABEL = { hot: "Quente", warm: "Morno", cold: "Frio" };

// Categorical palette for arbitrary-cardinality series (e.g. "leads by
// source") — every entry is either an existing design token or a
// color-mix() blend of two of them, so an unbounded list of categories
// never has to introduce a hue outside the brand system.
export const CATEGORY_PALETTE = [
  "var(--color-action)",
  "var(--color-sand)",
  "var(--color-warning)",
  "var(--color-success)",
  "var(--color-danger)",
  "color-mix(in srgb, var(--color-action) 55%, var(--color-sand) 45%)",
  "color-mix(in srgb, var(--color-warning) 55%, var(--color-danger) 45%)",
  "color-mix(in srgb, var(--color-success) 55%, var(--color-sand) 45%)",
];

/** Alpha-blends a color token against transparent — needed since stage/tier
 *  colors are CSS var() references now, which can't take a hex alpha suffix
 *  concatenated onto them the way a raw hex string could. */
export const withAlpha = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

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
