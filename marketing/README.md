# Tektone marketing site

The public-facing site at `tektone.com.br` — landing page + the shared `/login` page used
by every other Tektone surface (`/hub`, `/portal`, `/crm`, all deployed from the parent
repo). This is part of the [Tektone Hub monorepo](../README.md) — see
[`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for how this site fits into the whole
system (it stays on Cloudflare Pages while the other three surfaces run on Workers — read
that doc's "Marketing site: Pages, not Workers" section for why).

- **Stack:** Next.js 15 (App Router) + Tailwind v3 + Framer Motion, deployed to Cloudflare
  Pages via `@cloudflare/next-on-pages`.
- **Live:** <https://tektone.com.br>

## `/login`

`app/login/page.tsx` is the one login entry point for every Tektone account — staff,
admin, or customer. It calls `/hub/api/auth/*` directly (same-origin fetch, no CORS issue
since everything's under `tektone.com.br`) and redirects by `access_role` after success:
`CUSTOMER` → `/portal`, everyone else → `/hub`. See the parent repo's
`docs/ARCHITECTURE.md` for the session-sharing mechanics (`Path=/` cookie,
`SESSION_SECRET` must match across Workers).

## Develop

```sh
npm install
npm run dev              # next dev — localhost:3000
```

## Build & deploy

```sh
npm run pages:build       # @cloudflare/next-on-pages → .vercel/output/static
npm run pages:deploy      # build + wrangler pages deploy (project: tektone)
```

Auto-deploys on push to `main` via `../.github/workflows/deploy-marketing.yml`
(path-filtered to this directory, so commits to `/hub`/`/portal`/`/crm` don't trigger it).

## Repo layout

```
app/
  page.tsx                homepage — section components imported from components/
  login/page.tsx          shared login (see above)
  brand/route.ts           brand-asset route
  layout.tsx, globals.css  fonts, design tokens (label-tech, text-editorial, surface-paper…)
components/                one file per homepage section (HeroSection, AgitacaoSection,
                            ProcessoSection, ObjetivoSection, QualificacaoFitSection,
                            AutoridadeSection, FaqSection, HubTektoneSection,
                            QualificacaoSection), plus SectionBlob (decorative), Navbar, Footer
components/ui/              shadcn-derived primitives (accordion, button, progress)
lib/utils.ts                 shared helpers
```
