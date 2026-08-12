-- Brand knowledge base + AI Instagram post generator (Tektone Hub AI
-- Instagram Post Generator PRD, 2026-08-12). Two tables:
--
-- brand_kb — structured reference content (palette/type/voice/logo/
-- constraint/positioning), seeded once from three cross-checked sources
-- (TEKTONE BRAND GUIDE.pdf, the live /brand page, docs/BRAND.md) — see
-- docs/BRAND_VISUAL_SYSTEM.md for the full writeup and the one PRD
-- transcription error it corrects (Mineral Black is #141618, not the
-- PRD's #14161B). This is a structured-data problem, not a retrieval
-- one — no embeddings/RAG, just typed rows the master-prompt builder and
-- the canvas overlay step both read from, so brand rules live in one
-- place instead of hardcoded twice. Modeled loosely on kb_documents
-- (migrations/0010_hub_crm_kb.sql) but kept as its own table since this
-- is hub-wide reference content unrelated to CRM leads and shouldn't
-- require crm_role to read.
--
-- social_posts — one row per generated asset (the PRD's "Gallery" /
-- Asset Management feature). Stores the exact master_prompt used for
-- auditability/reuse, not just the image.

CREATE TABLE IF NOT EXISTS brand_kb (
  id               TEXT PRIMARY KEY,
  category         TEXT NOT NULL, -- 'palette' | 'typography' | 'voice' | 'logo' | 'constraint' | 'positioning'
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  structured_value TEXT,          -- nullable JSON, e.g. palette rows: {"hex":"#2E4A43","cmyk":"75/45/60/55","role":"..."}
  source           TEXT NOT NULL, -- 'pdf' | 'brand_page' | 'culture_doc'
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_brand_kb_category ON brand_kb(category, sort_order);

CREATE TABLE IF NOT EXISTS social_posts (
  id              TEXT PRIMARY KEY,
  created_by      TEXT NOT NULL,  -- FK users.email
  objective       TEXT NOT NULL,  -- 'autoridade' | 'conversao' | 'bastidores'
  subject_context TEXT NOT NULL,
  visual_tone     TEXT NOT NULL,
  master_prompt   TEXT NOT NULL,  -- the actual engineered prompt sent to Workers AI
  r2_key          TEXT NOT NULL,
  aspect_ratio    TEXT NOT NULL DEFAULT '1080x1080', -- '1080x1080' | '1080x1350'
  status          TEXT NOT NULL DEFAULT 'draft',     -- 'draft' | 'exported'
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at);

-- ── Seed: palette (verified hex/cmyk, docs/BRAND_VISUAL_SYSTEM.md) ─────────
INSERT INTO brand_kb (id, category, title, content, structured_value, source, sort_order) VALUES
('bkb-pal-1', 'palette', 'Mineral Black (Ink)', 'Texto e estrutura. Fundo do manifesto e dos usos invertidos.', '{"hex":"#141618","cmyk":"0/0/0/95","role":"text, structure, inverted-lockup background"}', 'pdf', 1),
('bkb-pal-2', 'palette', 'Mineral Green', 'Ação primária, links, foco. O fuste da coluna.', '{"hex":"#2E4A43","cmyk":"75/45/60/55","role":"primary action, links, focus"}', 'pdf', 2),
('bkb-pal-3', 'palette', 'Mineral Sand', 'Arquitrave e fundação do símbolo. Bordas quentes, acentos secundários.', '{"hex":"#C7B79C","cmyk":"15/25/40/10","role":"secondary accent, warm borders"}', 'pdf', 3),
('bkb-pal-4', 'palette', 'Ivory Clay', 'Fundo dominante da marca. Base sobre a qual tudo se assenta.', '{"hex":"#EFE8DC","cmyk":"5/8/15/0","role":"dominant background"}', 'pdf', 4),
('bkb-pal-5', 'palette', 'Usage ratio', 'Proporção de uso recomendada entre as quatro cores minerais.', '{"black":25,"green":15,"sand":10,"ivory":50}', 'pdf', 5);

-- ── Seed: typography ────────────────────────────────────────────────────
INSERT INTO brand_kb (id, category, title, content, structured_value, source, sort_order) VALUES
('bkb-typ-1', 'typography', 'Display / Headlines', 'Inter, pesos 300 e 600. Uso em títulos e destaques.', '{"family":"Inter","weights":[300,600],"use":"display, headlines"}', 'pdf', 1),
('bkb-typ-2', 'typography', 'Editorial / Quotes / Latin', 'EB Garamond, itálico 400. Uso em citações editoriais e frases em latim.', '{"family":"EB Garamond","weights":["italic 400"],"use":"editorial, quotes, latin phrases"}', 'pdf', 2),
('bkb-typ-3', 'typography', 'Mono / UI / Captions', 'JetBrains Mono, pesos 400 e 500. Uso em interface, legendas e códigos.', '{"family":"JetBrains Mono","weights":[400,500],"use":"UI, captions, codes"}', 'pdf', 3);

-- ── Seed: voice ─────────────────────────────────────────────────────────
INSERT INTO brand_kb (id, category, title, content, source, sort_order) VALUES
('bkb-voi-1', 'voice', 'Tom de voz', 'Tektone fala devagar. Nunca grita. Quando precisa cortar, corta com clareza.', 'pdf', 1),
('bkb-voi-2', 'voice', 'Instagram não é o centro', 'A marca não é o que aparece no Instagram. É o que aparece quando você assina o contrato. Não superindexar em polish social às custas do que realmente importa.', 'pdf', 2);

-- ── Seed: logo construction ─────────────────────────────────────────────
INSERT INTO brand_kb (id, category, title, content, source, sort_order) VALUES
('bkb-log-1', 'logo', 'Construção do T — três camadas', 'Architrave (viga horizontal, núcleo preto + borda sand revelada), Pillar (suporte vertical, verde externo + núcleo preto + uma flauta sand), Foundation (base, quatro estratos: areia, pedra, horizonte, eco). Grid 10x10, centro óptico no eixo 5,5. Espaço livre >= 1 unidade de grid em todos os lados.', 'pdf', 1),
('bkb-log-2', 'logo', 'Sigillum Gordii — selo secundário', 'Selo institucional em padrão meandro grego. Uso restrito: contratos, equity, papelaria fundadora — não para conteúdo social/marketing geral.', 'pdf', 2);

-- ── Seed: hard constraint ───────────────────────────────────────────────
INSERT INTO brand_kb (id, category, title, content, source, sort_order) VALUES
('bkb-con-1', 'constraint', 'Sem glow, sombra neon ou halos', 'Não aplicar glow, sombra neon ou halos luminosos em ativos do Sistema Mineral — esse vocabulário pertence ao site institucional, não à identidade central da marca. Qualquer overlay de canvas/pós-processamento deve evitar drop-shadow glow, neon ou halo.', 'brand_page', 1);

-- ── Seed: positioning (condensed from docs/BRAND.md) ────────────────────
INSERT INTO brand_kb (id, category, title, content, source, sort_order) VALUES
('bkb-pos-1', 'positioning', 'Categoria', 'A TEKTONE é uma consultoria de tecnologia e negócios sob medida — não uma software house, não uma agência de marketing, não uma fábrica de apps genéricos.', 'culture_doc', 1),
('bkb-pos-2', 'positioning', 'O que se vende', 'Vende-se o processo (qualificação, diagnóstico, desenho, alinhamento, construção, acompanhamento), não a lista de entregáveis. Os produtos finais variam por cliente; o processo não.', 'culture_doc', 2),
('bkb-pos-3', 'positioning', 'Tese central', 'Crescimento sustentável não nasce de acúmulo. Nasce de arquitetura. O problema do cliente raramente é falta de ferramenta — é excesso sem direção.', 'culture_doc', 3),
('bkb-pos-4', 'positioning', 'Público-alvo', 'Empresários e operadores de negócio validados, 30-50 anos, cuja estrutura está atrasada em relação ao potencial real da empresa. Não fala com curiosos.', 'culture_doc', 4),
('bkb-pos-5', 'positioning', 'Autoridade', 'Prova por resultado específico e demonstração de raciocínio geram mais autoridade do que promessas amplas. Conteúdo de "autoridade" deve mostrar como a Tektone pensa, não apenas afirmar competência.', 'culture_doc', 5),
('bkb-pos-6', 'positioning', 'Conversão', 'A mensagem de conversão une clareza e autoridade: não basta parecer sofisticado, é preciso ser entendido — sempre reforçando confiança antes de empurrar oferta.', 'culture_doc', 6),
('bkb-pos-7', 'positioning', 'Bastidores', 'Conteúdo de bastidores mostra transparência de processo — etapas, critério, acompanhamento — e a identidade compartilhada dos fundadores como empresários que entendem risco e operação real, não apenas técnicos.', 'culture_doc', 7);
