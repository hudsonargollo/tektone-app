// REST client for the KV-backed kanban API (Pages Functions, same origin).

const BASE = "/api/kanban";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status}${txt ? ` — ${txt}` : ""}`);
  }
  return res.json();
}

export const api = {
  // clients / parceiros
  listClients: () => req("/clients"),
  createClient: (body) => req("/clients", { method: "POST", body }),
  updateClient: (id, body) => req(`/clients/${id}`, { method: "PUT", body }),
  deleteClient: (id) => req(`/clients/${id}`, { method: "DELETE" }),

  // cards
  listCards: () => req("/cards"),
  createCard: (body) => req("/cards", { method: "POST", body }),
  updateCard: (id, body) => req(`/cards/${id}`, { method: "PUT", body }),
  deleteCard: (id) => req(`/cards/${id}`, { method: "DELETE" }),

  // members
  listMembers: () => req("/members"),
  createMember: (body) => req("/members", { method: "POST", body }),
  updateMember: (id, body) => req(`/members/${id}`, { method: "PUT", body }),
  deleteMember: (id) => req(`/members/${id}`, { method: "DELETE" }),
};
