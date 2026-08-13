// Internal financial tracking — Phase 3/3.5 of Hub Tektone. STAFF/ADMIN
// only, gated by rbac.hasFinanceAccess (ADMIN always; STAFF only if an
// admin has explicitly turned on their finance_authorized flag). Strictly
// separate from anything a CUSTOMER role could ever reach — no
// customer-facing route imports this file.
//
// A real cost ledger (not a hand-typed total), modeled on a reference
// "Custos" page: itemized costs with admin-managed categories,
// once/monthly/annual recurrence, a payment method + (for cards) a
// human-chosen alias — never real card data — and archive-not-delete so
// history is never lost. Income is derived from the invoices already built
// in Phase 4 (SUM of status='PAID' for this project) rather than re-entered
// here — one source of truth.
//
// Everything is scoped to a calendar month (?month=YYYY-MM, defaults to the
// current month): a 'once' cost counts in the month of its cost_date; a
// 'monthly' cost counts in every month from its cost_date onward; an
// 'annual' cost counts once a year, in the month of its cost_date, from
// that date onward (e.g. a Jan-dated annual renewal shows every January).
//
//   GET  /api/finances/categories
//   POST /api/finances/categories                          — admin
//   GET  /api/finances/:projectId?month=YYYY-MM             — dashboard: budget target + derived costs/income/margin for that month
//   PUT  /api/finances/:projectId       { totalInternalBudget, notes } — admin, budget TARGET only, costs are derived
//   GET  /api/finances/:projectId/costs?status=active|all&month=YYYY-MM
//   POST /api/finances/:projectId/costs                     { name, categoryId, amount, recurrence, costDate, paymentMethod, cardAlias }
//   PUT  /api/finances/:projectId/costs/:costId
//   POST /api/finances/:projectId/costs/:costId/archive     — toggle active/archived
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { hasFinanceAccess, isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const RECURRENCES = new Set(["once", "monthly", "annual"]);
const PAYMENT_METHODS = new Set(["pix", "boleto", "cartao", "transferencia", "dinheiro", "outro"]);

const monthPattern = /^\d{4}-\d{2}$/;
const currentMonth = () => new Date().toISOString().slice(0, 7);

// Last calendar day of `YYYY-MM`, as `YYYY-MM-DD` — day 0 of the following
// month rolls back to the last day of the target month.
function monthEnd(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

// A cost's SQL membership test for a given calendar month:
//   once     — cost_date falls inside the month
//   monthly  — recurs every month from cost_date onward
//   annual   — recurs every year, in cost_date's month, from cost_date onward
const monthMatchSql = `(
  (recurrence = 'once' AND strftime('%Y-%m', cost_date) = ?)
  OR (recurrence = 'monthly' AND cost_date <= ?)
  OR (recurrence = 'annual' AND strftime('%m', cost_date) = ? AND cost_date <= ?)
)`;
const monthMatchParams = (month) => {
  const end = monthEnd(month);
  return [month, end, month.slice(5, 7), end];
};

async function costsSummary(db, projectId, month) {
  const params = monthMatchParams(month);
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN recurrence = 'monthly' AND cost_date <= ? THEN amount ELSE 0 END), 0) AS monthly_recurring,
         COALESCE(SUM(CASE WHEN recurrence = 'annual' AND strftime('%m', cost_date) = ? AND cost_date <= ? THEN amount ELSE 0 END), 0) AS annual_recurring,
         COALESCE(SUM(CASE WHEN recurrence = 'once' AND strftime('%Y-%m', cost_date) = ? THEN amount ELSE 0 END), 0) AS one_time
       FROM costs WHERE project_id = ? AND status = 'active'`
    )
    .bind(params[1], params[2], params[3], params[0], projectId)
    .first();
  const monthlyRecurring = Number(row?.monthly_recurring || 0);
  const annualRecurring = Number(row?.annual_recurring || 0);
  const oneTime = Number(row?.one_time || 0);
  return {
    monthlyRecurring,
    annualRecurring,
    oneTime,
    recurring: monthlyRecurring + annualRecurring,
    total: monthlyRecurring + annualRecurring + oneTime,
  };
}

async function incomeSummary(db, projectId, month) {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'PAID' AND strftime('%Y-%m', paid_at) = ? THEN amount ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN status = 'UNPAID' AND strftime('%Y-%m', due_date) = ? THEN amount ELSE 0 END), 0) AS pending
       FROM invoices WHERE project_id = ?`
    )
    .bind(month, month, projectId)
    .first();
  return { paid: Number(row?.paid || 0), pending: Number(row?.pending || 0) };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!hasFinanceAccess(user)) return json({ error: "forbidden" }, 403);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [first, second, third, fourth] = seg;
  const method = request.method;

  try {
    // ── CATEGORIES ("we can add categories") ────────────────────────────
    if (first === "categories") {
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM cost_categories ORDER BY name").all();
        return json({ categories: results });
      }
      if (method === "POST") {
        if (!isAdmin(user)) return json({ error: "forbidden" }, 403);
        const body = await request.json().catch(() => ({}));
        const name = String(body.name || "").trim();
        if (!name) return json({ error: "name obrigatório" }, 400);
        const id = `cat-${uid()}`;
        // Default color is pre-checked at 6.7:1 against this app's own light
        // surface tone — category colors render as small pill TEXT (needs
        // WCAG AA 4.5:1), not just a background tint, so anything picked
        // here (or passed in via body.color) needs the same check, not a
        // color that merely looks fine as a large swatch.
        await db
          .prepare("INSERT INTO cost_categories (id, name, color) VALUES (?, ?, ?)")
          .bind(id, name, body.color || "#5A5248")
          .run();
        const category = await db.prepare("SELECT * FROM cost_categories WHERE id = ?").bind(id).first();
        return json({ category }, 201);
      }
      return json({ error: "Not found" }, 404);
    }

    const projectId = first;
    if (!projectId) return json({ error: "projectId obrigatório" }, 400);

    // ── COSTS (itemized ledger) ──────────────────────────────────────────
    if (second === "costs") {
      if (!third) {
        if (method === "GET") {
          const url = new URL(request.url);
          const statusFilter = url.searchParams.get("status") === "all" ? null : "active";
          const monthParam = url.searchParams.get("month");
          const month = monthParam && monthPattern.test(monthParam) ? monthParam : currentMonth();
          const clauses = ["c.project_id = ?", monthMatchSql.replace(/cost_date/g, "c.cost_date")];
          const bind = [projectId, ...monthMatchParams(month)];
          if (statusFilter) {
            clauses.push("c.status = ?");
            bind.push(statusFilter);
          }
          const sql = `SELECT c.*, cc.name AS category_name, cc.color AS category_color FROM costs c LEFT JOIN cost_categories cc ON cc.id = c.category_id WHERE ${clauses.join(" AND ")} ORDER BY c.cost_date DESC`;
          const { results } = await db.prepare(sql).bind(...bind).all();
          return json({ costs: results, month });
        }
        if (method === "POST") {
          const body = await request.json().catch(() => ({}));
          const name = String(body.name || "").trim();
          const amount = Number(body.amount);
          if (!name || !(amount > 0)) return json({ error: "name e amount obrigatórios" }, 400);
          const recurrence = RECURRENCES.has(body.recurrence) ? body.recurrence : "once";
          const costDate = body.costDate || new Date().toISOString().slice(0, 10);
          const paymentMethod = PAYMENT_METHODS.has(body.paymentMethod) ? body.paymentMethod : null;
          const cardAlias = paymentMethod === "cartao" ? String(body.cardAlias || "").trim().slice(0, 60) || null : null;
          const id = uid();
          await db
            .prepare(
              `INSERT INTO costs (id, project_id, name, category_id, amount, recurrence, cost_date, created_by, payment_method, card_alias)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, projectId, name, body.categoryId || null, amount, recurrence, costDate, email, paymentMethod, cardAlias)
            .run();
          const cost = await db
            .prepare(`SELECT c.*, cc.name AS category_name, cc.color AS category_color FROM costs c LEFT JOIN cost_categories cc ON cc.id = c.category_id WHERE c.id = ?`)
            .bind(id)
            .first();
          return json({ cost }, 201);
        }
      } else if (!fourth) {
        if (method === "PUT") {
          const body = await request.json().catch(() => ({}));
          const fields = {};
          if (body.name !== undefined) fields.name = body.name;
          if (body.categoryId !== undefined) fields.category_id = body.categoryId;
          if (body.amount !== undefined) fields.amount = Number(body.amount);
          if (body.recurrence !== undefined) fields.recurrence = RECURRENCES.has(body.recurrence) ? body.recurrence : "once";
          if (body.costDate !== undefined) fields.cost_date = body.costDate;
          if (body.paymentMethod !== undefined) {
            fields.payment_method = PAYMENT_METHODS.has(body.paymentMethod) ? body.paymentMethod : null;
          }
          if (body.cardAlias !== undefined) {
            const wantsCard = (body.paymentMethod ?? undefined) === "cartao" || (fields.payment_method === "cartao");
            fields.card_alias = wantsCard ? String(body.cardAlias || "").trim().slice(0, 60) || null : null;
          }
          fields.updated_at = "__NOW__";
          const cols = Object.keys(fields);
          const setSql = cols.map((c) => (fields[c] === "__NOW__" ? `${c} = datetime('now')` : `${c} = ?`)).join(", ");
          const bindVals = cols.filter((c) => fields[c] !== "__NOW__").map((c) => fields[c]);
          await db.prepare(`UPDATE costs SET ${setSql} WHERE id = ? AND project_id = ?`).bind(...bindVals, third, projectId).run();
          const cost = await db
            .prepare(`SELECT c.*, cc.name AS category_name, cc.color AS category_color FROM costs c LEFT JOIN cost_categories cc ON cc.id = c.category_id WHERE c.id = ?`)
            .bind(third)
            .first();
          return json({ cost });
        }
      } else if (fourth === "archive" && method === "POST") {
        const existing = await db.prepare("SELECT status FROM costs WHERE id = ? AND project_id = ?").bind(third, projectId).first();
        if (!existing) return json({ error: "Cost not found" }, 404);
        const newStatus = existing.status === "active" ? "archived" : "active";
        await db.prepare("UPDATE costs SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(newStatus, third).run();
        const cost = await db
          .prepare(`SELECT c.*, cc.name AS category_name, cc.color AS category_color FROM costs c LEFT JOIN cost_categories cc ON cc.id = c.category_id WHERE c.id = ?`)
          .bind(third)
          .first();
        return json({ cost });
      }
      return json({ error: "Not found" }, 404);
    }

    // ── DASHBOARD (budget target + derived costs/income/margin) ─────────
    if (!second) {
      if (method === "GET") {
        const url = new URL(request.url);
        const monthParam = url.searchParams.get("month");
        const month = monthParam && monthPattern.test(monthParam) ? monthParam : currentMonth();
        const row = await db.prepare("SELECT * FROM project_finances WHERE project_id = ?").bind(projectId).first();
        const costs = await costsSummary(db, projectId, month);
        const income = await incomeSummary(db, projectId, month);
        const budget = Number(row?.total_internal_budget || 0);
        const margin = income.paid > 0 ? Math.round(((income.paid - costs.total) / income.paid) * 1000) / 10 : null;
        return json({
          finances: {
            projectId,
            month,
            totalInternalBudget: budget,
            notes: row?.notes || "",
            updatedAt: row?.updated_at || null,
            updatedBy: row?.updated_by || null,
            costs,
            income,
            profitMargin: margin,
          },
        });
      }
      if (method === "PUT") {
        if (!isAdmin(user)) return json({ error: "Apenas admins podem editar." }, 403);
        const body = await request.json().catch(() => ({}));
        const budget = Number(body.totalInternalBudget) || 0;
        const notes = typeof body.notes === "string" ? body.notes : "";
        const existing = await db.prepare("SELECT id FROM project_finances WHERE project_id = ?").bind(projectId).first();
        if (existing) {
          await db
            .prepare(`UPDATE project_finances SET total_internal_budget = ?, notes = ?, updated_at = datetime('now'), updated_by = ? WHERE project_id = ?`)
            .bind(budget, notes, email, projectId)
            .run();
        } else {
          await db
            .prepare(`INSERT INTO project_finances (id, project_id, total_internal_budget, notes, updated_at, updated_by) VALUES (?, ?, ?, ?, datetime('now'), ?)`)
            .bind(uid(), projectId, budget, notes, email)
            .run();
        }
        return json({ ok: true });
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
