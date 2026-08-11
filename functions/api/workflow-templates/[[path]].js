// Admin-authored workflow templates — Phase 7 of Hub Tektone (PRD §5.4).
// ADMIN only, both to manage templates and to trigger applying one to a
// project. Applying bulk-inserts rows straight into the D1 `tasks` table
// (see migrations/0003_hub_tasks.sql) — same table the live Kanban board
// reads via _lib/tasksStore.js, so an applied template shows up on the
// board immediately, no separate sync step.
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user || !isAdmin(user)) return json({ error: "forbidden" }, 403);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const id = seg[0];
  const action = seg[1];
  const method = request.method;

  try {
    if (!id) {
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM workflow_templates ORDER BY created_at DESC").all();
        return json({ templates: results.map((t) => ({ ...t, tasks: JSON.parse(t.tasks_json || "[]") })) });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const name = String(body.name || "").trim();
        const tasks = Array.isArray(body.tasks) ? body.tasks : [];
        if (!name || !tasks.length) return json({ error: "name e ao menos 1 tarefa são obrigatórios" }, 400);
        const newId = uid();
        await db
          .prepare(
            `INSERT INTO workflow_templates (id, name, description, tasks_json, created_by) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(newId, name, body.description || null, JSON.stringify(tasks), email)
          .run();
        const template = await db.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(newId).first();
        return json({ template: { ...template, tasks: JSON.parse(template.tasks_json) } }, 201);
      }
    } else if (action === "apply" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const projectId = body.projectId;
      if (!projectId) return json({ error: "projectId obrigatório" }, 400);
      const template = await db.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(id).first();
      if (!template) return json({ error: "Template not found" }, 404);
      const tasks = JSON.parse(template.tasks_json || "[]");

      const maxRow = await db
        .prepare("SELECT COALESCE(MAX(order_index), -1) AS m FROM tasks WHERE project_id = ? AND column_id = ?")
        .bind(projectId, tasks[0]?.columnId || "todo")
        .first();
      let orderIndex = Number(maxRow?.m ?? -1) + 1;

      const stmts = tasks.map((t) => {
        const dueDate = Number.isFinite(t.dueOffsetDays)
          ? new Date(Date.now() + t.dueOffsetDays * 86400000).toISOString().slice(0, 10)
          : null;
        return db
          .prepare(
            `INSERT INTO tasks (id, project_id, column_id, title, description, priority, assignees, due_date, order_index, comments, created_at)
             VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, '[]', datetime('now'))`
          )
          .bind(uid(), projectId, t.columnId || "todo", t.title || "Tarefa", t.description || null, t.priority || "medium", dueDate, orderIndex++);
      });
      await db.batch(stmts);
      return json({ ok: true, created: tasks.length });
    } else if (method === "DELETE") {
      await db.prepare("DELETE FROM workflow_templates WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
