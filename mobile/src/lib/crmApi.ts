// REST client for the CRM Worker (worker/crm-entry.js), mounted at
// tektone.com.br/crm/api/* — a different origin from the tektone-app Pages
// project src/lib/api.ts's API_BASE talks to. Mirrors src/crm/crmApi.js's
// route shape; auth is the same bearer token as api.ts (getSessionEmail in
// functions/_lib/session.js accepts it identically on both).
//
// Extended in Phase 8 (CRM suite) with the full leads/sales/copilot/
// wa-links/settings/dashboard surface — see src/crm/crmApi.js for the web
// equivalent this mirrors route-for-route. KB document routes exist
// server-side (worker/crm-entry.js's /crm/api/kb/*) but aren't ported here
// since web's own crmApi.js never calls them either (no frontend uses them
// on either platform today).
import { getToken } from "./auth";

export const CRM_API_BASE = process.env.EXPO_PUBLIC_CRM_API_BASE || "https://tektone.com.br/crm";

export class CrmApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(`CRM API ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function req(path: string, opts: { method?: string; body?: any } = {}) {
  const token = await getToken();
  const res = await fetch(`${CRM_API_BASE}/api${path}`, {
    method: opts.method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    throw new CrmApiError(res.status, body);
  }
  return res.json();
}

export const crmApi = {
  listOnboardingPlans: (status?: string) => req(`/onboarding/plans${status ? `?status=${status}` : ""}`),
  getOnboardingPlan: (id: string) => req(`/onboarding/plans/${id}`),
  addOnboardingStep: (planId: string, body: any) => req(`/onboarding/plans/${planId}/steps`, { method: "POST", body }),
  updateOnboardingStep: (planId: string, stepId: string, body: any) =>
    req(`/onboarding/plans/${planId}/steps/${stepId}`, { method: "PATCH", body }),
  deleteOnboardingStep: (planId: string, stepId: string) =>
    req(`/onboarding/plans/${planId}/steps/${stepId}`, { method: "DELETE" }),
  approveOnboardingPlan: (planId: string) => req(`/onboarding/plans/${planId}/approve`, { method: "POST" }),

  // leads / pipeline
  dashboard: () => req("/dashboard"),
  listLeads: (status?: string) => req(`/leads${status ? `?status=${status}` : ""}`),
  createLead: (body: any) => req("/leads", { method: "POST", body }),
  getLead: (id: string) => req(`/leads/${id}`),
  updateLead: (id: string, body: any) => req(`/leads/${id}`, { method: "PATCH", body }),
  setLeadStatus: (id: string, status: string, opts: any = {}) =>
    req(`/leads/${id}/status`, { method: "PATCH", body: { status, ...opts } }),
  createSale: (leadId: string, amount: number, currency: string) =>
    req(`/leads/${leadId}/sales`, { method: "POST", body: { amount, currency } }),
  listSales: () => req("/sales"),

  // Business Specialist Copilot
  askCopilot: (leadId: string, questionText: string) => req(`/leads/${leadId}/ask`, { method: "POST", body: { questionText } }),
  suggestCopilot: (leadId: string) => req(`/leads/${leadId}/suggest`, { method: "POST" }),
  listQuestions: (leadId: string) => req(`/leads/${leadId}/questions`),
  approveQuestion: (id: string) => req(`/questions/${id}/approve`, { method: "POST" }),

  // WhatsApp/URL short-link manager
  listWaLinks: () => req("/wa-links"),
  createWaLink: (body: any) => req("/wa-links", { method: "POST", body }),
  updateWaLink: (slug: string, body: any) => req(`/wa-links/${slug}`, { method: "PATCH", body }),
  deleteWaLink: (slug: string) => req(`/wa-links/${slug}`, { method: "DELETE" }),
  listWaNumbers: () => req("/wa-numbers"),
  createWaNumber: (body: any) => req("/wa-numbers", { method: "POST", body }),
  deleteWaNumber: (id: string) => req(`/wa-numbers/${id}`, { method: "DELETE" }),

  // dashboard settings
  getRevenueGoal: () => req("/settings/revenue-goal"),
  setRevenueGoal: (revenueGoal: number) => req("/settings/revenue-goal", { method: "PUT", body: { revenueGoal } }),
};
