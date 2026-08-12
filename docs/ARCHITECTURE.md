# Tektone Hub — architecture

Everything Tektone runs on the web, in one repo, unified under `tektone.com.br` with no
subdomains. Four surfaces, four independent Cloudflare deployments, one shared database.

| Path | What | Deployment | Repo location |
|---|---|---|---|
| `tektone.com.br/*` | Marketing site + `/login` | Cloudflare **Pages** (`tektone`) | `marketing/` |
| `tektone.com.br/hub`, `/task` | Staff ops: kanban, meetings, commercial admin, finance | Cloudflare **Worker** (`tektone-hub`) | repo root |
| `tektone.com.br/portal` | Customer-only: contracts, invoices, add-ons, progress | Cloudflare **Worker** (`tektone-portal`) | repo root |
| `tektone.com.br/crm` | Lead pipeline, sales, commissions, AI copilot | Cloudflare **Worker** (`tektone-crm`) | repo root |

A published visual walkthrough of all of this (with a routing diagram) exists as a Claude
Artifact — ask in the project chat if you need the link again, or read this document, which
has the same content in durable form.

## Why this shape

Cloudflare **Pages** custom domains map one whole (sub)domain to one project — there's no
way to give a Pages project just `/hub/*` of a domain while something else owns `/`. Cloudflare
**Workers Routes**, on the other hand, are path-pattern based and resolve by specificity
regardless of what else is on the zone — so `tektone.com.br/hub/*` on a Worker correctly
wins over `tektone.com.br/*` on a Pages project, with zero coordination needed between them.
That's the entire trick: the marketing site keeps living on Pages exactly as it always did,
and three small Workers claim the more specific paths around it.

We tried migrating the marketing site itself onto Workers too (for consistency) and
deliberately reverted it — see "Marketing site: Pages, not Workers" below.

## The shared-backend trick (`/hub` and `/portal`)

`tektone-hub` and `tektone-portal` are two different Cloudflare Workers, but they run **the
same backend code**. The `functions/` directory (Cloudflare Pages Functions — file-based
routing, e.g. `functions/api/auth/[[path]].js`) was never rewritten. Instead:

1. `wrangler pages functions build --outdir=./dist/_worker.js/` compiles the whole
   `functions/` tree into one Workers-compatible bundle — this is Cloudflare's own tool,
   normally used for Pages, but the *output* is a portable Worker module.
2. `worker/hub-entry.js` and `worker/portal-entry.js` are thin wrappers. Each one strips its
   own path prefix (`/hub` or `/task`; `/portal`) off the incoming request's URL, then hands
   the rewritten request to that same compiled bundle:

   ```js
   import pagesHandler from "../dist/_worker.js/index.js";
   export default {
     async fetch(request, env, ctx) {
       const url = new URL(request.url);
       if (url.pathname.startsWith("/hub")) url.pathname = url.pathname.slice(4) || "/";
       return pagesHandler.fetch(new Request(url, request), env, ctx);
     },
   };
   ```

3. The compiled bundle has no idea it's being reached via `/hub` or `/portal` — as far as
   it's concerned, it's still being asked for `/api/auth/me` at a domain root, same as
   always.

Why bother reusing instead of rewriting: `functions/_lib/rbac.js`'s per-route authorization
checks (`isProjectMember`, `isStaffOrAdmin`) already gate every request server-side. Exposing
the *entire* backend under both `/hub` and `/portal` isn't a wider attack surface than
exposing it under one path, because a CUSTOMER-role session still gets 403'd on staff-only
routes no matter which Worker the request arrived through. `CustomerShell.jsx` (the actual
customer UI, unchanged, now rendered by `portal/`'s own build) documents this same
defense-in-depth reasoning.

`/crm` is different: its leads/sales/commissions/copilot routes are genuinely new code, so
they're a real [Hono](https://hono.dev) app (`worker/crm-entry.js`). But `/crm`'s auth and
static-asset routes *also* fall through to that same compiled `dist/_worker.js` bundle, via
a catch-all Hono route at the bottom of the file — no reason to duplicate login/signup/me a
third time.

## Session sharing, for free

All three app Workers set the same cookie: `functions/_lib/session.js`'s `sessionCookie()`
sets `Path=/`. Because `/hub`, `/portal`, and `/crm` are all on the same host
(`tektone.com.br`), a login on any one of them sends that cookie on every subsequent request
to any of the others — **as long as all three Workers are configured with the same
`SESSION_SECRET` value** (it's an HMAC key; a mismatch just means tokens signed by one
Worker fail verification on another, not a crash — but it will look like nobody can ever
stay logged in). Set it once, copy the exact same value to each Worker.

## Marketing site: Pages, not Workers

We tried migrating `marketing/` onto Workers too, for consistency with the other three.
It uses `@cloudflare/next-on-pages`, which turns out to be **Pages-specific**: its compiled
`_worker.js` dynamically imports `__next-on-pages-dist__/functions/*.func.js` modules that
only `wrangler pages deploy` knows how to discover and attach as extra Worker modules. A
plain `wrangler deploy` throws `Error: No such module "__next-on-pages-dist__/..."` on every
dynamic route — caught via a local `wrangler dev` smoke test, before it ever touched
production.

Real migration would mean swapping to [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
(Cloudflare's current recommended adapter for Next.js on Workers) — a different build
pipeline, different output shape, real regression risk for a benefit we don't actually need:
Workers Routes on `/hub`, `/portal`, `/crm` already take priority over the Pages-hosted
marketing site on the same zone, proven repeatedly. **Only revisit this if Cloudflare
deprecates Pages outright.**

## Data model (D1: `hub-tektone`)

One database, `migrations/` in numbered order. Grouped by when each module shipped:

| Tables | Module |
|---|---|
| `users` | Shared across everything — `access_role` (ADMIN/STAFF/CUSTOMER) gates hub vs. portal, `crm_role` (partner/closer/admin, nullable) gates `/crm` |
| `projects`, `project_users` | Post-sale delivery — `project_users` doubles as the CUSTOMER invitation record |
| `tasks` | Kanban board (shared by `/hub`'s board and `/portal`'s progress meter) |
| `project_finances` | Internal budget/cost tracking, STAFF/ADMIN only |
| `contracts`, `invoices` | Commercial module — click-to-sign contracts, manual invoices |
| `addons_catalog`, `project_addons` | Add-on marketplace |
| `workflow_templates` | Admin-authored task checklists, bulk-applied to a project — reused by CRM's won-lead automation |
| `cost_categories`, `costs` | Internal cost ledger |
| `leads`, `lead_events`, `sales`, `commissions` | **CRM** — pipeline + audit trail + sales + a single-beneficiary commission ledger (Hudson, 10%/sale — no affiliates yet, schema stays extensible). `leads.qualification`/`score`/`tier` (migration `0012`) hold the landing-page qualification form's raw answers and computed hot/warm/cold tier, kept separate from the freeform `notes` field a closer edits by hand. |
| `kb_documents`, `lead_questions` | **CRM knowledge base** — the Business Specialist Copilot's grounding material + interaction log |
| `blog_pillars`, `blog_posts` | **Blog** — AI-drafted (Claude for copy, Workers AI `flux-1-schnell` for the cover), admin-curated before anything publishes. `POST /api/blog/admin/generate` runs every active pillar and only fails loudly (502) if *all* of them error — one bad pillar no longer silently looks like success. |

## The CRM (`/crm`)

Modeled on a legal-consultancy CRM built for a sister product (`codigo-internacional`),
re-personaed for Tektone's own business.

**Pipeline**: `leads.status` moves `new → contacted → qualified → won/lost` (`incomplete`
covers abandoned captures). Every mutation logs a `lead_events` row.

**Won-lead automation** (`worker/lib/wonAutomation.js`) — fires once, on the transition
*into* `won`:
1. Creates a `projects` row + a CUSTOMER `project_users` invite for the lead's email — the
   hand-off from `/crm` into `/hub`/`/portal`, a same-database write rather than any kind of
   sync.
2. Looks for a `workflow_templates` row named exactly **"Onboarding padrão"** and, if found,
   bulk-applies its tasks into the new project (reusing the already-built admin
   workflow-template feature — no new mechanism). If none exists yet, logs
   `onboarding_skipped` instead of failing the whole automation.
3. Commission generation happens separately, at sale-creation time
   (`worker/lib/crmDb.js#createCommissionForSale` — 10% of `sales.amount`, beneficiary
   hardcoded to `hudson@tektone.com.br`).

All three steps were verified end-to-end against a local D1 instance with real seed data
before this ever touched production — see the PR/commit history for the exact numbers
(a R$5,000 test sale produced exactly a R$500 commission row).

**Business Specialist Copilot** (`worker/lib/businessSpecialistService.js` +
`worker/lib/crmKbService.js`) — same pattern as the legal-consultancy reference (locked
persona + two-tier keyword-overlap KB retrieval, Claude call, fail-open on any error
including a missing API key), repersona'd as a *digital business specialist* recommending
Tektone's own services. Two modes, same underlying service:
- **ask** — free-text question about a lead.
- **suggest** — no question, just the lead's profile; returns recommended directions.

Approving a logged question promotes it into `kb_documents` as a `faq`-tier entry — a
self-improving loop, same as the reference. **The knowledge base starts empty** — it needs
Tektone's real service catalog, pricing, and case studies seeded before the copilot is
useful for anything beyond the fail-open placeholder.

## Public lead capture (`/crm/api/public/leads`)

The landing page's qualification form (`marketing/components/QualificacaoSection.tsx`) is
the only unauthenticated route on `tektone-crm` — visitors aren't logged in, so it can't sit
behind `requireCrm` like every other `/crm/api/leads*` route. It recomputes the hot/warm/cold
score **server-side** from the raw answers (`worker/crm-entry.js#scoreQualification`) rather
than trusting a client-supplied score — the client bundle is public, so a spoofed score would
otherwise be trivial. An elimination answer (`hasCompany: false`) short-circuits before any
lead is created; everything else always creates a lead, `status` set to `qualified` (warm/hot)
or `incomplete` (cold) so closers can still triage a cold lead without it disappearing.

## Full-screen views, not modal popups (`/hub`)

`AdminPanel`, `FinancePanel`, `CommercialPanel`, `BlogPanel`, `MeetingsPage` (combining the
single-meeting analyze flow and the admin-only bulk Drive import as tabs), and
`PersonalTodoPanel` are full-screen views switched via `App.jsx`'s `view` state, not centered
modal popups over the board — `src/components/AppSidebar.jsx` is the persistent, collapsible
nav between them (`hidden lg:flex`; mobile keeps the existing bottom-nav + sheet-menu
pattern, wired to the same `view` state). The sidebar always opens collapsed when `view`
becomes `"board"` — more horizontal room for kanban columns — regardless of the user's
collapse preference elsewhere, but stays independently toggleable while there; outside the
board it remembers the user's own choice via `localStorage` (`tk_app_sidebar_collapsed`).

## Non-obvious gotchas (all discovered by testing, not guessed)

| Gotcha | Why it matters |
|---|---|
| Vite `base` must equal the path prefix (`/hub/`, `/portal/`, `/crm/`) | Otherwise the built HTML's asset links and `import.meta.env.BASE_URL`-derived API calls (`src/lib/api.js`, `src/crm/crmApi.js`) point at the domain root, which no route owns. |
| `run_worker_first = true` in each `wrangler.*.toml`'s `[assets]` | Without it, Workers' static-asset layer (with SPA fallback on) intercepts *every* request — including `/hub/api/*` — before the Worker code ever runs, silently returning the SPA's `index.html` instead of JSON. |
| `.assetsignore` (containing `_worker.js`) must live in `public/`, not `dist/` | `dist/` is regenerated every build (gitignored); `public/` is the only place a file survives a rebuild and still gets copied into the output. Without it, the compiled backend bundle gets uploaded as a public, downloadable static file. |
| Built entry HTML gets renamed to `index.html` post-build | Vite outputs `crm.html`/`portal.html` (matching the source filename); Workers' SPA fallback looks specifically for a file *named* `index.html`. See `build:portal`/`build:crm` npm scripts. |
| `next-on-pages` ≠ portable to plain `wrangler deploy` | See "Marketing site: Pages, not Workers" above. |

## Deploying

Each of the four surfaces deploys independently.

```sh
# Marketing (from marketing/)
cd marketing && npm run pages:deploy

# Hub (from repo root)
npm run build && npx wrangler pages functions build --outdir=./dist/_worker.js/
npx wrangler deploy --config wrangler.worker.toml

# Portal (from repo root)
npm run build:portal
npx wrangler pages functions build --outdir=./dist/_worker.js/   # shared backend, same step
npx wrangler deploy --config wrangler.portal.toml

# CRM (from repo root)
npm run build:crm
npx wrangler pages functions build --outdir=./dist/_worker.js/   # shared backend, same step
npx wrangler deploy --config wrangler.crm.toml
```

Marketing also auto-deploys on push to `main` via `.github/workflows/deploy-marketing.yml`
(path-filtered to `marketing/**` so hub/portal/crm commits don't trigger it). Hub/portal/crm
are manual-only for now — no CI wired up yet.

### Database migrations

```sh
npx wrangler d1 migrations apply hub-tektone --remote
```

Add new schema as a new numbered file in `migrations/` — never edit an already-applied one.

## Secrets checklist

Each Worker holds its own copy of secrets (Cloudflare doesn't share them across Workers
automatically, even when they share a D1/KV binding). Set with:

```sh
npx wrangler secret put NAME --config wrangler.<worker>.toml
```

| Secret | `tektone-hub` | `tektone-portal` | `tektone-crm` | Used for |
|---|---|---|---|---|
| `SESSION_SECRET` | ✅ | ✅ (must match hub exactly) | ✅ (must match hub exactly) | Session cookie signing — nothing works without it |
| `ANTHROPIC_API_KEY` | ✅ | — | ✅ | Meeting intelligence (hub) / Business Specialist Copilot (crm) |
| `INGEST_TOKEN` | ✅ | — | — | Apps Script → `/api/analyze/auto`, `/api/ingest/*` |
| `MEETINGS_WEBAPP_TOKEN` | ✅ | — | — | Outbound call to the Drive Apps Script Web App |
| `MEETINGS_WEBAPP_URL` | ✅ | — | — | Same |
| `RESEND_API_KEY` | ✅ | — | — | @mention email notifications |

`APP_PASSWORD` (an old Pages secret) is confirmed unused anywhere in the codebase — don't
bother setting it.

`tektone-portal` only touches auth + projects/contracts/invoices/addons routes, so
`SESSION_SECRET` is its one real requirement — verified by tracing every `env.<SECRET>`
reference against the routes portal can actually reach.

## Known outstanding items (content/ops, not architecture)

1. **Secrets** — `tektone-hub` has all six set (`SESSION_SECRET`, `ANTHROPIC_API_KEY`,
   `INGEST_TOKEN`, `MEETINGS_WEBAPP_TOKEN`, `MEETINGS_WEBAPP_URL`, `RESEND_API_KEY`).
   `tektone-portal`/`tektone-crm`'s own secrets haven't been re-verified since — confirm
   `SESSION_SECRET` matches hub exactly before assuming cross-path login still works if either
   Worker's secrets are ever rotated.
2. **`tasks.tektone.com.br` → `/hub` redirect** — the old standalone Pages deployment there
   still works on its own; nothing forwards it to the new path yet.
3. **`NOTIFY_FROM` on the live `tasks.tektone.com.br` Pages project** — a real bug was found
   and fixed in the new Worker configs (@mention emails were sending from an unverified
   `tektone.com.br` address instead of the Resend-verified `send.tektone.com.br`), but the
   *old* Pages deployment needs the same fix applied via the Cloudflare dashboard (Pages
   project → Settings → Variables) — not via a code redeploy, since `dist/` is now built for
   `/hub`, not domain root.
4. **CRM content** — author a `workflow_templates` row named exactly "Onboarding padrão";
   seed `kb_documents` with Tektone's real service catalog/pricing/case studies.
5. **`crm_role` grants** — `hudson@tektone.com.br` has `admin`; nobody else does yet. Grant
   via direct D1 write (no admin UI for this — low volume, not worth building yet):
   ```sh
   npx wrangler d1 execute hub-tektone --remote --command \
     "UPDATE users SET crm_role = 'admin' WHERE email = 'someone@tektone.com.br'"
   ```
6. **Blog content pipeline** — generation confirmed working end-to-end (4 real drafts sitting
   in `pending_review` as of this writing); still needs an ADMIN to actually review/publish
   them, and the homepage has no "latest posts" section yet (only `/blog` itself lists them).
7. **Stripe** — the official `mcp.stripe.com` remote MCP server is registered locally in this
   project (`claude mcp add --transport http stripe https://mcp.stripe.com`) but not yet
   authenticated (`claude mcp login stripe`, run by whoever owns the Stripe account — not
   something an agent should do on someone else's behalf). No payment integration code exists
   yet; scope (project payments vs. portal add-on purchases vs. CRM sale checkout) isn't
   decided.
