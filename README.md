# TEKTONE — Operações

Private team Kanban + meeting-intelligence app for **TEKTONE**. A Trello-style board
where meeting notes turn into tasks automatically, with comments, material requests,
@mention notifications (in-app + email), and a full mobile interface.

- **Live:** <https://tasks.tektone.com.br> (also `tektone-app.pages.dev`)
- **Stack:** React 19 + Vite + Tailwind v4 + Framer Motion · Cloudflare Pages Functions + KV
- **Access:** closed — only the 3 allowlisted `@tektone.com.br` emails can sign in.

---

## Features

### Board & cards
- **5 columns** (Backlog · A Fazer · Em Andamento · Em Revisão · Concluído) with
  drag-and-drop, collapsible columns (desktop), and a search + priority filter.
- **Projects** (clients) in the sidebar; scope the board to one project or see all.
- **Cards** carry: title, description, **multiple assignees** (avatars), priority,
  due date (custom calendar), status, highlight color, **checklist** (with progress),
  **links & references**, and a **comment thread**.
- **Card badges** show checklist progress, link/comment counts, open-request count,
  and a ✨ *reunião* tag for AI-generated cards.

### Comments & material requests
- Threaded **comments** per card; any comment can be flagged a **solicitação** (material
  request) and later **marcada como atendida**.
- **@mentions** with autocomplete; mentioned teammates get notified.
- A **filter / bottom-nav tab** surfaces every card with an open request.

### Notifications
- **In-app bell** with per-user unread counts (polls every 60s); deep-links open the card.
- **Email** on @mention via Resend — branded HTML (Mineral palette), embedded author
  photo, reply-to the commenter, and a deep link back to the exact card.

### Meeting Intelligence (Claude)
- **Automatic:** a Google Apps Script polls Drive for new Gemini meeting-notes Docs and
  posts the transcript to the app, which runs Claude to extract a **summary + decisions
  + risks + action items**, saves them to the right project (auto-created if missing),
  and records a **validation popup** shown on next login.
- **Interactive:** the **reuniões** button opens *Inteligência de Reuniões* — paste a
  transcript (or, admin-only, pick one from Drive), review, pick the project, save.
- **Admin "buscar":** list and on-demand import meetings from Drive.
- Full setup is documented in **[`automation/README.md`](automation/README.md)**.

### Profiles & admin
- Per-user **profile** (photo upload, role, phone, location, bio); photos appear on
  card avatars across the team.
- **Admin** (Hudson) can reset accounts and run the meeting fetch.

### Mobile
- **Bottom nav:** Quadro · Solicitações · Reuniões · Perfil (full-screen destinations;
  Perfil is a bottom sheet).
- **One column at a time**, swipe to switch; cards scroll within the column (no page
  scroll). Solicitações shows a flat list of all open requests.
- **Card editor** is a draggable bottom sheet; keyboard opens only when a field is tapped.

---

## Architecture

```
React SPA (src/)  ──fetch──>  Cloudflare Pages Functions (functions/api/*)  ──>  KV (KANBAN)
                                         │
        Apps Script (Drive) ──token──────┘   Claude (analysis) · Resend (email)
```

- **Frontend:** `src/` — `App.jsx` orchestrates; components in `src/components/`,
  API client in `src/lib/api.js`, board config/palette in `src/lib/constants.js`.
- **Backend:** Cloudflare Pages Functions under `functions/api/` (file-based routing,
  catch-all `[[path]].js`). All state lives in one KV namespace, **`KANBAN`**.
- **Auth:** email allowlist + signed-cookie sessions (`functions/_lib/`). The
  `_middleware.js` guards every `/api/kanban/*` request.

---

## API / Functions reference

All under `/api`. `kanban/*` requires a valid session cookie (enforced by middleware).

### `functions/api/auth/[[path]].js` — accounts & identity
| Route | Method | Purpose |
|---|---|---|
| `/auth/check` | POST | Is this email allowed / does an account exist (email-first login) |
| `/auth/signup` | POST | First-access account creation (PBKDF2 password) |
| `/auth/login` | POST | Sign in → sets `tk_session` cookie |
| `/auth/logout` | POST | Clear session |
| `/auth/me` | GET | Current session: `{ authed, email, admin, name, avatar }` |
| `/auth/profile` | GET/PUT | Current user's profile (name, role, phone, location, bio, avatar) |
| `/auth/directory` | GET | Teammates' `{ email, name, avatar }` (for card avatars) |
| `/auth/admin/users` · `/auth/admin/reset` | GET · POST | Admin-only: list / reset accounts |

### `functions/api/kanban/[[path]].js` — board data (session-guarded)
| Resource | Routes | Purpose |
|---|---|---|
| `clients` | GET/POST `/clients`, PUT/DELETE `/clients/:id` | Projects |
| `cards` | GET/POST `/cards`, PUT/DELETE `/cards/:id` | Cards |
| `cards/:id/comments` | POST, POST `/:cid/resolve`, DELETE `/:cid` | Comments / material requests (+@mention email) |
| `cards/:id/seen` | POST | Mark a card's comments read (per user) |
| `members` | GET/POST `/members`, PUT/DELETE `/members/:id` | Team members |
| `notifications` | GET | Per-user unread comment notifications |
| `reviews` | GET, POST `/reviews/ack` | Meeting-import validation popup batches |

### `functions/api/analyze/[[path]].js` — meeting intelligence (Claude)
| Route | Auth | Purpose |
|---|---|---|
| `/analyze/meeting` | session | Run Claude → structured analysis (no save) |
| `/analyze/commit` | session | Save reviewed action items + 📝 Resumo card |
| `/analyze/auto` | bearer `INGEST_TOKEN` | Headless analyze + save + review batch (called by Apps Script) |

### `functions/api/ingest/[[path]].js` — simple importer
| Route | Auth | Purpose |
|---|---|---|
| `/ingest/meeting-notes` | bearer `INGEST_TOKEN` | Regex-only "Próximas etapas" → cards (no AI; legacy/alternative) |

### `functions/api/meetings/[[path]].js` — admin Drive fetch (proxy to Apps Script Web App)
| Route | Purpose |
|---|---|
| `/meetings/list` (GET) | List Drive meeting docs (id, title, date, processed) |
| `/meetings/text?id=` (GET) | Fetch one doc's transcript (for the interactive page) |
| `/meetings/process` (POST) | Import selected docs |

### `functions/api/avatar/[[path]].js` — public avatar image
- `GET /api/avatar?email=` → the user's profile photo as an image (so emails can embed it).

---

## Data model (KV: `KANBAN`)

| Key | Shape |
|---|---|
| `kanban:clients` | `[{ id, name, color }]` |
| `kanban:cards` | `[{ id, columnId, title, description, priority, clientId, assignee, assignees[], dueDate, labelColor, checklist[], links[], comments[], source, createdAt }]` |
| `kanban:members` | `[{ id, name, email, role }]` |
| `kanban:reads` | `{ [email]: { [cardId]: lastSeenISO } }` |
| `ingest:docs` | processed-transcript hashes (dedup) |
| `ingest:reviews` | per-batch validation-popup records |
| `auth:users` | `[{ email, name, salt, hash, role, phone, location, bio, avatar, createdAt }]` |

---

## Environment / secrets (Cloudflare Pages → Settings → Variables and secrets)

| Name | Required | Purpose |
|---|---|---|
| `KANBAN` | ✅ (binding) | KV namespace binding (in `wrangler.toml`) |
| `SESSION_SECRET` | ✅ | HMAC key for session cookies |
| `ANTHROPIC_API_KEY` | for AI | Claude API key (meeting analysis) |
| `ANTHROPIC_MODEL` | optional | Override model (default `claude-opus-4-8`) |
| `INGEST_TOKEN` | for automation | Bearer token for `/analyze/auto` + `/ingest/*` + the Web App |
| `RESEND_API_KEY` | optional | Email on @mention (Resend); account: `spacemkt34@gmail.com` |
| `NOTIFY_FROM` | optional | Email sender (default `TEKTONE <notificacoes@tektone.com.br>`) |
| `MEETINGS_WEBAPP_URL` / `MEETINGS_WEBAPP_TOKEN` | for "buscar" | Apps Script Web App URL + shared secret |

Set a secret:
```sh
echo "VALUE" | npx wrangler pages secret put NAME --project-name tektone-app
```

---

## Develop & deploy

```sh
npm install
npm run dev      # Vite dev server (UI only; KV API needs a deploy or `wrangler pages dev`)
npm run build    # production build → dist/
npm run deploy   # build + wrangler pages deploy (project: tektone-app)
```

> KV/Functions only run on a real deploy (or `npx wrangler pages dev dist`); the plain
> Vite dev server serves the UI but the `/api/*` calls 404 until deployed.

---

## Repo layout

```
src/
  App.jsx                  orchestrator (state, layout, mobile nav)
  components/              Board, CardModal, Sidebar, TopBar, NotificationsBell,
                           MeetingIntelligence, MeetingFetch, ReviewPopup, ProfilePage,
                           AdminPanel, Login, ui (Avatar, Spinner, useIsMobile…)
  lib/                     api.js (REST client), constants.js (columns, palette, helpers)
functions/
  _middleware.js           session guard for /api/kanban/*
  _lib/                    session.js (auth crypto), allowlist.js (emails/admins)
  api/{auth,kanban,analyze,ingest,meetings,avatar}/[[path]].js
automation/
  meeting-notes-sync.gs    Google Apps Script (Drive → app)
  appsscript.json          pinned timezone (America/Sao_Paulo)
  README.md                full automation setup
```

---

## Notes

- **Timezone** for all scheduling is **America/Sao_Paulo**.
- Meeting analysis runs on **Anthropic Claude** (forced tool use → guaranteed structured
  JSON). The legacy regex importer (`/ingest/meeting-notes`) still exists as a no-AI option.
- See **[`automation/README.md`](automation/README.md)** for the end-to-end Google Apps
  Script + secrets setup.
