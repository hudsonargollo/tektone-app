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
import { isCrmCloserOrAbove, isCrmAdmin } from "./lib/crmRbac.js";
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
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
import { listPlans, getPlanWithSteps, addStep, updateStep, deleteStep, approvePlan } from "./lib/onboardingService.js";
import { ask as askBusinessSpecialist, suggest as suggestBusinessSpecialist } from "./lib/businessSpecialistService.js";
import { createKbDocument, listKbDocuments, archiveKbDocument, promoteQuestionToFaq } from "./lib/crmKbService.js";
import { listWaLinks, createWaLink, updateWaLink, deleteWaLink, resolveWaLink } from "./lib/waLinksService.js";
import { listWaNumbers, createWaNumber, deleteWaNumber } from "./lib/waNumbersService.js";
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
app.use("/crm/api/wa-links", requireCrm);
app.use("/crm/api/wa-links/*", requireCrm);
app.use("/crm/api/wa-numbers", requireCrm);
app.use("/crm/api/wa-numbers/*", requireCrm);
app.use("/crm/api/settings/*", requireCrm);
app.use("/crm/api/onboarding/*", requireCrm);

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

// Public, unauthenticated intake for the landing-page qualification form
// (marketing/components/QualificacaoSection.tsx) — same-origin fetch from
// tektone.com.br, no session required (visitors aren't logged in). Scoring
// is recomputed server-side from raw answers rather than trusted from the
// client, so the tier a lead lands in can't be spoofed by editing the
// client bundle.
app.post("/crm/api/public/leads", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  if (body.hasCompany === false) {
    return json(c, { eliminated: true });
  }

  const name = String(body.name || "").trim().slice(0, 200);
  const email = String(body.email || "").trim().slice(0, 200);
  const phone = String(body.phone || "").trim().slice(0, 60);
  if (!name || !email || !phone) {
    return json(c, { error: "Nome, e-mail e WhatsApp são obrigatórios." }, 400);
  }

  const { score, tier } = scoreQualification(body);
  const businessType =
    body.businessType === "outro"
      ? String(body.businessTypeOther || "Outro").trim().slice(0, 120)
      : body.businessType || null;

  const lead = await createLead(c.env.DB, {
    name,
    email,
    phone,
    company: null,
    segmento: businessType,
    utm_source: body.utmSource || null,
    utm_medium: body.utmMedium || null,
    utm_campaign: body.utmCampaign || null,
    referrer: body.referrer || null,
    qualification: JSON.stringify({
      source: "landing_qualification_form",
      instagram: body.instagram || null,
      teamSize: body.teamSize || null,
      revenue: body.revenue || null,
      moment: body.moment || null,
      goals: Array.isArray(body.goals) ? body.goals.slice(0, 20) : [],
      goalsOther: body.goalsOther || null,
      urgency: body.urgency || null,
      investment: body.investment || null,
      decision: body.decision || null,
    }),
    score,
    tier,
    // "qualified" is a closer's call, made after they've actually talked to
    // the lead — not something the score/tier should decide at intake (that
    // used to send every non-cold form submission straight into "qualified"
    // before anyone had spoken to them). Score/tier still land on the row
    // for prioritization (hot leads first); the status just starts at
    // "new" like every other channel's leads and moves through the board
    // via PATCH /crm/api/leads/:id/status, same as a manually-created lead.
    status: tier === "cold" ? "incomplete" : "new",
  });
  await logLeadEvent(c.env.DB, lead.id, {
    type: "created",
    payload: { source: "landing_qualification_form", score, tier },
    actorEmail: "public-form",
  });

  return json(c, { leadId: lead.id, score, tier }, 201);
});

const QUALIFICATION_POINTS = {
  teamSize: { solo: 1, "2-5": 2, "6-15": 3, "16-50": 4, "50+": 5 },
  revenue: { "0-10k": 0, "10-50k": 2, "50-200k": 5, "200-500k": 8, "500k-1m": 12, "1m+": 15 },
  moment: {
    problema_claro: 10,
    poderia_melhor: 8,
    ideia_oportunidade: 8,
    nova_receita: 9,
    entendendo_momento: 2,
  },
  urgency: { agora: 20, "3_meses": 15, "6_meses": 8, sem_prazo: 2 },
  investment: {
    pode_agora: 25,
    precisa_entender: 23,
    "30_dias": 20,
    organizar: 8,
    sem_disponibilidade: 0,
  },
  decision: { responsavel_final: 15, socios: 15, outro_responsavel: 7, nao_participa: 0 },
};

function scoreQualification(answers) {
  let score = 0;
  for (const [field, points] of Object.entries(QUALIFICATION_POINTS)) {
    score += points[answers[field]] || 0;
  }
  const tier = score >= 68 ? "hot" : score >= 45 ? "warm" : "cold";
  return { score, tier };
}

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
    automation = await runWonAutomation(c.env.DB, lead, c.get("user").email, {
      projectType: body.projectType || null,
      brief: body.brief || null,
      env: c.env,
    });
    lead = await getLead(c.env.DB, id); // re-fetch: converted_project_id now set
  }
  return json(c, { lead, automation });
});

// Hard-delete a lead. Restricted to a single operator (not any crm_role
// tier, including CRM admins) — deleting a lead wipes its whole history
// (events, sales, commissions), so this deliberately isn't a role anyone
// can be promoted into; it's one hardcoded email, same convention as
// worker/lib/crmDb.js's HOUSE_COMMISSION_BENEFICIARY.
const LEAD_DELETE_ALLOWED_EMAIL = "hudson@tektone.com.br";

app.delete("/crm/api/leads/:id", async (c) => {
  if (c.get("user").email !== LEAD_DELETE_ALLOWED_EMAIL) {
    return json(c, { error: "unauthorized" }, 403);
  }
  const id = c.req.param("id");
  const existing = await getLead(c.env.DB, id);
  if (!existing) return json(c, { error: "not found" }, 404);
  await deleteLead(c.env.DB, id);
  return json(c, { ok: true });
});

// ── onboarding review queue (Phase 2 — AI-generated plans awaiting a human;
//    see worker/lib/onboardingService.js and
//    ~/.claude/plans/tektone-adaptive-onboarding.md) ───────────────────────
app.get("/crm/api/onboarding/plans", async (c) => {
  const plans = await listPlans(c.env.DB, { status: c.req.query("status") || undefined });
  return json(c, { plans });
});

app.get("/crm/api/onboarding/plans/:id", async (c) => {
  const found = await getPlanWithSteps(c.env.DB, c.req.param("id"));
  if (!found) return json(c, { error: "not found" }, 404);
  return json(c, found);
});

app.post("/crm/api/onboarding/plans/:id/steps", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return json(c, { error: "title obrigatório" }, 400);
  const step = await addStep(c.env.DB, c.req.param("id"), { ...body, title });
  if (!step) return json(c, { error: "plan not found" }, 404);
  return json(c, { step }, 201);
});

app.patch("/crm/api/onboarding/plans/:id/steps/:stepId", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const step = await updateStep(c.env.DB, c.req.param("id"), c.req.param("stepId"), body);
  if (!step) return json(c, { error: "not found" }, 404);
  return json(c, { step });
});

app.delete("/crm/api/onboarding/plans/:id/steps/:stepId", async (c) => {
  await deleteStep(c.env.DB, c.req.param("id"), c.req.param("stepId"));
  return json(c, { ok: true });
});

app.post("/crm/api/onboarding/plans/:id/approve", async (c) => {
  const result = await approvePlan(c.env.DB, c.req.param("id"), c.get("user").email);
  if (!result) return json(c, { error: "not found" }, 404);
  return json(c, result);
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

// ── wa-links (WhatsApp/URL short-link manager) ──────────────────────────
app.get("/crm/api/wa-links", async (c) => json(c, { links: await listWaLinks(c.env.DB) }));

app.post("/crm/api/wa-links", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const link = await createWaLink(c.env.DB, { ...body, actor: c.get("user").email });
    return json(c, { link }, 201);
  } catch (e) {
    return json(c, { error: e.message }, 400);
  }
});

app.patch("/crm/api/wa-links/:slug", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const link = await updateWaLink(c.env.DB, c.req.param("slug"), body);
    return json(c, { link });
  } catch (e) {
    return json(c, { error: e.message }, 400);
  }
});

app.delete("/crm/api/wa-links/:slug", async (c) => json(c, await deleteWaLink(c.env.DB, c.req.param("slug"))));

// Public, unauthenticated resolve — called by the go.tektone.com.br
// redirector Worker for every visit. Deliberately outside the
// /crm/api/wa-links* prefix (see requireCrm registrations above) so it
// isn't gated behind a session, same pattern as /crm/api/public/leads.
app.get("/crm/api/public/wa-links/resolve/:slug", async (c) => {
  const link = await resolveWaLink(c.env.DB, c.req.param("slug"));
  if (!link) return json(c, { error: "not found" }, 404);
  return json(c, link);
});

// ── wa-numbers (saved quick-pick numbers for the link creator) ─────────
app.get("/crm/api/wa-numbers", async (c) => json(c, { numbers: await listWaNumbers(c.env.DB) }));

app.post("/crm/api/wa-numbers", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const number = await createWaNumber(c.env.DB, body);
    return json(c, { number }, 201);
  } catch (e) {
    return json(c, { error: e.message }, 400);
  }
});

app.delete("/crm/api/wa-numbers/:id", async (c) => json(c, await deleteWaNumber(c.env.DB, c.req.param("id"))));

// ── settings (admin-editable, currently just the revenue goal) ─────────
app.get("/crm/api/settings/revenue-goal", async (c) => {
  const row = await c.env.DB.prepare("SELECT value FROM crm_settings WHERE key = 'revenue_goal'").first();
  return json(c, { revenueGoal: row ? Number(row.value) || 0 : 0 });
});

app.put("/crm/api/settings/revenue-goal", async (c) => {
  if (!isCrmAdmin(c.get("user"))) return json(c, { error: "Apenas admins podem editar." }, 403);
  const body = await c.req.json().catch(() => ({}));
  const value = String(Number(body.revenueGoal) || 0);
  await c.env.DB.prepare(
    `INSERT INTO crm_settings (key, value, updated_by) VALUES ('revenue_goal', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now'), updated_by = excluded.updated_by`
  )
    .bind(value, c.get("user").email)
    .run();
  return json(c, { revenueGoal: Number(value) });
});

// Sale statuses that count as real revenue — pending_payment isn't money
// yet, refunded no longer is.
const PAID_SALE_STATUSES = ["paid", "onboarding", "completed"];

// ── dashboard ────────────────────────────────────────────────────────────
app.get("/crm/api/dashboard", async (c) => {
  const db = c.env.DB;
  const [leads, sales, goalRow, bioLink] = await Promise.all([
    listLeads(db),
    listSales(db),
    db.prepare("SELECT value FROM crm_settings WHERE key = 'revenue_goal'").first(),
    db.prepare("SELECT slug, title, type, clicks FROM wa_links WHERE slug = ?").bind("sbio").first(),
  ]);

  const byStatus = {};
  for (const s of VALID_STATUSES) byStatus[s] = 0;
  for (const l of leads) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  const byTier = { hot: 0, warm: 0, cold: 0 };
  for (const l of leads) if (l.tier && l.tier in byTier) byTier[l.tier]++;
  const totalSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0);

  // KPI strip — excludes 'incomplete' leads from totals, same convention
  // the pipeline board uses (landing-page abandoners, not real pipeline).
  const pipelineLeads = leads.filter((l) => l.status !== "incomplete");
  const wonCount = pipelineLeads.filter((l) => l.status === "won").length;
  const lostCount = pipelineLeads.filter((l) => l.status === "lost").length;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const leadsLast30d = pipelineLeads.filter((l) => l.created_at >= thirtyDaysAgo).length;
  const pendingCommissions = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM commissions WHERE status = 'pending'")
    .first();

  // Revenue — this calendar month, only sales past the payment stage.
  const monthStr = new Date().toISOString().slice(0, 7);
  const revenueThisMonth = sales
    .filter((s) => PAID_SALE_STATUSES.includes(s.status) && String(s.created_at || "").slice(0, 7) === monthStr)
    .reduce((sum, s) => sum + s.amount, 0);

  // Leads by origin — top 8 sources, rest bucketed as "outros".
  const sourceCounts = {};
  for (const l of pipelineLeads) {
    const src = l.utm_source || "Orgânico";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
  const bySource = sortedSources.slice(0, 8).map(([source, count]) => ({ source, count }));
  const otherSourceCount = sortedSources.slice(8).reduce((sum, [, n]) => sum + n, 0);
  if (otherSourceCount > 0) bySource.push({ source: "Outros", count: otherSourceCount });

  // Leaderboard by closer — lead/won counts from the leads table, revenue
  // from sales, merged by display name (falls back to email, then
  // "Não atribuído" — same closer_name join listLeads() already does).
  const closerStats = {};
  const bump = (name) => (closerStats[name] ??= { closer: name, leads: 0, won: 0, revenue: 0 });
  for (const l of pipelineLeads) {
    const name = l.closer_name || l.assigned_closer_email || "Não atribuído";
    const stat = bump(name);
    stat.leads++;
    if (l.status === "won") stat.won++;
  }
  const closerEmailToName = {};
  for (const l of leads) {
    if (l.assigned_closer_email) closerEmailToName[l.assigned_closer_email] = l.closer_name || l.assigned_closer_email;
  }
  for (const s of sales) {
    if (!PAID_SALE_STATUSES.includes(s.status)) continue;
    const name = closerEmailToName[s.closer_email] || s.closer_email || "Não atribuído";
    bump(name).revenue += s.amount;
  }
  const byCloser = Object.values(closerStats).sort((a, b) => b.leads - a.leads).slice(0, 8);

  // Link-in-bio funnel — clicks on the single go.tektone.com.br/sbio link
  // (Instagram bio destaque, worker-links/) vs. leads that actually came
  // from the public qualification-form intake (leads.qualification is only
  // ever set there — see POST /crm/api/public/leads above).
  const linkClicksTotal = bioLink?.clicks || 0;
  const formEntries = leads.filter((l) => l.qualification).length;
  const linkFunnel = {
    slug: "sbio",
    title: bioLink?.title || "INSTAGRAM-DESTAQUES",
    totalClicks: linkClicksTotal,
    formEntries,
    clickToFormPct: linkClicksTotal ? Math.round((formEntries / linkClicksTotal) * 1000) / 10 : null,
  };

  return json(c, {
    month: monthStr,
    revenue: { thisMonth: revenueThisMonth, goal: goalRow ? Number(goalRow.value) || 0 : 0 },
    kpi: {
      totalLeads: pipelineLeads.length,
      won: wonCount,
      lost: lostCount,
      conversionPct: pipelineLeads.length ? Math.round((wonCount / pipelineLeads.length) * 1000) / 10 : 0,
      winRatePct: wonCount + lostCount ? Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10 : null,
      leadsLast30d,
      pendingCommissions: Number(pendingCommissions?.total || 0),
    },
    leadsByStatus: byStatus,
    leadsByTier: byTier,
    bySource,
    byCloser,
    totalLeads: leads.length,
    totalSales: sales.length,
    totalSalesAmount,
    // Lightweight — just enough for the temperature cards to expand into a
    // lead list without a second round-trip.
    leads: pipelineLeads.map((l) => ({ id: l.id, name: l.name, phone: l.phone, tier: l.tier, status: l.status })),
    linkFunnel,
  });
});

// ── everything else (auth API, static assets, SPA shell) — same compiled
// backend as tektone-hub/tektone-portal, prefix stripped the same way.
//
// The CRM no longer has its own full-page frontend — Dashboard/Pipeline/
// Vendas live inside the Hub as CrmPanel, and Links as its own Hub panel
// (see src/App.jsx). This Worker + all the /crm/api/* routes above stay
// alive since those panels still call crmApi.js, which is hardcoded to hit
// /crm/api/*. A direct page visit to /crm (or any of its old sub-routes)
// now just bounces to /hub instead of serving the retired standalone SPA.
app.all("*", (c) => {
  const url = new URL(c.req.url);
  const isApi = url.pathname === "/crm/api" || url.pathname.startsWith("/crm/api/");
  if (!isApi && c.req.method === "GET") {
    return Response.redirect(new URL("/hub", url).toString(), 302);
  }
  if (url.pathname === "/crm" || url.pathname.startsWith("/crm/")) {
    url.pathname = url.pathname.slice("/crm".length) || "/";
  }
  return pagesHandler.fetch(new Request(url, c.req.raw), c.env, c.executionCtx);
});

export default app;
