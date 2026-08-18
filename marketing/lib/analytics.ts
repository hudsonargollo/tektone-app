// Funnel tracking: page_view -> form_start -> form_complete, posted to the
// Hub's D1-backed /hub/api/analytics endpoint (same origin as the marketing
// site — tektone.com.br serves both — so this is a plain browser fetch, no
// service-binding hop). See migrations/0024_hub_marketing_analytics.sql and
// functions/api/analytics/[[path]].js.
//
// sessionId lives in sessionStorage (per-tab, cleared when the tab closes),
// not a cookie — enough to correlate one visit's events into a funnel
// without tracking anyone across visits or devices.
const SESSION_KEY = "tk_session_id";

function sessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export type MarketingEventType = "page_view" | "form_start" | "form_complete";

export function trackEvent(type: MarketingEventType) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const payload = {
    type,
    sessionId: sessionId(),
    path: window.location.pathname,
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    referrer: document.referrer || undefined,
  };
  // Fire-and-forget — a dropped analytics beacon should never block or
  // surface an error to the visitor. keepalive lets it survive a navigation
  // that happens right after (e.g. the WhatsApp handoff on approval).
  fetch("/hub/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
