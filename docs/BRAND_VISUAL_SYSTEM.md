# TEKTONE — Visual Identity System (Mineral System)

> Verified against three independent sources on 2026-08-12: `TEKTONE BRAND
> GUIDE.pdf` (5-page identity system, v.2, author Pedro Silvestrini,
> MMXXVI), the live `/brand` guide (`marketing/app/brand/route.ts`), and
> the existing `marketing/tailwind.config.ts` tokens already in production
> use. All three agree on every value below except one — see "Corrections"
> at the bottom. Companion to `docs/BRAND.md` (positioning/culture) and
> `docs/ARCHITECTURE.md` (implementation) — this doc is specifically the
> *visual* system: palette, type, logo construction, voice, and the one
> hard constraint (no glow) that applies to Mineral System assets but not
> necessarily the wider marketing site.

## Mineral palette

| Name | Hex | CMYK (per PDF) | Role |
|---|---|---|---|
| Mineral Black (Ink) | `#141618` | 0/0/0/95 | Text, structure. Background of the manifesto page and inverted lockups. Already `ink`/`ink.950` in `tailwind.config.ts`. |
| Mineral Green | `#2E4A43` | 75/45/60/55 | Primary action, links, focus. The column's shaft. Maps to `action` in code. Already `green.DEFAULT`. |
| Mineral Sand | `#C7B79C` | 15/25/40/10 | Architrave + foundation of the mark. Warm borders, secondary accents. Already `sand.DEFAULT`. |
| Ivory Clay | `#EFE8DC` | 5/8/15/0 | Dominant background — the base everything else sits on. Already `ivory`. |

Usage ratio (per PDF): **25% black · 15% green · 10% sand · 50% ivory** — ivory should always be the dominant field, not an accent.

Inverted-lockup variant adds `#7FA396` (green-mist, already `green.mist` in
`tailwind.config.ts`) as green's on-dark counterpart.

## Type system

| Use | Family | Weights |
|---|---|---|
| Display / Headlines | Inter | 300, 600 |
| Editorial / Quotes / Latin phrases | EB Garamond | italic 400 |
| Mono / UI / Captions / Codes | JetBrains Mono | 400, 500 |

Already wired in `marketing/tailwind.config.ts` as `font-sans` (Inter),
`font-editorial` (EB Garamond), `font-mono` (JetBrains Mono) — no new font
loading needed for anything reusing this system inside the Next.js
marketing app. **`tektone-hub`'s own frontend (`src/`, a separate Vite
app) has not been confirmed to load the same three font files** — check
before assuming they're available there.

## The mark — construction (for anything that renders the logo, not just displays a static asset)

Three structural layers, nothing decorative, built on a 10×10 grid with optical center at axis (5,5):

1. **Architrave** (horizontal beam) — Mineral Black core, Mineral Sand revealed at the edges as a second layer (not a gradient — an actual second shape). 28px over 36px, ratio 7:9.
2. **Pillar** (vertical support) — Mineral Green outer, Mineral Black core, one single Mineral Sand vertical flute (a quiet Doric reference). Pillar 32px · core 18px · flute 2px.
3. **Foundation** (base) — four descending strata (sand, stone, horizon-line, echo). "O T não termina no chão: ele assenta" — it doesn't end at the ground, it settles onto it.

Clear space: ≥ 1 grid unit (the architrave's height) on all sides.

Six official mark variations (primary/mineral, mono/black, inverted/on-green, inverted/on-black, mono/on-sand, minimum/72px) and two lockups (`L.01` horizontal: mark + "TEKTONE" + "Structural intelligence"; `L.02` vertical stacked: mark + "TEKTONE" + "Maison · MMXXVI"). A secondary seal, **Sigillum Gordii** (a Gordian-meander pattern — literally a Greek meander motif, confirming that visual language is on-brand, not just a stylistic guess made earlier this session), is restricted to institutional-only use: contracts, equity documents, founder stationery — **not** general marketing/social content.

## Voice

> "Tektone fala devagar. Nunca grita. Quando precisa cortar, corta com clareza."
> (Tektone speaks slowly. Never shouts. When it needs to cut, it cuts with clarity.)

Two other principles stated in the guide, useful for any copy-generation context:
- "A marca é um corpo de três materiais. O selo é um corpo de três séculos." (on the mark vs. the seal)
- "A marca não é o que aparece no Instagram. É o que aparece quando você assina o contrato." — i.e. don't over-index on social-media polish at the expense of what actually shows up in a signed contract. Relevant caution for any social-content tooling: the Instagram presence is not where the brand's real weight lives.

## Hard constraint: no glow on Mineral System assets

The live `/brand` guide states explicitly: **"Não aplicar glow, sombra
neon ou halos luminosos — esse vocabulário pertence ao site
institucional, não ao Sistema Mineral."** (Don't apply glow, neon shadow,
or light halos — that vocabulary belongs to the institutional site, not
the Mineral System.)

This matters directly for anything generating branded visual assets (e.g.
an Instagram post generator): the marketing site itself *does* use
restrained glow accents (`.glow-action`, `.glow-action-ink` in
`marketing/app/globals.css`) — but those are site-specific decorative
choices, not part of the core Mineral identity, and must **not** carry
over into Mineral-System-branded output (logo renders, seal usage, social
post overlays). Any canvas/post-processing step applying brand tokens to
generated images should avoid drop-shadow glow, neon, or halo effects
entirely.

## Corrections vs. the pasted PRD (2026-08-12)

The Instagram-post-generator PRD's "exact design tokens from
TEKTONE BRAND GUIDE.pdf" table had one real error, now corrected here:

- **Mineral Black**: PRD said `#14161B` / CMYK `80/60/60/95`. The actual
  PDF (and the live `/brand` page, and the existing `ink` token already
  in production) says **`#141618`** / CMYK `0/0/0/95`. Use `#141618`.
- Ivory Clay's CMYK: PRD said `5/8/15/8`, PDF says `5/8/15/0` — minor,
  doesn't affect the hex (`#EFE8DC`, unchanged either way), noted for
  completeness since CMYK isn't used in the actual web implementation.
- Green and Sand hex/CMYK in the PRD were exactly correct — no changes.
