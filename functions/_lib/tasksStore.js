// Storage shim for kanban cards/tasks — lets functions/api/kanban/[[path]].js
// keep its existing in-memory-array business logic (comments, mentions,
// push, review flow — all built around "load the whole array, mutate it,
// save the whole array back", same pattern the KV blob always used) while
// the actual persistence backend swaps via env.TASKS_BACKEND ('kv' | 'd1').
// KV stays the default until the D1-backed data is verified — see
// migrations/0003_hub_tasks.sql and functions/api/admin/migrate-tasks.js
// for the one-time backfill.
//
// Same read-modify-write race the KV version always had (load full array →
// mutate → save full array) — D1 mode does a full delete+reinsert per save
// for the same reason, not a new regression, just matching the existing
// characteristics of a 2-person tool.

const KNOWN_FIELDS = [
  "id", "columnId", "title", "description", "priority", "clientId",
  "assignee", "assignees", "dueDate", "order", "labelColor",
  "createdAt", "reviewed", "reviewedAt", "reviewedBy", "comments",
];

function rowToCard(row) {
  let extra = {};
  try { extra = row.extra ? JSON.parse(row.extra) : {}; } catch { extra = {}; }
  let assignees = [];
  try { assignees = row.assignees ? JSON.parse(row.assignees) : []; } catch { assignees = []; }
  let comments = [];
  try { comments = row.comments ? JSON.parse(row.comments) : []; } catch { comments = []; }
  const card = {
    ...extra,
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    clientId: row.project_id,
    assignees,
    dueDate: row.due_date,
    order: row.order_index,
    labelColor: row.label_color,
    createdAt: row.created_at,
    reviewed: Boolean(row.reviewed),
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    comments,
  };
  if (row.assignee) card.assignee = row.assignee;
  return card;
}

function cardToRow(card) {
  const extra = {};
  for (const [k, v] of Object.entries(card)) {
    if (!KNOWN_FIELDS.includes(k)) extra[k] = v;
  }
  return {
    id: card.id,
    project_id: card.clientId ?? null,
    column_id: card.columnId ?? null,
    title: card.title ?? null,
    description: card.description ?? null,
    priority: card.priority ?? null,
    assignee: card.assignee ?? null,
    assignees: JSON.stringify(card.assignees ?? []),
    due_date: card.dueDate ?? null,
    order_index: card.order ?? 0,
    label_color: card.labelColor ?? null,
    reviewed: card.reviewed ? 1 : 0,
    reviewed_at: card.reviewedAt ?? null,
    reviewed_by: card.reviewedBy ?? null,
    comments: JSON.stringify(card.comments ?? []),
    extra: Object.keys(extra).length ? JSON.stringify(extra) : null,
    created_at: card.createdAt ?? null,
  };
}

export async function loadCards(env) {
  if (env.TASKS_BACKEND === "d1") {
    const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
    return results.map(rowToCard);
  }
  const raw = await env.KANBAN.get("kanban:cards");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveCards(env, cards) {
  if (env.TASKS_BACKEND === "d1") {
    const rows = cards.map(cardToRow);
    const stmts = [env.DB.prepare("DELETE FROM tasks")];
    for (const r of rows) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO tasks (id, project_id, column_id, title, description, priority, assignee, assignees, due_date, order_index, label_color, reviewed, reviewed_at, reviewed_by, comments, extra, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(
          r.id, r.project_id, r.column_id, r.title, r.description, r.priority,
          r.assignee, r.assignees, r.due_date, r.order_index, r.label_color,
          r.reviewed, r.reviewed_at, r.reviewed_by, r.comments, r.extra, r.created_at
        )
      );
    }
    await env.DB.batch(stmts);
    return;
  }
  await env.KANBAN.put("kanban:cards", JSON.stringify(cards));
}
