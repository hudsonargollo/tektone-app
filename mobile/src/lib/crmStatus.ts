// Mirrors src/crm/crmStatus.js — shared status metadata + small helpers for
// the pipeline list and dashboard. Web references CSS var() tokens (so
// color-mix() blends work in the browser); mobile has no CSS, so these
// point straight at the same theme.ts color values instead.
import { colors } from "./theme";

export const LEAD_STATUSES = [
  { key: "new", label: "Novo", color: colors.sand },
  { key: "contacted", label: "Contatado", color: colors.warning },
  { key: "qualified", label: "Qualificado", color: colors.action },
  { key: "won", label: "Fechado", color: colors.success },
  { key: "lost", label: "Descartado", color: colors.danger },
] as const;

export const TIER_COLOR: Record<string, string> = { hot: colors.danger, warm: colors.warning, cold: colors.sand };
export const TIER_LABEL: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio" };

export const CATEGORY_PALETTE = [colors.action, colors.sand, colors.warning, colors.success, colors.danger];

export const brl = (n?: number | null, currency = "BRL") =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency });

/** Builds a wa.me click-to-chat link, auto-prefixing the 55 (BR) country
 *  code when a number was saved without it (10/11 raw digits). */
export function waLink(phone?: string | null, text = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCC = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCC}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function timeAgo(iso?: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / DAY_MS)}d`;
}
