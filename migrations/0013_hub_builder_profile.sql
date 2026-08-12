-- "Builder profile" gamification: daily task-completion tracking, XP/levels,
-- and a collectible skill-card deck (stoic + biblical wisdom) unlocked as
-- builders level up. Two independent accumulators per builder: a global
-- profile (builder_profiles) and one row per project they've worked on
-- (builder_project_profiles) — the latter exists because the feature
-- explicitly wants a "mirrored" card that tracks only the XP earned within
-- a single project, shown on that project's page, separate from the
-- builder's overall standing.
--
-- Scoring is derived from existing task data (tasks.reviewed/reviewed_at/
-- due_date) plus task_events, a new append-only log this migration adds —
-- tasks has no completed_at or effort-estimate column, so task_events is
-- what makes a real "cycle speed" component possible (time from first
-- entering "inprogress" to being marked reviewed), not just a same-day
-- on-time/late check against due_date. Written at the application layer
-- (functions/_lib/gamification.js + the kanban route), not via a trigger —
-- tasksStore.js's D1 write path does a full DELETE+reinsert of the whole
-- `tasks` table on every save (see tasksStore.js), so a row-level trigger
-- watching column_id changes would fire for every row on every save.
--
-- Visibility (enforced at the app layer, not here): a builder can read only
-- their own builder_profiles/builder_project_profiles/builder_cards row;
-- ADMIN (users.access_role) can read anyone's. No public leaderboard in v1.

CREATE TABLE IF NOT EXISTS task_events (
  id           TEXT PRIMARY KEY,
  task_id      TEXT NOT NULL,
  project_id   TEXT,
  from_column  TEXT,
  to_column    TEXT NOT NULL,
  actor_email  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_project ON task_events(project_id);

CREATE TABLE IF NOT EXISTS builder_profiles (
  email             TEXT PRIMARY KEY,   -- FK users.email
  xp                INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 1,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_active_date  TEXT,               -- YYYY-MM-DD, last day with >=1 reviewed task
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS builder_daily_stats (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL,       -- FK users.email
  stat_date        TEXT NOT NULL,       -- YYYY-MM-DD
  tasks_completed  INTEGER NOT NULL DEFAULT 0,
  tasks_on_time    INTEGER NOT NULL DEFAULT 0,
  avg_cycle_hours  REAL,
  xp_earned        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(email, stat_date)
);
CREATE INDEX IF NOT EXISTS idx_builder_daily_stats_email ON builder_daily_stats(email);

CREATE TABLE IF NOT EXISTS builder_project_profiles (
  email       TEXT NOT NULL,   -- FK users.email
  project_id  TEXT NOT NULL,   -- FK projects.id
  xp          INTEGER NOT NULL DEFAULT 0,
  level       INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (email, project_id)
);

-- level_req is the level at which this card unlocks (1:1 with levels 1-12
-- in v1 — a deliberate content ceiling, not a bug: levels beyond 12 still
-- accrue normally, they just have no new card to unlock until more are
-- authored).
CREATE TABLE IF NOT EXISTS skill_cards (
  id            TEXT PRIMARY KEY,
  level_req     INTEGER NOT NULL,
  skill_name    TEXT NOT NULL,
  stoic_quote   TEXT NOT NULL,
  stoic_source  TEXT NOT NULL,
  bible_verse   TEXT NOT NULL,
  bible_ref     TEXT NOT NULL,
  sort_order    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- project_id NULL = personal/global unlock (crossed this level_req on
-- builder_profiles); project_id set = unlocked via that project's scoped
-- level (builder_project_profiles) — a builder can unlock the same card
-- both personally and per-project; that's intended, not a duplicate.
CREATE TABLE IF NOT EXISTS builder_cards (
  email        TEXT NOT NULL,   -- FK users.email
  card_id      TEXT NOT NULL,   -- FK skill_cards.id
  project_id   TEXT,            -- FK projects.id, NULL for a global unlock
  unlocked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
-- SQLite treats NULL as distinct across rows in a composite PRIMARY KEY, so
-- a plain PK(email, card_id, project_id) would let a global unlock
-- (project_id NULL) be inserted twice. A COALESCE'd unique index dedupes
-- both the global and per-project cases correctly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_cards_unique
  ON builder_cards(email, card_id, COALESCE(project_id, ''));

INSERT INTO skill_cards (id, level_req, skill_name, stoic_quote, stoic_source, bible_verse, bible_ref, sort_order) VALUES
('card-01', 1,  'Disciplina',       'Você tem poder sobre sua mente, não sobre eventos externos. Perceba isso, e encontrará força.', 'Marco Aurélio, Meditações', 'Aquele que domina o seu espírito é melhor do que o que toma uma cidade.', 'Provérbios 16:32', 1),
('card-02', 2,  'Diligência',       'Não é porque as coisas são difíceis que não ousamos, é porque não ousamos que são difíceis.', 'Sêneca', 'A mão dos diligentes dominará, mas a mão preguiçosa ficará sob tributo.', 'Provérbios 12:24', 2),
('card-03', 3,  'Paciência',        'Não é o que acontece com você, mas como você reage a isso, que importa.', 'Epicteto, Enquiridion', 'O fim das coisas é melhor do que o princípio delas; e o paciente de espírito é melhor do que o altivo de espírito.', 'Eclesiastes 7:8', 3),
('card-04', 4,  'Foco',             'Concentre-se apenas no que está diante de você, como se fosse a última coisa que você faz na vida.', 'Marco Aurélio, Meditações', 'Os teus olhos olhem direto para diante de ti, e as tuas pálpebras olhem bem em frente de ti.', 'Provérbios 4:25', 4),
('card-05', 5,  'Humildade',        'Nenhum homem é livre se não é senhor de si mesmo.', 'Epicteto', 'Antes da quebra vem a soberba, e antes da queda, o espírito altivo.', 'Provérbios 16:18', 5),
('card-06', 6,  'Coragem',          'Não busque que as coisas aconteçam como você deseja, mas deseje que elas aconteçam como acontecem, e você viverá em paz.', 'Epicteto, Enquiridion', 'Sê forte e corajoso; não temas, nem te espantes; porque o Senhor teu Deus é contigo, por onde quer que andares.', 'Josué 1:9', 6),
('card-07', 7,  'Excelência',       'Faze cada ato da vida como se fosse o último.', 'Marco Aurélio, Meditações', 'Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.', 'Eclesiastes 9:10', 7),
('card-08', 8,  'Integridade',      'Nunca estime como vantagem para si algo que um dia o obrigue a quebrar sua palavra ou perder o respeito por si mesmo.', 'Marco Aurélio, Meditações', 'A integridade dos retos os encaminhará, mas a perversidade dos aleivosos os destruirá.', 'Provérbios 11:3', 8),
('card-09', 9,  'Perseverança',     'A dificuldade mostra o que os homens são.', 'Epicteto', 'Não nos cansemos de fazer o bem, pois a seu tempo colheremos, se não desfalecermos.', 'Gálatas 6:9', 9),
('card-10', 10, 'Domínio Próprio',  'Se você quer melhorar, esteja disposto a ser considerado tolo e estúpido em relação às coisas externas.', 'Epicteto', 'Como a cidade derribada, sem muro, assim é o homem que não pode conter o seu espírito.', 'Provérbios 25:28', 10),
('card-11', 11, 'Sabedoria',        'Não é o homem que tem pouco, mas o que deseja mais, que é pobre.', 'Sêneca', 'Pela sabedoria se edifica a casa, e pelo entendimento ela se firma.', 'Provérbios 24:3', 11),
('card-12', 12, 'Visão',            'O obstáculo à ação avança a ação. O que está no caminho torna-se o caminho.', 'Marco Aurélio, Meditações', 'Sem visão, o povo perece; mas o que guarda a lei esse é bem-aventurado.', 'Provérbios 29:18', 12);
