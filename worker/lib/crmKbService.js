// Knowledge base for the Business Specialist Copilot — same retrieval
// pattern as growth/apps/codigo-internacional's worker/src/services/ci/kbService.js
// (two-tier keyword-overlap scoring: approved FAQ pairs ranked first, then
// raw source documents), re-scoped to Tektone's own service catalog instead
// of legal source-of-truth material. No FTS5/embeddings here either — same
// reasoning as the reference: a single company's service catalog is small
// enough that bounded keyword-overlap scoring is good enough.
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export async function createKbDocument(db, { tier, topic, title, content, createdBy, promotedFromQuestionId = null }) {
  const id = uid();
  await db
    .prepare(
      `INSERT INTO kb_documents (id, tier, topic, title, content, status, promoted_from_question_id, created_by)
       VALUES (?, ?, ?, ?, ?, 'ready', ?, ?)`
    )
    .bind(id, tier, topic || null, title, content || null, promotedFromQuestionId, createdBy || null)
    .run();
  return db.prepare("SELECT * FROM kb_documents WHERE id = ?").bind(id).first();
}

export async function listKbDocuments(db) {
  const { results } = await db
    .prepare("SELECT * FROM kb_documents WHERE archived_at IS NULL ORDER BY created_at DESC")
    .all();
  return results;
}

export async function archiveKbDocument(db, id) {
  await db.prepare("UPDATE kb_documents SET archived_at = datetime('now') WHERE id = ?").bind(id).run();
}

export async function promoteQuestionToFaq(db, question) {
  return createKbDocument(db, {
    tier: "faq",
    title: (question.question_text || "Direção sugerida").replace(/\s+/g, " ").trim().slice(0, 120),
    content: `Pergunta: ${question.question_text || "(sugestão de direções, sem pergunta específica)"}\n\nResposta aprovada: ${question.ai_draft_answer}`,
    createdBy: question.asked_by_email,
    promotedFromQuestionId: question.id,
  });
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (Portuguese-aware, matches CI's kbService.js)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function scoreOverlap(queryTokens, doc) {
  const hay = tokenize(`${doc.title} ${doc.topic || ""} ${doc.content || ""}`);
  if (!hay.length) return 0;
  const haySet = new Set(hay);
  let hits = 0;
  for (const t of queryTokens) if (haySet.has(t)) hits++;
  return hits;
}

export async function retrieveContext(db, queryText, { faqLimit = 2, docLimit = 2, charBudget = 2200 } = {}) {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.length) return [];

  const [faqs, docs] = await Promise.all([
    db.prepare(`SELECT * FROM kb_documents WHERE tier = 'faq' AND status = 'ready' ORDER BY created_at DESC LIMIT 200`).all(),
    db.prepare(`SELECT * FROM kb_documents WHERE tier != 'faq' AND status = 'ready' ORDER BY created_at DESC LIMIT 200`).all(),
  ]);

  const rankAndTrim = (rows, limit) =>
    rows.results
      .map((d) => ({ doc: d, score: scoreOverlap(queryTokens, d) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.doc);

  const topFaqs = rankAndTrim(faqs, faqLimit);
  const topDocs = rankAndTrim(docs, docLimit);

  const selected = [];
  let used = 0;
  for (const doc of [...topFaqs, ...topDocs]) {
    const excerpt = String(doc.content || "").slice(0, 1200);
    if (used + excerpt.length > charBudget && selected.length > 0) break;
    selected.push({ id: doc.id, title: doc.title, tier: doc.tier, excerpt });
    used += excerpt.length;
  }
  return selected;
}
