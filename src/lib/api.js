// REST client for the KV-backed kanban API + auth (Pages Functions, same origin).

async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
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

export const api = {
  // auth
  me: () => req("/auth/me"),
  check: (email) => req("/auth/check", { method: "POST", body: { email } }),
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password } }),
  signup: (email, password) => req("/auth/signup", { method: "POST", body: { email, password } }),
  logout: () => req("/auth/logout", { method: "POST" }),
  getProfile: () => req("/auth/profile"),
  updateProfile: (body) => req("/auth/profile", { method: "PUT", body }),
  directory: () => req("/auth/directory"),
  adminUsers: () => req("/auth/admin/users"),
  adminReset: (email) => req("/auth/admin/reset", { method: "POST", body: { email } }),

  // clients / parceiros
  listClients: () => req("/kanban/clients"),
  createClient: (body) => req("/kanban/clients", { method: "POST", body }),
  updateClient: (id, body) => req(`/kanban/clients/${id}`, { method: "PUT", body }),
  deleteClient: (id) => req(`/kanban/clients/${id}`, { method: "DELETE" }),

  // cards
  listCards: () => req("/kanban/cards"),
  createCard: (body) => req("/kanban/cards", { method: "POST", body }),
  updateCard: (id, body) => req(`/kanban/cards/${id}`, { method: "PUT", body }),
  deleteCard: (id) => req(`/kanban/cards/${id}`, { method: "DELETE" }),

  // comments / material requests
  addComment: (cardId, text, kind) =>
    req(`/kanban/cards/${cardId}/comments`, { method: "POST", body: { text, kind } }),
  resolveComment: (cardId, commentId) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}/resolve`, { method: "POST" }),
  deleteComment: (cardId, commentId) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}`, { method: "DELETE" }),

  // meeting intelligence (interactive Gemini analysis)
  analyzeMeeting: (body) => req("/analyze/meeting", { method: "POST", body }),
  commitAnalysis: (body) => req("/analyze/commit", { method: "POST", body }),

  // admin: on-demand meeting fetch from Drive (via Apps Script Web App)
  listMeetings: () => req("/meetings/list"),
  processMeetings: (ids) => req("/meetings/process", { method: "POST", body: { ids } }),

  // comment notifications (per-user unread)
  getNotifications: () => req("/kanban/notifications"),
  markCardSeen: (cardId) => req(`/kanban/cards/${cardId}/seen`, { method: "POST" }),

  // meeting-notes review (validation popup)
  listReviews: () => req("/kanban/reviews"),
  ackReviews: (ids) => req("/kanban/reviews/ack", { method: "POST", body: { ids } }),

  // members
  listMembers: () => req("/kanban/members"),
  createMember: (body) => req("/kanban/members", { method: "POST", body }),
  updateMember: (id, body) => req(`/kanban/members/${id}`, { method: "PUT", body }),
  deleteMember: (id) => req(`/kanban/members/${id}`, { method: "DELETE" }),
};
