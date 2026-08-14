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

## Landing-page illustrations and media

Section illustrations (`AgitacaoSection`, `ProcessoSection`, `ObjetivoSection`, the hero) are
each generated art tied to that section's own copy — not one shared icon reused everywhere —
composited with `mix-blend-multiply` (light sections) or `mix-blend-screen` (dark sections)
plus `GoldenRibbons` (an SVG ornamental-linework component, same technique `/login` already
used) layered on top.

**The edge-fade math is easy to get wrong twice.** `mask-fade-corner` (`app/globals.css`) uses
`radial-gradient(ellipse closest-side at 50% 50%, black 55%, transparent 100%)` specifically
because `closest-side` is unambiguous — the gradient's 100% point is defined to land exactly at
the box's nearest edge. Two earlier attempts used explicit percentage sizing (`ellipse 75% 75%`,
then `ellipse 50% 50%`) and both were wrong in non-obvious ways: percentage color-stops are
relative to the gradient's own defined radius, which is *itself* a percentage of the box, so the
two percentages compound rather than reading as "55% of the way to the edge." Explicit
percentage sizing for this kind of mask is a trap — use `closest-side`/`closest-corner`/etc.
keywords instead, always.

**A mask alone isn't sufficient if the image doesn't fill its box.** The illustration `<Image>`
elements use `object-cover`, not `object-contain` — every source image's aspect ratio differs
from its container, so `object-contain` left the actual artwork letterboxed well inside the
mask's fully-opaque zone, completely bypassing the fade regardless of how correct the mask math
was. If a future illustration still shows a hard edge after checking the mask math, check this
first: is the image's own rendered content actually reaching the container's edges?

**Hub Tektone section is a real video, not a mock.** `marketing/public/video/hub-tektone.mp4`
(1080p, h264, no audio, ~4.7MB — compressed from an 83MB/4K source via `ffmpeg -vf scale=1920:-2
-crf 26 -an`) plays muted/looped/no-controls, masked at the edges so it reads as page background
rather than an embedded player. It replaced an earlier 420vh scroll-hijacking sequence that
hand-animated a mock board component to simulate footage that didn't exist yet at the time.

**Founder photo is temporarily rotating between two candidates.** `AutoridadeSection.tsx`
alternates `/pedro-silvestrini.jpeg` (current office photo) and `/pedro-silvestrini-old.jpeg`
(recovered from git history — an earlier commit fully replaced it rather than keeping both)
every 5 seconds, each with its own tuned `objectPosition` since the two photos have very
different compositions. This is explicit throwaway code (commented as TEMPORARY in the file) —
once a decision is made, delete the loser file and the rotation logic, revert to one static
`<Image>`.

**Site is password-gated while pre-launch.** `marketing/middleware.ts` redirects every route
(except `/gate` itself and static assets) to a password prompt until `/gate/verify` sets a
cookie (`tk_preview_auth`, 60-day). Password is hardcoded in
`app/gate/verify/route.ts` (`quemtemseda`) — deliberately not an env var, since this is a
spoiler-blocker, not real auth. **Doesn't affect `/hub`, `/portal`, `/crm`** — those are separate
Workers Routes that intercept requests before they ever reach this Pages Worker. Remove
`middleware.ts` (and the `app/gate/` tree) once the site is ready to go public.

**Hub Tektone video is framed, not blended.** Originally the video was masked at the edges to
blend into the dark background (see above); that was later reversed to a deliberate "premium
reveal" treatment — `.frame-gold` (metallic gradient border + glossy diagonal light-sweep
pseudo-element) and `.vignette-frame` (radial-gradient corner darkening on the video itself),
both in `app/globals.css`. If asked to touch this again, know that "blends into the page" and
"glossy premium frame" are two different, previously-tried directions — check which one is
currently live in `HubTektoneSection.tsx` before assuming.

**Real Gemini image generation works, but not the obvious way.** A third-party Claude Code skill
(`nano-banana`, installed via `npx skillfish add`) targets an OpenAI-compatible `chat.completions`
surface — Google's actual Gemini API rejects that request shape outright (`Unknown name "seed"`,
`Unknown name "response_modalities"`). The fix: call Gemini's **native** REST endpoint directly
(`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, header
`x-goog-api-key`, body `{contents:[{parts:[{text: prompt}]}], generationConfig:
{responseModalities:["IMAGE"]}}`) — same shape already proven in the sibling `fabrica-de-conteudo`
project's `worker/src/services/geminiMediaService.js` (model `gemini-3.1-flash-image`, aka "Nano
Banana 2"). **The API returns flat JPEG with no alpha channel even when the prompt asks for a
"transparent background"** — the model draws a literal checkerboard pattern into the pixels
instead. Working recipe: prompt for a **solid white background** explicitly, then flood-fill
from the image's four corners (PIL `ImageDraw.floodfill`, matching a near-white starting pixel)
into a transparent PNG locally — a global color-distance threshold would wrongly punch holes in
any white highlight linework *inside* the illustration, so it has to be a corner-flood, not a
blanket color-key. `ai.tektone.com.br` (a Groq-backed OpenAI-compatible proxy on the user's VPS)
is text-only — not usable for this.

**A full flat-color Greek illustration pass was built, then explicitly reverted.**
Commit `76ee301` replaced `SectionBlob`'s plain blurred gradient with a two-layer treatment (soft
color wash + a crisp flat-color classical bust silhouette on top) and swapped Agitação's
CSS-patched sepia grid for a real transparent-PNG bust; commit `6ee517f` (`git revert 76ee301`)
undid all of it after the user reviewed it live and didn't like the direction. **Don't
re-attempt this exact treatment without new direction from the user** — the generation pipeline
that made it possible (previous paragraph) is sound and reusable, but the specific "flat-color
bust replacing the blob" design was tried and rejected, not abandoned for a technical reason.

## Builder profile — gamification (`/hub`)

Task moves/reviews on the kanban board log to `task_events` (append-only), which drives a
per-builder XP/level engine (`functions/_lib/gamification.js`) wired into
`functions/api/kanban/[[path]].js`'s existing review endpoints — no new UI surface for staff to
learn, XP is just a side effect of doing the work they already do.

- **Two independent accumulators per builder**: a global profile (`builder_profiles`) and one row
  per project (`builder_project_profiles`) — the project-scoped one exists specifically so a
  project's page can show "this builder's standing on *this* project," separate from their
  overall level.
- **XP formula** (schema/rationale documented inline in `migrations/0013_hub_builder_profile.sql`
  and `gamification.js`): +20 base per reviewed task, +10 if on time (`reviewed_at` ≤
  `due_date`), +10 (or +5) for cycle speed measured from `task_events` (first `inprogress` entry
  → review) — real speed data, not just a same-day due-date check, since `tasks` itself has no
  `completed_at`/estimate column. Level thresholds: cumulative XP for level *L* = `50*(L-1)*L`.
- **12-card stoic + biblical wisdom deck** (`skill_cards`, seeded in the migration), one card per
  level 1–12, unlocked into `builder_cards` on level-up — both a global unlock and, separately, a
  per-project unlock against `builder_project_profiles.level`. Levels beyond 12 still accrue XP
  normally; there's just no new card yet — a deliberate v1 content ceiling.
- **Visibility**: private + admin. A builder reads only their own profile
  (`GET /api/gamification/me`); `access_role='ADMIN'` can read anyone's
  (`GET /api/gamification/user/:email`); a project roster is visible to STAFF/ADMIN or that
  project's members (`GET /api/gamification/project/:projectId`). No public leaderboard in v1.
- **Both new DB write paths fail open.** `logTaskEvent` and `awardXpForReviewedTask` are wrapped
  in try/catch that only `console.error`s — a missing migration or any gamification bug can
  never break the actual kanban move/review action they're layered onto. Verified locally
  end-to-end (real D1, no mocks) before shipping: 40 XP for an on-time+fast review, reopen+re-
  review correctly awards zero additional XP, level-up unlocks the right card.
- **Deferred**: tasks reviewed for the first time after this shipped have no `inprogress`
  `task_events` row to measure speed from (self-resolves as new events accumulate); multi-
  assignee tasks award full XP to *every* assignee, not split (a deliberate "small team, generous
  scoring" call — revisit if it gets gamed); the ADMIN-gated `/user/:email` route mirrors the
  tested `/project/:id` gate logic but wasn't itself exercised against a second real ADMIN user.

## Meeting Intelligence Drive search

`automation/meeting-notes-sync.gs` is the source-of-truth copy of a Google Apps Script Web App
that `functions/api/meetings/[[path]].js` proxies to (`MEETINGS_WEBAPP_URL`) — **editing the
`.gs` file in this repo does nothing live**; changes must be manually pasted into the Apps
Script editor (script.google.com) and redeployed as a new Web App version. `findNotesDocs()`
now merges two sources: the original Drive-wide title search (`NAME_CONTAINS`, default
`"Anotações"`) plus every Google Doc directly inside any folder named in
`CONFIG.EXTRA_FOLDER_NAMES` (currently `["REGISTROS DE REUNIÕES"]`, resolved by name via
`DriveApp.getFoldersByName()` — no folder ID to hardcode). Not yet confirmed live: whether a
folder with that exact name is actually visible to whichever Google account runs the script —
`getFoldersByName` fails silently (zero extra results, no error) on a name mismatch.

## Non-obvious gotchas (all discovered by testing, not guessed)

| Gotcha | Why it matters |
|---|---|
| Vite `base` must equal the path prefix (`/hub/`, `/portal/`) | Otherwise the built HTML's asset links and `import.meta.env.BASE_URL`-derived API calls (`src/lib/api.js`) point at the domain root, which no route owns. `src/crm/crmApi.js` is the one exception — it's imported from both the Hub bundle (base `/hub/`) and the standalone CRM Worker's API, so its base URL is hardcoded to `/crm` instead of derived from `BASE_URL` (see CRM section below). |
| `run_worker_first = true` in each `wrangler.*.toml`'s `[assets]` | Without it, Workers' static-asset layer (with SPA fallback on) intercepts *every* request — including `/hub/api/*` — before the Worker code ever runs, silently returning the SPA's `index.html` instead of JSON. |
| `.assetsignore` (containing `_worker.js`) must live in `public/`, not `dist/` | `dist/` is regenerated every build (gitignored); `public/` is the only place a file survives a rebuild and still gets copied into the output. Without it, the compiled backend bundle gets uploaded as a public, downloadable static file. |
| Built entry HTML gets renamed to `index.html` post-build | Vite outputs `portal.html` (matching the source filename); Workers' SPA fallback looks specifically for a file *named* `index.html`. See the `build:portal` npm script. |
| `next-on-pages` ≠ portable to plain `wrangler deploy` | See "Marketing site: Pages, not Workers" above. |

## Deploying

Each surface deploys independently. The CRM no longer has its own frontend — Dashboard/
Pipeline/Vendas/Links live inside the Hub app as panels (`src/crm/CrmPanel.jsx`,
`src/crm/CrmWaLinks.jsx`); the `tektone-crm` Worker only serves `/crm/api/*` now (a direct
page visit to `/crm` 302s to `/hub`), so it deploys with no separate build step and no
`[assets]` binding.

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

# CRM API (from repo root) — no frontend build, see note above
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
7. **Stripe** — the official `mcp.stripe.com` remote MCP server is registered
   (`claude mcp add --transport http stripe https://mcp.stripe.com`) and authenticated
   (`claude mcp login stripe`, run by Hudson from his own account). Its tools aren't callable
   yet in any session that was already running when the server was added/authenticated — the
   CLI only picks up MCP config changes on a fresh session start, confirmed via `claude mcp get
   stripe` returning "no such server" inside an already-running session even though `claude mcp
   list` shows it connected. **Next step: start a new Claude Code session, verify the Stripe
   tools load, then build.** Scope is decided — **both**:
   - **Portal add-on purchases** — `addons_catalog`/`project_addons` (migration
     `0006_hub_marketplace.sql`) already model the catalog; needs real Stripe Checkout wired to
     an actual purchase flow in `/portal`.
   - **Contract/invoice payments** — `contracts`/`invoices` (migration
     `0005_hub_commercial.sql`) are currently manual records with no online payment path; needs
     Stripe wired so a customer can actually pay an invoice rather than it just being a number
     staff track by hand.
   
   Explicitly deferred for now: CRM sale checkout (recording a sale in `/crm` when a lead is
   won stays a manual amount entry, not a real payment flow).
8. **Founder photo decision** — pick office photo vs. Acropolis photo, then delete
   `AutoridadeSection.tsx`'s temporary 5s rotation and the losing file (see "Landing-page
   illustrations and media" above).
9. **Two curated blog posts, pasted content but not yet built** — Hudson supplied full copy for
   two specific posts ("Você realmente precisa esperar 12 meses..." and a Pedro-origin-story
   piece) to hardcode + illustrate directly rather than run through the AI drafting pipeline;
   blocked because the paste got truncated mid-transit (154 lines missing) before this was
   acted on. Needs the full text resupplied (as a file, not a chat paste) before this can move.
   `statue-blueprint.jpg`-style illustration (see "A full flat-color Greek illustration pass"
   above) could be a good fit here even though it wasn't used on the homepage.
10. **Meeting Drive search change needs a manual redeploy** — `automation/meeting-notes-sync.gs`
    was updated to also search a "REGISTROS DE REUNIÕES" folder, but this only takes effect once
    someone pastes it into the Apps Script editor and redeploys the Web App, then confirms via a
    manual `syncMeetingNotes` run that the folder is actually found (see "Meeting Intelligence
    Drive search" above).
11. **Password gate is live** (`quemtemseda`) — intentional while pre-launch; remove
    `marketing/middleware.ts` + `app/gate/` before the site should be publicly reachable.
