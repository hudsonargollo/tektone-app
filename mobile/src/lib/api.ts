// REST client for the tektone-app kanban API — mirrors web's src/lib/api.js
// method-for-method. Web sends the tk_session cookie; we send the same
// signed token as `Authorization: Bearer <token>` instead (see
// functions/_lib/session.js's getSessionEmail — accepts either).
import { getToken } from "./auth";

// Production default; override per-build via EXPO_PUBLIC_API_BASE (Expo
// auto-inlines any EXPO_PUBLIC_* env var into the JS bundle, no extra config
// needed). Set it in a local .env for `expo start` against `wrangler pages
// dev` — e.g. EXPO_PUBLIC_API_BASE=http://192.168.1.23:8788 on a physical
// device, http://10.0.2.2:8788 on the Android emulator.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "https://tasks.tektone.com.br";

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function req(path: string, opts: { method?: string; body?: any } = {}) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
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
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export const api = {
  // auth
  me: () => req("/auth/me"),
  check: (email: string) => req("/auth/check", { method: "POST", body: { email } }),
  login: (email: string, password: string) => req("/auth/login", { method: "POST", body: { email, password } }),
  signup: (email: string, password: string) => req("/auth/signup", { method: "POST", body: { email, password } }),
  logout: () => req("/auth/logout", { method: "POST" }),
  getProfile: () => req("/auth/profile"),
  updateProfile: (body: any) => req("/auth/profile", { method: "PUT", body }),
  directory: () => req("/auth/directory"),
  adminUsers: () => req("/auth/admin/users"),
  adminReset: (email: string) => req("/auth/admin/reset", { method: "POST", body: { email } }),

  // clients / parceiros
  listClients: () => req("/kanban/clients"),
  createClient: (body: any) => req("/kanban/clients", { method: "POST", body }),
  updateClient: (id: string, body: any) => req(`/kanban/clients/${id}`, { method: "PUT", body }),
  deleteClient: (id: string) => req(`/kanban/clients/${id}`, { method: "DELETE" }),

  // cards
  listCards: () => req("/kanban/cards"),
  createCard: (body: any) => req("/kanban/cards", { method: "POST", body }),
  updateCard: (id: string, body: any) => req(`/kanban/cards/${id}`, { method: "PUT", body }),
  deleteCard: (id: string) => req(`/kanban/cards/${id}`, { method: "DELETE" }),
  reviewCard: (id: string) => req(`/kanban/cards/${id}/review`, { method: "POST" }),
  reviewCardsBulk: (ids: string[]) => req("/kanban/cards/review-bulk", { method: "POST", body: { ids } }),

  // comments / material requests
  addComment: (cardId: string, text: string, kind?: string) =>
    req(`/kanban/cards/${cardId}/comments`, { method: "POST", body: { text, kind } }),
  resolveComment: (cardId: string, commentId: string) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}/resolve`, { method: "POST" }),
  deleteComment: (cardId: string, commentId: string) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}`, { method: "DELETE" }),

  // meeting intelligence (interactive Claude analysis)
  analyzeMeeting: (body: any) => req("/analyze/meeting", { method: "POST", body }),
  commitAnalysis: (body: any) => req("/analyze/commit", { method: "POST", body }),

  // task creation wizard — stateless AI interview (client resends full turn history)
  interviewTurn: (body: any) => req("/analyze/task-interview", { method: "POST", body }),

  // admin: on-demand meeting fetch from Drive (via Apps Script Web App)
  listMeetings: () => req("/meetings/list"),
  meetingText: (id: string) => req(`/meetings/text?id=${encodeURIComponent(id)}`),
  processMeetings: (ids: string[]) => req("/meetings/process", { method: "POST", body: { ids } }),

  // persistent per-user notification log (mentions, requests, assignments, nudges, reviews, reopens)
  getNotifications: () => req("/kanban/notifications"),
  ackNotifications: (ids: string[]) => req("/kanban/notifications/ack", { method: "POST", body: { ids } }),
  ackAllNotifications: () => req("/kanban/notifications/ack", { method: "POST", body: { all: true } }),
  markCardSeen: (cardId: string) => req(`/kanban/cards/${cardId}/seen`, { method: "POST" }),

  // nudges — ping a specific person about a comment (send only; read state now lives in notifications)
  nudgeComment: (cardId: string, commentId: string, to: string) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}/nudge`, { method: "POST", body: { to } }),

  // manual card reordering within a column
  reorderCards: (columnId: string, orderedIds: string[]) =>
    req("/kanban/cards/reorder", { method: "POST", body: { columnId, orderedIds } }),

  // Expo push token registration
  registerExpoPush: (token: string) => req("/push/register-expo", { method: "POST", body: { token } }),

  // meeting-notes review (validation popup)
  listReviews: () => req("/kanban/reviews"),
  ackReviews: (ids: string[]) => req("/kanban/reviews/ack", { method: "POST", body: { ids } }),

  // members
  listMembers: () => req("/kanban/members"),
  createMember: (body: any) => req("/kanban/members", { method: "POST", body }),
  updateMember: (id: string, body: any) => req(`/kanban/members/${id}`, { method: "PUT", body }),
  deleteMember: (id: string) => req(`/kanban/members/${id}`, { method: "DELETE" }),
};
