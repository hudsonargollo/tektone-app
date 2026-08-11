-- Phase 11 — AI-authored blog, curated by admin (Hudson). Scheduled
-- generation (Cloudflare Cron Trigger on tektone-hub) drafts posts
-- autonomously from a fixed set of content pillars; nothing goes live
-- without an ADMIN approving it. Same isolation principle as elsewhere in
-- this app: the AI never publishes directly, a human always reviews first
-- (mirrors kb_documents/customer_questions' approval pattern in the
-- codigo-internacional reference CRM).
--
-- Illustrations are NOT generated fresh per article by the scheduled
-- Worker — quality risk from an automated model run unsupervised. Instead
-- a curated pool of illustrations per pillar (generated once, by hand, in
-- the house style established for /login) lives as static files under
-- marketing/public/blog/<pillar>/, and cover_illustration just stores
-- which filename got assigned. See docs/ARCHITECTURE.md.

CREATE TABLE IF NOT EXISTS blog_pillars (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Guidance folded into the generation prompt — tone, angle, examples of
  -- what belongs in this pillar. Free text, edited by the admin over time.
  prompt_seed TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id                   TEXT PRIMARY KEY,
  pillar_id            TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  excerpt              TEXT NOT NULL,
  content              TEXT NOT NULL, -- markdown
  cover_illustration   TEXT, -- filename under marketing/public/blog/<pillar_slug>/
  status               TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | published | rejected
  ai_generated         INTEGER NOT NULL DEFAULT 1,
  generation_prompt    TEXT, -- the actual prompt sent to Claude, kept for audit/debugging
  reviewed_by_email    TEXT,
  reviewed_at          TEXT,
  reviewer_notes       TEXT,
  published_at         TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_pillar ON blog_posts(pillar_id);

-- Seed pillars inferred from the marketing site's existing copy (see
-- ObjetivoSection's three buyer personas + AutoridadeSection's
-- authority/case-study angle) — editable later via the admin panel.
INSERT INTO blog_pillars (id, name, slug, description, prompt_seed) VALUES
  ('automacao-sistemas', 'Automação & Sistemas', 'automacao-sistemas',
   'Para o empresário que construiu uma empresa que depende demais dele e precisa de uma operação mais organizada e eficiente.',
   'Escreva sobre automação de processos internos, sistemas que reduzem dependência do fundador, e como recuperar tempo operacional. Tom consultivo, direto, com exemplos concretos de gargalos operacionais comuns. Nunca genérico ou raso — cada artigo deve ensinar algo específico e acionável.'),
  ('produtos-digitais', 'Produtos Digitais', 'produtos-digitais',
   'Para quem quer transformar uma ideia em realidade: aplicativo, produto, nova marca ou fonte de receita.',
   'Escreva sobre como validar e construir produtos digitais (apps, SaaS, novas linhas de receita), decisões técnicas e estratégicas do processo de criação. Tom de arquiteto estratégico, não de tutorial técnico raso.'),
  ('crescimento-receita', 'Crescimento & Receita', 'crescimento-receita',
   'Para quem sabe que existe mais potencial dentro da empresa atual: vender mais, melhorar processos, aumentar eficiência.',
   'Escreva sobre estratégias de crescimento, otimização de processos comerciais, e como transformar tecnologia em nova receita recorrente (SaaS, equity). Tom consultivo e orientado a resultado mensurável.'),
  ('casos-bastidores', 'Casos & Bastidores', 'casos-bastidores',
   'Bastidores de como a Tektone constrói — autoridade e prova social, sem estudo de caso genérico.',
   'Escreva sobre o processo real de construção da Tektone (as três fases: diagnóstico, construção, transformação em receita), decisões de arquitetura, e a filosofia por trás de "duas empresas por mês". Tom pessoal, na voz de quem constrói, nunca promocional.');
