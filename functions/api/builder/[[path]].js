// /builder backend — the block-based page/form/quiz/funnel builder behind
// the Blog panel's new tab set. Same route-shape convention as
// functions/api/blog/[[path]].js: public reads need no auth, everything
// under admin/ requires ADMIN. See docs/ARCHITECTURE.md and
// ~/.claude/plans/tektone-block-builder.md for the full design — a
// "Document" is {kind, slug, title, status, blocks: JSON[], meta: JSON}.
//
//   GET    /api/builder/documents/:kind/:slug        — public, published only
//   GET    /api/builder/public/:slug                 — public, published form|quiz by slug
//   POST   /api/builder/public/:slug/submit           — public, { answers } → validate/score/store
//   GET    /api/builder/public/funnel/:slug           — public, funnel + its published steps' full documents
//   GET    /api/builder/admin/documents?kind=        — admin, list (all statuses)
//   GET    /api/builder/admin/documents/:id          — admin, one document
//   GET    /api/builder/admin/documents/:id/submissions — admin, list submissions
//   GET    /api/builder/admin/documents/:id/steps     — admin, list a funnel's ordered steps
//   PUT    /api/builder/admin/documents/:id/steps     — admin, { steps: [{documentId, nextRule}] } → replace all
//   POST   /api/builder/admin/documents              — admin, { kind, title } → draft
//   PATCH  /api/builder/admin/documents/:id           — admin, { title, slug, blocks, meta }
//   POST   /api/builder/admin/documents/:id/publish   — admin
//   POST   /api/builder/admin/documents/:id/archive   — admin
//   DELETE /api/builder/admin/documents/:id           — admin
import { getSessionEmail } from "../../_lib/session.js";
import { getUserByEmail } from "../../_lib/db.js";
import { isAdmin } from "../../_lib/rbac.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

const VALID_KINDS = ["page", "form", "quiz", "funnel"];

const slugify = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (á→a) instead of dropping the letter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || uid();

async function requireAdmin(request, env) {
  const email = await getSessionEmail(request, env);
  const user = email ? await getUserByEmail(env.DB, email) : null;
  return user && isAdmin(user) ? user : null;
}

function parseDoc(row) {
  if (!row) return row;
  return {
    ...row,
    blocks: JSON.parse(row.blocks || "[]"),
    meta: row.meta ? JSON.parse(row.meta) : null,
  };
}

// Never trust a client-supplied score — recompute from the document's own
// blocks, same principle QualificacaoSection.tsx's scoreQualification
// already established for the qualification form.
function scoreQuiz(blocks, answers) {
  let score = 0;
  for (const block of blocks) {
    if (block.type !== "quiz_question") continue;
    const options = block.props?.options || [];
    const answer = answers[block.id];
    if (answer == null) continue;
    const selected = Array.isArray(answer) ? answer : [answer];
    for (const val of selected) {
      const opt = options.find((o) => o.value === val);
      if (opt) score += Number(opt.scoreWeight) || 0;
    }
  }
  return score;
}

function tierForScore(scoringRules, score) {
  const tiers = scoringRules?.tiers;
  if (!Array.isArray(tiers)) return null;
  for (const t of tiers) {
    const min = t.min ?? -Infinity;
    const max = t.max ?? Infinity;
    if (score >= min && score <= max) return t.label ?? null;
  }
  return null;
}

function validateFormAnswers(blocks, answers) {
  for (const block of blocks) {
    if (block.type !== "form_field") continue;
    if (block.props?.required) {
      const val = answers[block.id];
      if (val == null || val === "") return `Campo obrigatório: ${block.props.label || block.id}`;
    }
  }
  return null;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  if (!db) return json({ error: "D1 (DB) não vinculado." }, 500);

  const seg = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const method = request.method;

  try {
    // ── public: fetch a published document by kind + slug ─────────────────
    if (seg[0] === "documents" && seg[1] && seg[2] && method === "GET") {
      const [, kind, slug] = seg;
      const doc = await db
        .prepare("SELECT * FROM builder_documents WHERE kind = ? AND slug = ? AND status = 'published'")
        .bind(kind, slug)
        .first();
      if (!doc) return json({ error: "not found" }, 404);
      return json({ document: parseDoc(doc) });
    }

    // ── public: fetch a published form|quiz by slug (kind-agnostic — the
    // /f/:slug marketing route doesn't know ahead of time which one it is) ─
    if (seg[0] === "public" && seg[1] && !seg[2] && method === "GET") {
      const doc = await db
        .prepare("SELECT * FROM builder_documents WHERE slug = ? AND status = 'published' AND kind IN ('form', 'quiz')")
        .bind(seg[1])
        .first();
      if (!doc) return json({ error: "not found" }, 404);
      return json({ document: parseDoc(doc) });
    }

    // ── public: fetch a published funnel + its published steps (each step's
    // full document, so the client doesn't need N extra round-trips) ──────
    if (seg[0] === "public" && seg[1] === "funnel" && seg[2] && method === "GET") {
      const funnel = await db
        .prepare("SELECT * FROM builder_documents WHERE slug = ? AND status = 'published' AND kind = 'funnel'")
        .bind(seg[2])
        .first();
      if (!funnel) return json({ error: "not found" }, 404);
      const { results } = await db
        .prepare(
          `SELECT fs.step_index, fs.next_rule, d.id as document_id, d.kind, d.slug, d.title, d.blocks
           FROM builder_funnel_steps fs JOIN builder_documents d ON d.id = fs.document_id
           WHERE fs.funnel_id = ? AND d.status = 'published' ORDER BY fs.step_index`
        )
        .bind(funnel.id)
        .all();
      const steps = results.map((r) => ({
        stepIndex: r.step_index,
        nextRule: r.next_rule ? JSON.parse(r.next_rule) : null,
        documentId: r.document_id,
        kind: r.kind,
        slug: r.slug,
        title: r.title,
        blocks: JSON.parse(r.blocks || "[]"),
      }));
      return json({ funnel: { id: funnel.id, slug: funnel.slug, title: funnel.title }, steps });
    }

    // ── public: submit a form|quiz response ────────────────────────────────
    if (seg[0] === "public" && seg[1] && seg[2] === "submit" && method === "POST") {
      const doc = await db
        .prepare("SELECT * FROM builder_documents WHERE slug = ? AND status = 'published' AND kind IN ('form', 'quiz')")
        .bind(seg[1])
        .first();
      if (!doc) return json({ error: "not found" }, 404);
      const body = await request.json().catch(() => ({}));
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
      const blocks = JSON.parse(doc.blocks || "[]");

      if (doc.kind === "form") {
        const err = validateFormAnswers(blocks, answers);
        if (err) return json({ error: err }, 400);
        await db
          .prepare("INSERT INTO builder_submissions (id, document_id, kind, answers) VALUES (?, ?, 'form', ?)")
          .bind(uid(), doc.id, JSON.stringify(answers))
          .run();
        return json({ ok: true }, 201);
      }

      // quiz
      const meta = doc.meta ? JSON.parse(doc.meta) : null;
      const score = scoreQuiz(blocks, answers);
      const tier = tierForScore(meta?.scoringRules, score);
      await db
        .prepare("INSERT INTO builder_submissions (id, document_id, kind, answers, score, tier) VALUES (?, ?, 'quiz', ?, ?, ?)")
        .bind(uid(), doc.id, JSON.stringify(answers), score, tier)
        .run();
      return json({ ok: true, score, tier }, 201);
    }

    // ── admin ────────────────────────────────────────────────────────────
    if (seg[0] === "admin") {
      const user = await requireAdmin(request, env);
      if (!user) return json({ error: "forbidden" }, 403);

      if (seg[1] === "documents" && !seg[2] && method === "GET") {
        const kind = new URL(request.url).searchParams.get("kind");
        const where = kind ? "WHERE kind = ?" : "";
        const { results } = await db
          .prepare(`SELECT * FROM builder_documents ${where} ORDER BY updated_at DESC`)
          .bind(...(kind ? [kind] : []))
          .all();
        return json({ documents: results.map(parseDoc) });
      }

      if (seg[1] === "documents" && !seg[2] && method === "POST") {
        const body = await request.json().catch(() => ({}));
        if (!VALID_KINDS.includes(body.kind)) return json({ error: "kind inválido" }, 400);
        if (!body.title) return json({ error: "title obrigatório" }, 400);
        const id = uid();
        const slug = slugify(body.slug || body.title);
        const existing = await db
          .prepare("SELECT 1 FROM builder_documents WHERE kind = ? AND slug = ?")
          .bind(body.kind, slug)
          .first();
        if (existing) return json({ error: "já existe um documento com esse slug" }, 409);
        await db
          .prepare(
            `INSERT INTO builder_documents (id, kind, slug, title, blocks, created_by) VALUES (?, ?, ?, ?, '[]', ?)`
          )
          .bind(id, body.kind, slug, body.title, user.email)
          .run();
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(id).first();
        return json({ document: parseDoc(doc) }, 201);
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "GET") {
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(seg[2]).first();
        if (!doc) return json({ error: "not found" }, 404);
        return json({ document: parseDoc(doc) });
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "PATCH") {
        const body = await request.json().catch(() => ({}));
        const fields = {};
        for (const f of ["title"]) if (f in body) fields[f] = body[f];
        if ("slug" in body) fields.slug = slugify(body.slug);
        if ("blocks" in body) fields.blocks = JSON.stringify(body.blocks);
        if ("meta" in body) fields.meta = body.meta ? JSON.stringify(body.meta) : null;
        if (!Object.keys(fields).length) return json({ error: "nada para atualizar" }, 400);
        if (fields.slug) {
          const clash = await db
            .prepare(
              "SELECT 1 FROM builder_documents WHERE slug = ? AND id != ? AND kind = (SELECT kind FROM builder_documents WHERE id = ?)"
            )
            .bind(fields.slug, seg[2], seg[2])
            .first();
          if (clash) return json({ error: "já existe um documento com esse slug" }, 409);
        }
        const cols = Object.keys(fields);
        await db
          .prepare(`UPDATE builder_documents SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`)
          .bind(...cols.map((c) => fields[c]), seg[2])
          .run();
        const doc = await db.prepare("SELECT * FROM builder_documents WHERE id = ?").bind(seg[2]).first();
        return json({ document: parseDoc(doc) });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "submissions" && method === "GET") {
        const { results } = await db
          .prepare("SELECT * FROM builder_submissions WHERE document_id = ? ORDER BY created_at DESC")
          .bind(seg[2])
          .all();
        return json({ submissions: results.map((r) => ({ ...r, answers: JSON.parse(r.answers || "{}") })) });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "steps" && method === "GET") {
        const { results } = await db
          .prepare(
            `SELECT fs.step_index, fs.document_id, fs.next_rule, d.kind, d.slug, d.title, d.status
             FROM builder_funnel_steps fs JOIN builder_documents d ON d.id = fs.document_id
             WHERE fs.funnel_id = ? ORDER BY fs.step_index`
          )
          .bind(seg[2])
          .all();
        return json({ steps: results.map((r) => ({ ...r, next_rule: r.next_rule ? JSON.parse(r.next_rule) : null })) });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "steps" && method === "PUT") {
        const body = await request.json().catch(() => ({}));
        const steps = Array.isArray(body.steps) ? body.steps : [];
        const stmts = [db.prepare("DELETE FROM builder_funnel_steps WHERE funnel_id = ?").bind(seg[2])];
        steps.forEach((s, i) => {
          stmts.push(
            db
              .prepare("INSERT INTO builder_funnel_steps (funnel_id, step_index, document_id, next_rule) VALUES (?, ?, ?, ?)")
              .bind(seg[2], i, s.documentId, s.nextRule ? JSON.stringify(s.nextRule) : null)
          );
        });
        await db.batch(stmts);
        return json({ ok: true });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "publish" && method === "POST") {
        await db
          .prepare(
            `UPDATE builder_documents SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
          )
          .bind(seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "documents" && seg[2] && seg[3] === "archive" && method === "POST") {
        await db
          .prepare(`UPDATE builder_documents SET status = 'archived', updated_at = datetime('now') WHERE id = ?`)
          .bind(seg[2])
          .run();
        return json({ ok: true });
      }

      if (seg[1] === "documents" && seg[2] && !seg[3] && method === "DELETE") {
        await db.prepare("DELETE FROM builder_documents WHERE id = ?").bind(seg[2]).run();
        return json({ ok: true });
      }

      return json({ error: "Not found" }, 404);
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("builder error:", e && e.stack);
    return json({ error: e.message ?? "Server error" }, 500);
  }
}
