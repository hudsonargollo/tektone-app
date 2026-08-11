// Projects, membership, contracts (self-built click-to-sign), and invoices —
// Phase 4 of Hub Tektone. This is the first module a CUSTOMER-role account
// can reach; every route below is scoped by isProjectMember (ADMIN/STAFF
// implicitly pass, CUSTOMER must have a project_users row for this project).
//
//   GET  /api/projects                         — projects visible to me
//   GET  /api/projects/:id                      — detail + task-progress rollup
//   GET  /api/projects/:id/users                — membership list
//   POST /api/projects/:id/users                — invite a member (STAFF/ADMIN)
//   GET  /api/projects/:id/contracts            — list
//   POST /api/projects/:id/contracts            — create (STAFF/ADMIN)
//   POST /api/projects/:id/contracts/:cid/sign  — self-built click-to-sign
//   GET  /api/projects/:id/invoices             — list
//   POST /api/projects/:id/invoices             — create (STAFF/ADMIN)
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isStaffOrAdmin, isProjectMember } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function projectProgress(db, projectId) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN column_id = 'done' THEN 1 ELSE 0 END) AS done
         FROM tasks WHERE project_id = ?`
    )
    .bind(projectId)
    .first();
  const total = Number(row?.total || 0);
  const done = Number(row?.done || 0);
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(db, email) : null;
  if (!user) return json({ error: "unauthorized" }, 401);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [projectId, sub, subId, action] = seg;
  const method = request.method;

  try {
    // ── GET /projects — everything I can see ──────────────────────────────
    if (!projectId) {
      if (method !== "GET") return json({ error: "Not found" }, 404);
      const rows = isStaffOrAdmin(user)
        ? (await db.prepare("SELECT * FROM projects ORDER BY name").all()).results
        : (
            await db
              .prepare(
                `SELECT p.* FROM projects p
                   JOIN project_users pu ON pu.project_id = p.id
                  WHERE pu.user_email = ? ORDER BY p.name`
              )
              .bind(email)
              .all()
          ).results;
      const withProgress = await Promise.all(
        rows.map(async (p) => ({ ...p, progress: await projectProgress(db, p.id) }))
      );
      return json({ projects: withProgress });
    }

    // Every route below needs membership — check once, up front.
    if (!(await isProjectMember(db, user, projectId)))
      return json({ error: "forbidden" }, 403);

    // ── GET /projects/:id — detail + progress ──────────────────────────────
    if (!sub) {
      if (method !== "GET") return json({ error: "Not found" }, 404);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
      if (!project) return json({ error: "Project not found" }, 404);
      return json({ project: { ...project, progress: await projectProgress(db, projectId) } });
    }

    // ── MEMBERSHIP ───────────────────────────────────────────────────────
    if (sub === "users") {
      if (method === "GET") {
        const { results } = await db
          .prepare("SELECT project_id, user_email, role, invited_at FROM project_users WHERE project_id = ?")
          .bind(projectId)
          .all();
        return json({ users: results });
      }
      if (method === "POST") {
        if (!isStaffOrAdmin(user)) return json({ error: "forbidden" }, 403);
        const body = await request.json().catch(() => ({}));
        const targetEmail = String(body.email || "").trim().toLowerCase();
        const role = ["ADMIN", "STAFF", "CUSTOMER"].includes(body.role) ? body.role : "CUSTOMER";
        if (!targetEmail) return json({ error: "email obrigatório" }, 400);
        await db
          .prepare(
            `INSERT INTO project_users (project_id, user_email, role) VALUES (?, ?, ?)
             ON CONFLICT(project_id, user_email) DO UPDATE SET role = excluded.role`
          )
          .bind(projectId, targetEmail, role)
          .run();
        return json({ ok: true }, 201);
      }
    }

    // ── CONTRACTS ────────────────────────────────────────────────────────
    if (sub === "contracts") {
      if (!subId) {
        if (method === "GET") {
          const { results } = await db
            .prepare("SELECT * FROM contracts WHERE project_id = ? ORDER BY created_at DESC")
            .bind(projectId)
            .all();
          return json({ contracts: results });
        }
        if (method === "POST") {
          if (!isStaffOrAdmin(user)) return json({ error: "forbidden" }, 403);
          const body = await request.json().catch(() => ({}));
          const title = String(body.title || "").trim();
          const content = String(body.content || "").trim();
          if (!title || !content) return json({ error: "title e content obrigatórios" }, 400);
          const id = uid();
          await db
            .prepare(
              `INSERT INTO contracts (id, project_id, title, content, status, created_by)
               VALUES (?, ?, ?, ?, 'PENDING_SIGNATURE', ?)`
            )
            .bind(id, projectId, title, content, email)
            .run();
          const contract = await db.prepare("SELECT * FROM contracts WHERE id = ?").bind(id).first();
          return json({ contract }, 201);
        }
      } else if (action === "sign" && method === "POST") {
        const contract = await db
          .prepare("SELECT * FROM contracts WHERE id = ? AND project_id = ?")
          .bind(subId, projectId)
          .first();
        if (!contract) return json({ error: "Contract not found" }, 404);
        if (contract.status === "SIGNED") return json({ error: "Já assinado." }, 409);
        if (contract.status === "VOID") return json({ error: "Contrato anulado." }, 409);
        const signedAt = new Date().toISOString();
        const hash = await sha256Hex(`${contract.content}|${email}|${signedAt}`);
        const ip = request.headers.get("CF-Connecting-IP") || "";
        const ua = request.headers.get("User-Agent") || "";
        await db
          .prepare(
            `UPDATE contracts SET status = 'SIGNED', signature_hash = ?, signer_ip = ?, signer_user_agent = ?, signed_at = ?, signed_by = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .bind(hash, ip, ua, signedAt, email, subId)
          .run();
        const updated = await db.prepare("SELECT * FROM contracts WHERE id = ?").bind(subId).first();
        return json({ contract: updated });
      }
    }

    // ── INVOICES ─────────────────────────────────────────────────────────
    if (sub === "invoices") {
      if (method === "GET") {
        const { results } = await db
          .prepare("SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC")
          .bind(projectId)
          .all();
        return json({ invoices: results });
      }
      if (method === "POST") {
        if (!isStaffOrAdmin(user)) return json({ error: "forbidden" }, 403);
        const body = await request.json().catch(() => ({}));
        const amount = Number(body.amount);
        if (!(amount > 0)) return json({ error: "amount obrigatório" }, 400);
        const id = uid();
        await db
          .prepare(
            `INSERT INTO invoices (id, project_id, description, amount, currency, due_date, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, projectId, body.description || null, amount, body.currency || "BRL", body.dueDate || null, email)
          .run();
        const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first();
        return json({ invoice }, 201);
      }
    }

    // ── ADD-ONS (marketplace purchases for this project) ───────────────────
    if (sub === "addons") {
      if (method === "GET") {
        const { results } = await db
          .prepare(
            `SELECT pa.*, ac.title, ac.description, ac.price, ac.special_price, ac.ai_banner_url
               FROM project_addons pa JOIN addons_catalog ac ON ac.id = pa.addon_id
              WHERE pa.project_id = ? ORDER BY pa.created_at DESC`
          )
          .bind(projectId)
          .all();
        return json({ addons: results });
      }
      if (method === "POST") {
        const body = await request.json().catch(() => ({}));
        const addonId = body.addonId;
        if (!addonId) return json({ error: "addonId obrigatório" }, 400);
        const addon = await db.prepare("SELECT * FROM addons_catalog WHERE id = ? AND is_active = 1").bind(addonId).first();
        if (!addon) return json({ error: "Add-on not found" }, 404);

        // STAFF/ADMIN propose (no purchase, no invoice yet); CUSTOMER
        // purchases instantly — moves straight to PURCHASED and generates
        // an UNPAID invoice (payment collection is tracked separately via
        // the invoice's Stripe link, attached by staff — see PRD §5.2 and
        // §7's POST /addons: "moving it to PURCHASED... automatically
        // generating an invoice").
        const isPurchase = !isStaffOrAdmin(user);
        const paId = uid();
        let invoiceId = null;
        if (isPurchase) {
          invoiceId = uid();
          const price = addon.special_price || addon.price;
          await db
            .prepare(
              `INSERT INTO invoices (id, project_id, description, amount, currency, created_by)
               VALUES (?, ?, ?, ?, 'BRL', ?)`
            )
            .bind(invoiceId, projectId, `Add-on: ${addon.title}`, price, email)
            .run();
        }
        await db
          .prepare(
            `INSERT INTO project_addons (id, project_id, addon_id, status, invoice_id, proposed_by)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(paId, projectId, addonId, isPurchase ? "PURCHASED" : "PROPOSED", invoiceId, email)
          .run();
        const row = await db
          .prepare(
            `SELECT pa.*, ac.title, ac.description, ac.price, ac.special_price, ac.ai_banner_url
               FROM project_addons pa JOIN addons_catalog ac ON ac.id = pa.addon_id WHERE pa.id = ?`
          )
          .bind(paId)
          .first();
        return json({ addon: row }, 201);
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
