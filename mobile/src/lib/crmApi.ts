// REST client for the CRM Worker (worker/crm-entry.js), mounted at
// tektone.com.br/crm/api/* — a different origin from the tektone-app Pages
// project src/lib/api.ts's API_BASE talks to. Mirrors src/crm/crmApi.js's
// route shape; auth is the same bearer token as api.ts (getSessionEmail in
// functions/_lib/session.js accepts it identically on both).
//
// Mobile only needs the onboarding review-queue endpoints so far (Phase 4 —
// admin panel completion) — add more as later phases need the CRM suite.
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
};
