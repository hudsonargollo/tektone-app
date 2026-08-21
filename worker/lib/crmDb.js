// D1 helpers for the CRM tables (migration 0009_hub_crm.sql) — leads,
// lead_events, sales, commissions. Same plain-prepared-statement style as
// functions/_lib/db.js so this reads consistently with the rest of the repo.
// No dedicated id-generation helper exists in this codebase — every route
// under functions/ calls crypto.randomUUID() inline, so this matches that.
const uid = () => crypto.randomUUID();

// LEFT JOINs the closer's display name (users.name) onto assigned_closer_email
// — the pipeline board and dashboard both need a human name to show, not a
// raw email, and users.name is already there (migration 0001) with no extra
// binding needed since DB is shared across the whole hub.
export async function listLeads(db, { status } = {}) {
  const where = status ? "WHERE l.status = ?" : "";
  const params = status ? [status] : [];
  const { results } = await db
    .prepare(
      `SELECT l.*, u.name AS closer_name
       FROM leads l LEFT JOIN users u ON u.email = l.assigned_closer_email
       ${where} ORDER BY l.updated_at DESC`
    )
    .bind(...params)
    .all();
  return results;
}

export async function getLead(db, id) {
  return db.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
}

export async function createLead(db, fields) {
  const id = uid();
  const cols = ["id", ...Object.keys(fields)];
  const placeholders = cols.map(() => "?").join(", ");
  await db
    .prepare(`INSERT INTO leads (${cols.join(", ")}) VALUES (${placeholders})`)
    .bind(id, ...Object.values(fields))
    .run();
  return getLead(db, id);
}

export async function updateLead(db, id, fields) {
  const cols = Object.keys(fields);
  if (!cols.length) return getLead(db, id);
  const set = cols.map((c) => `${c} = ?`).join(", ");
  await db
    .prepare(`UPDATE leads SET ${set}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...cols.map((c) => fields[c]), id)
    .run();
  return getLead(db, id);
}

// Hard-deletes a lead and everything hanging off it — lead_events,
// lead_questions (migration 0010), and sales + their commissions (no FK
// constraints/cascades exist on these tables, so this has to walk them by
// hand). Restricted to a single hardcoded operator at the route level (see
// worker/crm-entry.js) — this helper itself does no auth, same as every
// other function in this file.
export async function deleteLead(db, id) {
  const sales = await db.prepare("SELECT id FROM sales WHERE lead_id = ?").bind(id).all();
  const saleIds = (sales.results || []).map((s) => s.id);
  const stmts = [
    ...saleIds.map((saleId) => db.prepare("DELETE FROM commissions WHERE sale_id = ?").bind(saleId)),
    db.prepare("DELETE FROM sales WHERE lead_id = ?").bind(id),
    db.prepare("DELETE FROM lead_questions WHERE lead_id = ?").bind(id),
    db.prepare("DELETE FROM lead_events WHERE lead_id = ?").bind(id),
    db.prepare("DELETE FROM leads WHERE id = ?").bind(id),
  ];
  await db.batch(stmts);
}

export async function logLeadEvent(db, leadId, { type, payload, actorEmail }) {
  await db
    .prepare(
      `INSERT INTO lead_events (id, lead_id, type, payload, actor_email) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(uid(), leadId, type, payload ? JSON.stringify(payload) : null, actorEmail || null)
    .run();
}

export async function listLeadEvents(db, leadId) {
  const { results } = await db
    .prepare("SELECT * FROM lead_events WHERE lead_id = ? ORDER BY created_at DESC")
    .bind(leadId)
    .all();
  return results;
}

export async function createSale(db, { leadId, closerEmail, amount, currency = "BRL" }) {
  const id = uid();
  await db
    .prepare(
      `INSERT INTO sales (id, lead_id, closer_email, amount, currency) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, leadId, closerEmail || null, amount, currency)
    .run();
  return db.prepare("SELECT * FROM sales WHERE id = ?").bind(id).first();
}

export async function listSales(db) {
  const { results } = await db
    .prepare("SELECT * FROM sales ORDER BY created_at DESC")
    .all();
  return results;
}

// Single fixed beneficiary for now (Hudson, 10%) — see migration 0009's
// comment on why this isn't a multi-party payout table yet.
const HOUSE_COMMISSION_RATE = 0.1;
const HOUSE_COMMISSION_BENEFICIARY = "hudson@tektone.com.br";

export async function createCommissionForSale(db, sale) {
  const amount = Math.round(sale.amount * HOUSE_COMMISSION_RATE * 100) / 100;
  await db
    .prepare(
      `INSERT INTO commissions (id, sale_id, beneficiary_email, rate, amount) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(uid(), sale.id, HOUSE_COMMISSION_BENEFICIARY, HOUSE_COMMISSION_RATE, amount)
    .run();
}

export async function listCommissionsForSale(db, saleId) {
  const { results } = await db
    .prepare("SELECT * FROM commissions WHERE sale_id = ?")
    .bind(saleId)
    .all();
  return results;
}

// ── Business Specialist Copilot question log (migration 0010) ─────────────
export async function logLeadQuestion(db, { leadId, askedByEmail, questionText, answer }) {
  const id = uid();
  await db
    .prepare(
      `INSERT INTO lead_questions (id, lead_id, asked_by_email, question_text, ai_draft_answer, ai_citations, ai_confidence, ai_latency_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      leadId,
      askedByEmail,
      questionText || null,
      answer.answer,
      JSON.stringify(answer.citations || []),
      answer.confidence || null,
      answer.latencyMs || null
    )
    .run();
  return db.prepare("SELECT * FROM lead_questions WHERE id = ?").bind(id).first();
}

export async function listLeadQuestions(db, leadId) {
  const { results } = await db
    .prepare("SELECT * FROM lead_questions WHERE lead_id = ? ORDER BY created_at DESC")
    .bind(leadId)
    .all();
  return results;
}

export async function getLeadQuestion(db, id) {
  return db.prepare("SELECT * FROM lead_questions WHERE id = ?").bind(id).first();
}

export async function approveLeadQuestion(db, id) {
  await db.prepare("UPDATE lead_questions SET status = 'approved' WHERE id = ?").bind(id).run();
  return getLeadQuestion(db, id);
}
