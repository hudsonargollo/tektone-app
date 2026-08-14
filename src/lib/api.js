// REST client for the KV-backed kanban API + auth (Pages Functions, same origin).
// import.meta.env.BASE_URL is "/hub/" in production (see vite.config.js) —
// API calls must carry that prefix too since the Worker route only owns
// /hub/* and /task/*, not the bare domain.
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
  adminSetFinanceAccess: (email, authorized) =>
    req("/auth/admin/finance-access", { method: "POST", body: { email, authorized } }),

  // internal financial tracking (STAFF/ADMIN only — see rbac.hasFinanceAccess)
  getFinances: (projectId, month) => req(`/finances/${projectId}${month ? `?month=${month}` : ""}`),
  updateFinances: (projectId, body) => req(`/finances/${projectId}`, { method: "PUT", body }),
  listCostCategories: () => req("/finances/categories"),
  createCostCategory: (body) => req("/finances/categories", { method: "POST", body }),
  listCosts: (projectId, { all, month } = {}) => {
    const params = new URLSearchParams();
    if (all) params.set("status", "all");
    if (month) params.set("month", month);
    const qs = params.toString();
    return req(`/finances/${projectId}/costs${qs ? `?${qs}` : ""}`);
  },
  createCost: (projectId, body) => req(`/finances/${projectId}/costs`, { method: "POST", body }),
  updateCost: (projectId, costId, body) => req(`/finances/${projectId}/costs/${costId}`, { method: "PUT", body }),
  toggleCostArchive: (projectId, costId) => req(`/finances/${projectId}/costs/${costId}/archive`, { method: "POST" }),

  // projects / commercial module (Phase 4 — contracts, invoices, membership)
  listProjects: () => req("/projects"),
  getProject: (id) => req(`/projects/${id}`),
  listProjectUsers: (id) => req(`/projects/${id}/users`),
  inviteProjectUser: (id, email, role) =>
    req(`/projects/${id}/users`, { method: "POST", body: { email, role } }),
  listContracts: (projectId) => req(`/projects/${projectId}/contracts`),
  createContract: (projectId, body) => req(`/projects/${projectId}/contracts`, { method: "POST", body }),
  signContract: (projectId, contractId) =>
    req(`/projects/${projectId}/contracts/${contractId}/sign`, { method: "POST" }),
  listInvoices: (projectId) => req(`/projects/${projectId}/invoices`),
  createInvoice: (projectId, body) => req(`/projects/${projectId}/invoices`, { method: "POST", body }),

  // add-on marketplace (Phase 5)
  listAddonsCatalog: () => req("/addons"),
  createAddon: (body) => req("/addons", { method: "POST", body }),
  updateAddon: (id, body) => req(`/addons/${id}`, { method: "PUT", body }),
  deleteAddon: (id) => req(`/addons/${id}`, { method: "DELETE" }),
  listProjectAddons: (projectId) => req(`/projects/${projectId}/addons`),
  addProjectAddon: (projectId, addonId) =>
    req(`/projects/${projectId}/addons`, { method: "POST", body: { addonId } }),

  // workflow templates (Phase 7, admin only)
  listWorkflowTemplates: () => req("/workflow-templates"),
  createWorkflowTemplate: (body) => req("/workflow-templates", { method: "POST", body }),
  deleteWorkflowTemplate: (id) => req(`/workflow-templates/${id}`, { method: "DELETE" }),
  applyWorkflowTemplate: (id, projectId) =>
    req(`/workflow-templates/${id}/apply`, { method: "POST", body: { projectId } }),

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
  reviewCard: (id) => req(`/kanban/cards/${id}/review`, { method: "POST" }),
  reviewCardsBulk: (ids) => req("/kanban/cards/review-bulk", { method: "POST", body: { ids } }),

  // comments / material requests
  addComment: (cardId, text, kind, images) =>
    req(`/kanban/cards/${cardId}/comments`, { method: "POST", body: { text, kind, images } }),
  resolveComment: (cardId, commentId) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}/resolve`, { method: "POST" }),
  deleteComment: (cardId, commentId) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}`, { method: "DELETE" }),

  // card images — resource gallery + comment attachments, both upload
  // through this one route (see functions/api/kanban/[[path]].js)
  uploadCardImage: (cardId, dataUrl, name) =>
    req(`/kanban/cards/${cardId}/images`, { method: "POST", body: { dataUrl, name } }),

  // meeting intelligence (interactive Claude analysis)
  analyzeMeeting: (body) => req("/analyze/meeting", { method: "POST", body }),
  commitAnalysis: (body) => req("/analyze/commit", { method: "POST", body }),

  // task creation wizard — stateless AI interview (frontend resends full turn history)
  interviewTurn: (body) => req("/analyze/task-interview", { method: "POST", body }),

  // admin: on-demand meeting fetch from Drive (via Apps Script Web App)
  listMeetings: () => req("/meetings/list"),
  meetingText: (id) => req(`/meetings/text?id=${encodeURIComponent(id)}`),
  processMeetings: (ids) => req("/meetings/process", { method: "POST", body: { ids } }),

  // persistent per-user notification log (mentions, requests, assignments, nudges, reviews, reopens)
  getNotifications: () => req("/kanban/notifications"),
  ackNotifications: (ids) => req("/kanban/notifications/ack", { method: "POST", body: { ids } }),
  ackAllNotifications: () => req("/kanban/notifications/ack", { method: "POST", body: { all: true } }),
  markCardSeen: (cardId) => req(`/kanban/cards/${cardId}/seen`, { method: "POST" }),

  // nudges — ping a specific person about a comment (send only; read state now lives in notifications)
  nudgeComment: (cardId, commentId, to) =>
    req(`/kanban/cards/${cardId}/comments/${commentId}/nudge`, { method: "POST", body: { to } }),

  // manual card reordering within a column
  reorderCards: (columnId, orderedIds) =>
    req("/kanban/cards/reorder", { method: "POST", body: { columnId, orderedIds } }),

  // web push subscription registry
  subscribePush: (subscription) => req("/push/subscribe", { method: "POST", body: subscription }),
  unsubscribePush: (body) => req("/push/unsubscribe", { method: "POST", body }),

  // meeting-notes review (validation popup)
  listReviews: () => req("/kanban/reviews"),
  ackReviews: (ids) => req("/kanban/reviews/ack", { method: "POST", body: { ids } }),

  // members
  listMembers: () => req("/kanban/members"),
  createMember: (body) => req("/kanban/members", { method: "POST", body }),
  updateMember: (id, body) => req(`/kanban/members/${id}`, { method: "PUT", body }),
  deleteMember: (id) => req(`/kanban/members/${id}`, { method: "DELETE" }),

  // private per-user daily todo checklist (sidepanel, never shared), bundled by day
  listTodos: (date) => req(`/kanban/todos?date=${date}`),
  createTodo: (text, date, recurrence) =>
    req("/kanban/todos", { method: "POST", body: { text, date, ...(recurrence ? { recurrence } : {}) } }),
  updateTodo: (id, body) => req(`/kanban/todos/${id}`, { method: "PUT", body }),
  deleteTodo: (id, series) => req(`/kanban/todos/${id}${series ? "?series=1" : ""}`, { method: "DELETE" }),

  // /blog admin (ADMIN only — see functions/api/blog/[[path]].js)
  listBlogPosts: (status) => req(`/blog/admin/posts${status ? `?status=${status}` : ""}`),
  updateBlogPost: (id, body) => req(`/blog/admin/posts/${id}`, { method: "PATCH", body }),
  approveBlogPost: (id) => req(`/blog/admin/posts/${id}/approve`, { method: "POST" }),
  rejectBlogPost: (id, reviewerNotes) => req(`/blog/admin/posts/${id}/reject`, { method: "POST", body: { reviewerNotes } }),
  generateBlogDrafts: () => req("/blog/admin/generate", { method: "POST" }),
  generateBlogImage: (id, prompt) => req(`/blog/admin/posts/${id}/images`, { method: "POST", body: { prompt } }),

  // block builder documents (ADMIN only — see functions/api/builder/[[path]].js)
  listBuilderDocuments: (kind) => req(`/builder/admin/documents${kind ? `?kind=${kind}` : ""}`),
  getBuilderDocument: (id) => req(`/builder/admin/documents/${id}`),
  createBuilderDocument: (body) => req("/builder/admin/documents", { method: "POST", body }),
  updateBuilderDocument: (id, body) => req(`/builder/admin/documents/${id}`, { method: "PATCH", body }),
  publishBuilderDocument: (id) => req(`/builder/admin/documents/${id}/publish`, { method: "POST" }),
  archiveBuilderDocument: (id) => req(`/builder/admin/documents/${id}/archive`, { method: "POST" }),
  deleteBuilderDocument: (id) => req(`/builder/admin/documents/${id}`, { method: "DELETE" }),

  // builder profile (gamification — see functions/_lib/gamification.js)
  getBuilderProfile: () => req("/gamification/me"),
  getBuilderProfileFor: (email) => req(`/gamification/user/${encodeURIComponent(email)}`),
  getProjectBuilders: (projectId) => req(`/gamification/project/${projectId}`),

  // AI Instagram post generator (STAFF/ADMIN only — see functions/api/social/[[path]].js)
  generateSocialPost: (body) => req("/social/generate", { method: "POST", body }),
  listSocialPosts: () => req("/social"),
  exportSocialPost: (id) => req(`/social/${id}`, { method: "PATCH" }),
  deleteSocialPost: (id) => req(`/social/${id}`, { method: "DELETE" }),
  regenerateSocialCaption: (id) => req(`/social/${id}/caption`, { method: "POST" }),
  exportSocialPostGroup: (groupId) => req(`/social/group/${groupId}`, { method: "PATCH" }),
  deleteSocialPostGroup: (groupId) => req(`/social/group/${groupId}`, { method: "DELETE" }),
};
