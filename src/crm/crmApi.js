// REST client for the CRM Worker — same shape as src/lib/api.js (shared
// auth routes under /api, CRM-specific routes also under /api since
// worker/crm-entry.js mounts everything at /crm/api/*).
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function req(path, opts = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    err.status = res.status;
    try {
      err.body = await res.json();
    } catch {
      /* ignore */
    }
    throw err;
  }
  return res.json();
}

export const crmApi = {
  // shared auth (delegated to the same compiled backend as /hub and /portal)
  me: () => req("/auth/me"),
  check: (email) => req("/auth/check", { method: "POST", body: { email } }),
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password } }),
  signup: (email, password) => req("/auth/signup", { method: "POST", body: { email, password } }),
  logout: () => req("/auth/logout", { method: "POST" }),

  // CRM
  dashboard: () => req("/dashboard"),
  listLeads: (status) => req(`/leads${status ? `?status=${status}` : ""}`),
  createLead: (body) => req("/leads", { method: "POST", body }),
  getLead: (id) => req(`/leads/${id}`),
  updateLead: (id, body) => req(`/leads/${id}`, { method: "PATCH", body }),
  setLeadStatus: (id, status, lostReason) =>
    req(`/leads/${id}/status`, { method: "PATCH", body: { status, lostReason } }),
  createSale: (leadId, amount, currency) =>
    req(`/leads/${leadId}/sales`, { method: "POST", body: { amount, currency } }),
  listSales: () => req("/sales"),

  // Business Specialist Copilot
  askCopilot: (leadId, questionText) => req(`/leads/${leadId}/ask`, { method: "POST", body: { questionText } }),
  suggestCopilot: (leadId) => req(`/leads/${leadId}/suggest`, { method: "POST" }),
  listQuestions: (leadId) => req(`/leads/${leadId}/questions`),
  approveQuestion: (id) => req(`/questions/${id}/approve`, { method: "POST" }),

  // WhatsApp/URL short-link manager
  listWaLinks: () => req("/wa-links"),
  createWaLink: (body) => req("/wa-links", { method: "POST", body }),
  updateWaLink: (slug, body) => req(`/wa-links/${slug}`, { method: "PATCH", body }),
  deleteWaLink: (slug) => req(`/wa-links/${slug}`, { method: "DELETE" }),
  listWaNumbers: () => req("/wa-numbers"),
  createWaNumber: (body) => req("/wa-numbers", { method: "POST", body }),
  deleteWaNumber: (id) => req(`/wa-numbers/${id}`, { method: "DELETE" }),
};
