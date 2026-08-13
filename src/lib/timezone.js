// Shared timezone formatting — the org default is São Paulo (where Tektone
// operates), but a teammate travels (e.g. based in Bolivia at times) and can
// override it on their own profile (see ProfilePage.jsx). Every absolute
// date/time shown in the app should format through fmtDateTime() instead of
// the browser's own local timezone, so a value like "13/08/2026, 16:37" is
// never ambiguous about which timezone it's in — the city label is always
// printed alongside it.
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// Common labels for IANA zones this team is actually likely to use — falls
// back to a readable version of the zone id itself (e.g. "America/Denver"
// -> "Denver") for anything not in this list, so it's never wrong, just
// less pretty for rare picks.
const CITY_LABELS = {
  "America/Sao_Paulo": "São Paulo",
  "America/Manaus": "Manaus",
  "America/Fortaleza": "Fortaleza",
  "America/Recife": "Recife",
  "America/Noronha": "Fernando de Noronha",
  "America/La_Paz": "Bolívia",
  "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Santiago": "Santiago",
  "America/Bogota": "Bogotá",
  "America/Lima": "Lima",
  "America/Mexico_City": "Cidade do México",
  "America/New_York": "Nova York",
  "America/Chicago": "Chicago",
  "America/Denver": "Denver",
  "America/Los_Angeles": "Los Angeles",
  "Europe/Lisbon": "Lisboa",
  "Europe/London": "Londres",
  "Europe/Madrid": "Madrid",
  "Europe/Paris": "Paris",
  "UTC": "UTC",
};

export function tzCityLabel(timezone) {
  const tz = timezone || DEFAULT_TIMEZONE;
  if (CITY_LABELS[tz]) return CITY_LABELS[tz];
  const last = tz.split("/").pop() || tz;
  return last.replace(/_/g, " ");
}

// Full, always-current IANA zone list where supported (modern browsers);
// falls back to the curated list above so the picker still works everywhere.
export function timezoneOptions() {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* fall through */
  }
  return Object.keys(CITY_LABELS);
}

/** "13/08/2026, 16:37 (São Paulo)" — resolves to the given timezone (or the
 *  org default), and always states which city/zone it's in. */
export function fmtDateTime(iso, timezone, { seconds = false } = {}) {
  if (!iso) return "";
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    const formatted = new Date(iso).toLocaleString("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...(seconds ? { second: "2-digit" } : {}),
    });
    return `${formatted} (${tzCityLabel(tz)})`;
  } catch {
    return new Date(iso).toLocaleString("pt-BR");
  }
}

/** "13/08/2026" — same timezone resolution, date only. */
export function fmtDate(iso, timezone) {
  if (!iso) return "";
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: tz });
  } catch {
    return new Date(iso).toLocaleDateString("pt-BR");
  }
}
