# PRD — Tektone.com.br Homepage Redesign

Status: draft for review · Owner: Hudson · Scope: replace the current production homepage (`app/page.tsx` + `components/*`) at tektone.com.br

## 1. The core finding, up front

The brief was "enforce our branding with elements that resemble the foundation of the modern age by Greece and Alexander the Great." That brand **already exists** — it's documented in full at `app/brand/route.ts` under the name **"Sistema Mineral"**:

- Tektone = Greek *tekton*, "builder," rooted in Aristotle's *tekhnē*.
- Alexander the Great is already the brand's reference figure — read not as conqueror but as infrastructure-builder (Alexandria's library, port, lighthouse, governance).
- The logo is a **classical column cross-section**: architrave (commitment before task) → shaft (craft) → stepped foundation (permanence in strata).
- Three brand pillars: **Ordo** (order), **Tekhnē** (craft), **Permanentia** (permanence).
- A full warm, light-mode "mineral" palette (ivory/clay, sand, ink, green) and typography system (Inter + EB Garamond italic for editorial lines + JetBrains Mono for technical labels) are specified in detail.
- Voice rule is explicit: *"Precisão em vez de entusiasmo."* No exclamation points, no emoji, no hype copy.

**The live homepage does not use any of this.** `tailwind.config.ts` defines a completely different token set — `ink-base #0A0A0A`, `ai-cyan #00E5FF`, `result-lime #C2FF00` — a dark, sci-fi/SaaS "neural network" aesthetic with a scan-beam hero and glowing cyan CTAs. It's a good-looking, high-effort page, but it is a different brand than the one written down.

**Recommendation: this redesign is a re-platforming of the homepage onto the brand system that already exists, not an invention of a new theme.** That's the single biggest decision in this doc — flagging it explicitly in case there's a reason the team deliberately diverged (e.g. an earlier belief that dark/cyan converts better for a tech-consulting audience) that should override the documented system rather than the other way around.

## 2. Goals

- Replace `tektone.com.br`'s homepage with a version that is visually and verbally consistent with Sistema Mineral end-to-end (palette, type, logo usage, voice).
- Preserve what's structurally working: the diagnostic-offer narrative, the 3-step qualification funnel, the authority section, the FAQ — these are conversion mechanics, not brand skin, and the research didn't surface a reason to rebuild them from scratch.
- Introduce a coherent, restrained motion language (see §5) instead of the current glow/scan-beam maximalism, in keeping with "Precisão em vez de entusiasmo."
- Ship on the existing stack (Next.js 15, React 19, Tailwind, framer-motion, Cloudflare Pages) with no framework migration.

## 3. Non-goals

- No CMS. Content stays in component files, same as today.
- No new backend/lead-storage system — the qualification form's current submit path is out of scope unless a bug is found.
- No rebrand of the logo/symbol itself — it's already fully specified; this is about *using* it, not redesigning it.
- Not adopting `animejs-mcp` as the animation engine (see §5.3 for why).

## 4. Design foundation — what to carry over from Sistema Mineral

Pull directly from `app/brand/route.ts` rather than re-deriving:

**Palette**
| Role | Token | Hex |
|---|---|---|
| Background (dominant) | Ivory Clay | `#EFE8DC` |
| Background (elevated/card) | Paper | `#F8F3EA` |
| Text / inverted surfaces | Ink | `#141618` |
| Primary / action / links | Green | `#2E4A43` |
| Success | Success | `#3E6B4E` |
| Border / warm accent | Sand | `#C7B79C` |
| Border / warm accent dark | Sand-dark | `#A9976F` |
| Warning | Ochre | `#B8862F` |
| Danger | Terracota | `#9B3D2E` |

**Typography**: Inter for all UI/body copy; EB Garamond *italic* reserved strictly for editorial/manifesto lines (mottos, quotes) — never body text; JetBrains Mono for eyebrows, hex/priority labels, tabular metrics. Scale: Display 36/700, H1 24/700, H2 20/600, Body 14, Caption 12.

**Surface treatment**: elevation via color layering (paper-on-ivory), not drop shadows; 5% paper-grain texture; dot/line "blueprint" texture reused (it already exists in `globals.css` as `.bp-lines`/`.bp-dots` — keep, just re-tint from cyan to ink/sand).

**Logo usage**: column mark at ≥32px height, fixed 100×116 aspect, never recolored outside green/ink/sand, no neon glow — which directly rules out the current cyan `ring-action`/`glow-action` treatments on any element the logo touches.

**Voice**: factual, declarative, no exclamation marks or emoji, calm system-style confirmations. The existing manifesto line is ready to use as-is: *"Tektone vem do grego — quem constrói. Não precisa gritar para ser levado a sério. Precisa apenas não ceder."*

**Open question for Pedro/Hudson**: keep this light-mode-first, or run a dark inverted variant (ink `#141618` background, ivory text) for the hero only, as a controlled contrast moment, then resolve to light for the rest of the page? The brand guide supports "inverted surfaces" for ink — this is compatible either way, it's a sequencing decision.

## 5. Technical & motion plan

### 5.1 Stack (already in place, keep)
- Next.js 15 (App Router) + React 19 + Tailwind 3.4
- `framer-motion` — already used correctly (`MotionProvider` wraps the app with `reducedMotion="user"`, `AnimatedNumber` is a clean count-up primitive, `Navbar` does scroll-driven blur via `useScroll`). Keep framer-motion as the **only** animation engine.

### 5.2 Add: shadcn/ui
Not currently installed (no `components.json`, no `components/ui`, no Radix deps). Given the brief calls for it explicitly and the qualification form (`QualificacaoSection.tsx`, 408 lines, hand-rolled multi-step form) is exactly the kind of component that benefits from accessible primitives, add shadcn/ui for: form inputs/select/radio-group (qualification funnel), accordion (FAQ — replace the hand-rolled one), progress (funnel step bar), dialog (if a video/case-study modal gets added). Re-skin shadcn's default tokens to the Mineral palette rather than leaving default shadcn slate.

### 5.3 Animation engine decision: do not add `animejs-mcp`
Researched at the user's request. Findings:
- It's a tiny MCP server (git-clone install, not on npm) that returns **anime.js v3 code as text** — it doesn't render or manage animation state, it's a snippet generator.
- It's vanilla-DOM/imperative (`anime({ targets: '.box', ... })`), with **zero React/Next.js awareness** — no hooks, no ref adapter, no SSR consideration.
- Using it alongside framer-motion means running two animation engines with different mental models (imperative DOM selectors vs. declarative React state) in the same page — real risk of hydration/ref-timing bugs and inconsistent motion easing between the two systems.
- **Recommendation**: skip it. Framer-motion already covers everything the current site needs (stagger, scroll-triggered reveal, count-up, path-adjacent SVG animation via `motion.path`/`pathLength`). If a specific effect genuinely can't be done in framer-motion, revisit narrowly then — don't adopt it as infrastructure up front.

### 5.4 "website-animate" MCP
Not found among currently connected tools. If this refers to a specific MCP server, share its repo/package and I'll evaluate and wire it in the same pass; otherwise the plan proceeds on framer-motion + shadcn/ui alone, which is sufficient for everything scoped here.

### 5.5 Inspiration sweep (motionsites.ai, designrocket.io)
- **motionsites.ai/sections** is a real, useful reference: a categorized library of animated section archetypes (hero, feature grids, pricing, testimonials, bento/stats, process-flow, FAQ, CTAs). Treat it as a checklist of *which* homepage sections deserve a distinct animated treatment — not as a visual style reference, since its own aesthetic (glossy SaaS) doesn't match Mineral.
- **designrocket.io** turned out to be a paid AI-web-design course/template shop, not a live pattern gallery — worth double-checking this was the intended link before leaning on it further; nothing concretely reusable came back from it.

## 6. Site structure — carry forward, re-skin, tighten copy

Existing section order is sound and maps cleanly to a classic diagnostic-offer funnel; keep the sequence, re-skin every section to Mineral, and tighten copy to match the "no hype" voice rule (current dark-theme copy leans harder into urgency/energy than the documented voice allows):

1. **Navbar** — wordmark + anchor nav + CTA; swap scroll-blur backdrop from `ink-800` to `paper`/ivory equivalent.
2. **Hero** — replace `NeuralBackdrop` (cyan neural-mesh SVG) with a column/blueprint motif consistent with the logo mark; keep the word-by-word headline reveal (it's a good, restrained pattern) but re-time/re-ease to feel closer to "precision" than "hype."
3. **Agitação** (problem framing) — copy audit against the no-hype voice rule; keep structure.
4. **Processo** (2-act timeline: 90-min diagnostic → 30-day build) — keep as-is structurally, re-skin the connecting-rail animation.
5. **Entregas** (4-pillar bento grid + equity-anchor callout) — good fit for a shadcn-based bento layout; keep the equity-anchor differentiation but soften its current lime-glow treatment to Mineral's green/success tokens.
6. **Autoridade** (Pedro Silvestrini bio + metrics) — keep `AnimatedNumber` (already well-built, reusable as-is), re-skin the metric card surface.
7. **Qualificação** (3-step lead form) — rebuild on shadcn/ui form primitives; keep the step-pip progress pattern.
8. **FAQ** — rebuild on shadcn accordion; keep content.
9. **Footer** — keep final-CTA band + legal/registration line; re-skin.

## 7. Phasing

1. **Foundation**: port Sistema Mineral tokens into `tailwind.config.ts` and `globals.css` (additive — keep `ink-*`/`ai-cyan`/`result-lime` tokens temporarily to avoid breaking anything mid-migration, remove once cutover is complete). Install and configure shadcn/ui with Mineral tokens.
2. **Section-by-section re-skin**, in the order above — each section is independently shippable behind a feature check if needed.
3. **Copy pass** against the voice rules (no exclamation/emoji/hype) across all sections.
4. **QA**: `prefers-reduced-motion` behavior (already respected via `MotionProvider`, re-verify after re-skin), color contrast on the new light palette (ivory/sand pairs need an explicit AA contrast check, since light-on-light is easier to get wrong than the current high-contrast dark theme), mobile pass (funnel form especially).
5. **Cutover** on Cloudflare Pages via the existing `pages:build`/`pages:deploy` scripts — no infra change needed.

## 8. Open decisions for Pedro/Hudson before build starts

1. Confirm: adopt Sistema Mineral as the live brand (recommended), or is the dark cyan theme an intentional, considered departure that should stay?
2. Hero: full light-mode, or an inverted-ink hero as a contrast moment (see §4)?
3. Confirm `designrocket.io` was the intended second reference link — what came back reads as a course platform, not a design gallery.
4. Any specific "website-animate" MCP tool to wire in, or proceed on framer-motion + shadcn/ui only?
