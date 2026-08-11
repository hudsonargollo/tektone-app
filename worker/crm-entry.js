// Entry point for the tektone-crm Worker (tektone.com.br/crm/*).
//
// New code (Hono) for the CRM-specific surface (leads/sales/commissions —
// migration 0009_hub_crm.sql), but auth (/crm/api/auth/*) and static asset
// serving fall through to the SAME compiled Pages Functions backend
// tektone-hub/tektone-portal already use — same reasoning as
// worker/portal-entry.js: no reason to duplicate login/signup/me, and
// rbac.js's checks already gate the delegated routes server-side regardless
// of which Worker they arrive through.
import { Hono } from "hono";
import { getSessionEmail } from "../functions/_lib/session.js";
import { getUserByEmail } from "../functions/_lib/db.js";
import { isCrmCloserOrAbove } from "./lib/crmRbac.js";
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  logLeadEvent,
  listLeadEvents,
  createSale,
  listSales,
  createCommissionForSale,
  listCommissionsForSale,
  logLeadQuestion,
  listLeadQuestions,
  getLeadQuestion,
  approveLeadQuestion,
} from "./lib/crmDb.js";
import { runWonAutomation } from "./lib/wonAutomation.js";
import { ask as askBusinessSpecialist, suggest as suggestBusinessSpecialist } from "./lib/businessSpecialistService.js";
import { createKbDocument, listKbDocuments, archiveKbDocument, promoteQuestionToFaq } from "./lib/crmKbService.js";
import pagesHandler from "../dist/_worker.js/index.js";

const app = new Hono();

const json = (c, data, status = 200) => c.json(data, status);

// Every /crm/api/leads* and /crm/api/sales* route requires crm_role
// closer-or-admin (see worker/lib/crmRbac.js — 'partner' exists in the
// ladder for later, not wired into any scoped view yet since there are no
// affiliates today).
app.use("/crm/api/leads/*", requireCrm);
app.use("/crm/api/leads", requireCrm);
app.use("/crm/api/sales/*", requireCrm);
app.use("/crm/api/sales", requireCrm);
app.use("/crm/api/dashboard", requireCrm);
app.use("/crm/api/kb/*", requireCrm);
app.use("/crm/api/questions/*", requireCrm);

async function requireCrm(c, next) {
  const email = await getSessionEmail(c.req.raw, c.env);
  const user = email ? await getUserByEmail(c.env.DB, email) : null;
  if (!user || !isCrmCloserOrAbove(user)) return json(c, { error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
}

// ── leads ────────────────────────────────────────────────────────────────
app.get("/crm/api/leads", async (c) => {
  const status = c.req.query("status") || undefined;
  const leads = await listLeads(c.env.DB, { status });
  return json(c, { leads });
});

app.post("/crm/api/leads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.name && !body.email && !body.phone) {
    return json(c, { error: "Informe ao menos nome, e-mail ou telefone." }, 400);
  }
  const lead = await createLead(c.env.DB, {
    name: body.name || null,
    email: body.email || null,
    phone: body.phone || null,
    company: body.company || null,
    segmento: body.segmento || null,
    utm_source: body.utmSource || null,
    utm_medium: body.utmMedium || null,
    utm_campaign: body.utmCampaign || null,
    referrer: body.referrer || null,
    notes: body.notes || null,
    status: "new",
  });
  await logLeadEvent(c.env.DB, lead.id, { type: "created", actorEmail: c.get("user").email });
  return json(c, { lead }, 201);
});

app.get("/crm/api/leads/:id", async (c) => {
  const lead = await getLead(c.env.DB, c.req.param("id"));
  if (!lead) return json(c, { error: "not found" }, 404);
  const [events, allSales] = await Promise.all([
    listLeadEvents(c.env.DB, lead.id),
    listSales(c.env.DB),
  ]);
  const sales = allSales.filter((s) => s.lead_id === lead.id);
  return json(c, { lead, events, sales });
});

const EDITABLE_FIELDS = ["name", "email", "phone", "company", "segmento", "notes", "assigned_closer_email"];

app.patch("/crm/api/leads/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getLead(c.env.DB, id);
  if (!existing) return json(c, { error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const fields = {};
  for (const f of EDITABLE_FIELDS) if (f in body) fields[f] = body[f];
  const lead = await updateLead(c.env.DB, id, fields);
  await logLeadEvent(c.env.DB, id, { type: "updated", payload: fields, actorEmail: c.get("user").email });
  return json(c, { lead });
});

const VALID_STATUSES = ["new", "contacted", "qualified", "won", "lost", "incomplete"];

app.patch("/crm/api/leads/:id/status", async (c) => {
  const id = c.req.param("id");
  const existing = await getLead(c.env.DB, id);
  if (!existing) return json(c, { error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  if (!VALID_STATUSES.includes(body.status)) return json(c, { error: "status inválido" }, 400);
  const fields = { status: body.status };
  if (body.status === "lost") fields.lost_reason = body.lostReason || null;
  let lead = await updateLead(c.env.DB, id, fields);
  await logLeadEvent(c.env.DB, id, {
    type: "status_changed",
    payload: { from: existing.status, to: body.status, lostReason: fields.lost_reason },
    actorEmail: c.get("user").email,
  });
  let automation = null;
  if (body.status === "won" && existing.status !== "won") {
    automation = await runWonAutomation(c.env.DB, lead, c.get("user").email);
    lead = await getLead(c.env.DB, id); // re-fetch: converted_project_id now set
  }
  return json(c, { lead, automation });
});

// ── sales ────────────────────────────────────────────────────────────────
app.post("/crm/api/leads/:id/sales", async (c) => {
  const leadId = c.req.param("id");
  const lead = await getLead(c.env.DB, leadId);
  if (!lead) return json(c, { error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return json(c, { error: "valor inválido" }, 400);
  const sale = await createSale(c.env.DB, {
    leadId,
    closerEmail: c.get("user").email,
    amount,
    currency: body.currency || "BRL",
  });
  await createCommissionForSale(c.env.DB, sale);
  await logLeadEvent(c.env.DB, leadId, { type: "sale_created", payload: { saleId: sale.id, amount }, actorEmail: c.get("user").email });
  return json(c, { sale }, 201);
});

app.get("/crm/api/sales", async (c) => {
  const sales = await listSales(c.env.DB);
  const withCommissions = await Promise.all(
    sales.map(async (s) => ({ ...s, commissions: await listCommissionsForSale(c.env.DB, s.id) }))
  );
  return json(c, { sales: withCommissions });
});

// ── Business Specialist Copilot ─────────────────────────────────────────
app.post("/crm/api/leads/:id/ask", async (c) => {
  const leadId = c.req.param("id");
  const lead = await getLead(c.env.DB, leadId);
  if (!lead) return json(c, { error: "not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const questionText = String(body.questionText || "").trim();
  if (!questionText) return json(c, { error: "questionText obrigatório" }, 400);
  const answer = await askBusinessSpecialist(c.env, { lead, questionText });
  const question = await logLeadQuestion(c.env.DB, { leadId, askedByEmail: c.get("user").email, questionText, answer });
  return json(c, { question });
});

app.post("/crm/api/leads/:id/suggest", async (c) => {
  const leadId = c.req.param("id");
  const lead = await getLead(c.env.DB, leadId);
  if (!lead) return json(c, { error: "not found" }, 404);
  const answer = await suggestBusinessSpecialist(c.env, { lead });
  const question = await logLeadQuestion(c.env.DB, { leadId, askedByEmail: c.get("user").email, questionText: null, answer });
  return json(c, { question });
});

app.get("/crm/api/leads/:id/questions", async (c) => {
  const questions = await listLeadQuestions(c.env.DB, c.req.param("id"));
  return json(c, { questions });
});

app.post("/crm/api/questions/:id/approve", async (c) => {
  const question = await getLeadQuestion(c.env.DB, c.req.param("id"));
  if (!question) return json(c, { error: "not found" }, 404);
  await approveLeadQuestion(c.env.DB, question.id);
  await promoteQuestionToFaq(c.env.DB, question);
  return json(c, { ok: true });
});

// ── knowledge base ───────────────────────────────────────────────────────
app.get("/crm/api/kb/documents", async (c) => {
  const documents = await listKbDocuments(c.env.DB);
  return json(c, { documents });
});

app.post("/crm/api/kb/documents", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return json(c, { error: "title obrigatório" }, 400);
  const document = await createKbDocument(c.env.DB, {
    tier: ["source_of_truth", "case_study", "faq"].includes(body.tier) ? body.tier : "source_of_truth",
    topic: body.topic || null,
    title,
    content: body.content || null,
    createdBy: c.get("user").email,
  });
  return json(c, { document }, 201);
});

app.post("/crm/api/kb/documents/:id/archive", async (c) => {
  await archiveKbDocument(c.env.DB, c.req.param("id"));
  return json(c, { ok: true });
});

// ── dashboard ────────────────────────────────────────────────────────────
app.get("/crm/api/dashboard", async (c) => {
  const [leads, sales] = await Promise.all([listLeads(c.env.DB), listSales(c.env.DB)]);
  const byStatus = {};
  for (const s of VALID_STATUSES) byStatus[s] = 0;
  for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0);
  return json(c, { leadsByStatus: byStatus, totalLeads: leads.length, totalSales: sales.length, totalSalesAmount });
});

// ── everything else (auth, static assets, SPA shell) — same compiled
// backend as tektone-hub/tektone-portal, prefix stripped the same way.
app.all("*", (c) => {
  const url = new URL(c.req.url);
  if (url.pathname === "/crm" || url.pathname.startsWith("/crm/")) {
    url.pathname = url.pathname.slice("/crm".length) || "/";
  }
  return pagesHandler.fetch(new Request(url, c.req.raw), c.env, c.executionCtx);
});

export default app;
