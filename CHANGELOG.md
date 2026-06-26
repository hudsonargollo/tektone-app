# Changelog

All notable changes to **TEKTONE — Operações**. Grouped by feature area rather than
strict date; the app deploys continuously to Cloudflare Pages (`tektone-app`).

## [Unreleased]

### Board & cards
- **Checklists** on cards (toggle/edit/delete items, progress bar, board badge).
- **Links & references** on cards — add, open in new tab, and **edit after saving**.
- **Multiple assignees** per card (multi-select with avatar chips; stacked avatars on
  the board) — `assignees[]` is the source of truth, `assignee` kept for back-compat.
- **Card modal redesign:** title as the header, Projeto/Responsáveis inline on desktop,
  custom dropdowns + segmented priority + custom calendar picker, status renamed,
  wider modal, single-line header, tighter field grouping, no internal scroll.
- **Status/labels** relabeled (Coluna→Status, Etiqueta→Cor de destaque).

### Comments, requests & notifications
- **Comment threads** per card (server-authoritative; card edits never clobber them).
- **Material requests** — "Fazer solicitação" → `solicitação` badge → "Marcar como
  atendida"; board badge + a filter/tab for open requests.
- **@mentions** with autocomplete and highlighting.
- **Per-user unread bell** with counts, deep-links to the card, and 60s polling
  isolated to the bell (no board re-render).
- **Email on @mention** via Resend — branded Mineral-palette HTML, embedded author
  photo (`/api/avatar`), reply-to the commenter, and a `?card=<id>` deep link.

### Meeting intelligence
- **Automatic import:** Google Apps Script polls Drive (Shared with me) for Gemini
  meeting-notes Docs and posts transcripts to `/api/analyze/auto`.
- **AI analysis on Anthropic Claude** (forced tool use → guaranteed structured JSON):
  summary + decisions + risks + action items → cards in the right project (auto-created),
  with a 📝 Resumo card and a per-user validation popup.
- **Interactive** *Inteligência de Reuniões* page: paste a transcript (or, admin, pick
  one from Drive) → review → save.
- **Admin "buscar":** list and on-demand import meetings from Drive via an Apps Script
  Web App proxy (`/api/meetings/*`).
- Generated cards are visually distinct (✨ *reunião* badge).
- _Originally built on Gemini; switched to Claude._

### Profiles & accounts
- **Profile page** (photo upload with client-side resize, role, phone, location, bio).
- Teammates' **photos on card avatars** via a directory join.

### Mobile
- **Bottom nav:** Quadro · Solicitações · Reuniões · Perfil — full-screen destinations,
  active-tab pill, Perfil as a bottom sheet.
- **One column at a time**, swipe to switch; Solicitações shows a flat list of all open
  requests; no page scroll.
- **Card editor as a draggable bottom sheet**; keyboard opens only on field tap.

### Fixes
- **Disappearing cards** in columns — removed `layoutId` + `popLayout` from board cards
  (framer-motion layout-projection blanking).
- **Pluralization** — "1 solicitação" vs "N solicitações".
- **Pedro's member email** aligned to his login (`pedrosilvestrini@…`) so avatars
  resolve by email.

### Ops
- Comprehensive **README** + automation **README**, mermaid architecture diagram.
- Time zone pinned to **America/Sao_Paulo**; daily poll → every 30 min with quiet hours
  (23–5).

## [0.1.0]
- Initial KV-backed Kanban: projects, cards, drag-and-drop, email-allowlist auth,
  Mineral brand palette, responsive layout, admin reset panel.
