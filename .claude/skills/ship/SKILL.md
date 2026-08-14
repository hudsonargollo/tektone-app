---
name: ship
description: |
  Use when the user says "deploy commit document update artifact" (or close variants —
  "ship it", "wrap this up", "deploy and commit and document") for the tektone-app repo.
  Runs the full close-out loop: commit pending work, deploy whichever surface(s) changed,
  push, update docs/ARCHITECTURE.md, and update the "Tektone Hub — Architecture" Claude
  Artifact — in that order, every time it's invoked.
metadata:
  short-description: Commit + deploy + document + update-artifact loop for tektone-app
  version: "1.0.0"
allowed-tools: Bash Read Edit Write Artifact
---

# Ship

This is a **repeatable close-out loop** for the `tektone-app` repo (marketing site +
tektone-hub + tektone-portal + tektone-crm). Every invocation — first time or the
hundredth — follows the same six steps, in order. Don't skip a step because "nothing
changed there" without actually checking; the check itself is cheap.

## 0. Orient

```sh
cd /Users/hudsonargollo/Desktop/PROJETOS/tektone-app
git status --short
git diff --stat
git log origin/main..HEAD --oneline
```

Know what's uncommitted, what's committed-but-unpushed, and what's already live before
touching anything.

## 1. Commit

If `git status --short` shows anything:
- Review the actual diff (`git diff`), not just filenames — know what you're committing.
- Stage deliberately (`git add <specific files>`, not blanket `-A`) unless a full-repo add
  was already verified clean.
- Write a commit message that explains **why**, not just what — match the style already in
  this repo's log (`git log --oneline -10` for reference). Multiple unrelated changes get
  multiple commits, not one bundled message.
- If a change touches a live/critical path (e.g. anything in `functions/api/kanban/`), check
  for a fail-open pattern before committing — this repo's convention is that auxiliary
  features (gamification, notifications) must never be able to break the core action they're
  attached to. Add try/catch if a new write path doesn't already have one.

If nothing's uncommitted, say so and move on — don't invent a commit.

## 2. Deploy

Only deploy surfaces that actually changed (check `git diff --stat` / the commit(s) from
step 1 against these path prefixes). Exact commands, from `docs/ARCHITECTURE.md`'s
"Deploying" section:

```sh
# Marketing (marketing/** changed)
cd marketing && npm run build && npm run pages:deploy

# tektone-hub (functions/**, worker/hub-entry.js, migrations/** changed)
npm run build && npx wrangler pages functions build --outdir=./dist/_worker.js/
npx wrangler deploy --config wrangler.worker.toml

# tektone-portal (rare — only if portal-specific routes changed)
npm run build:portal
npx wrangler pages functions build --outdir=./dist/_worker.js/
npx wrangler deploy --config wrangler.portal.toml

# tektone-crm (worker/crm-entry.js, CRM-specific functions changed — API only, no frontend build;
# CRM panels live in the Hub bundle, so a src/crm/* UI change needs the tektone-hub deploy above too)
npx wrangler pages functions build --outdir=./dist/_worker.js/
npx wrangler deploy --config wrangler.crm.toml
```

**If a new migration file exists in `migrations/`** that hasn't been applied to remote D1
yet, apply it **before** deploying any Worker that reads/writes the new tables (check with
`SELECT name FROM sqlite_master WHERE type='table'` against `--remote` first if unsure it's
already applied):

```sh
npx wrangler d1 execute hub-tektone --remote --config wrangler.worker.toml --file migrations/00NN_....sql
```

This is a write to the live production database — it'll likely need explicit user
confirmation (the auto-mode permission classifier gates remote D1 writes). If blocked,
stop and tell the user exactly what command needs running and why, per the repo's established
safety pattern — don't try to route around the block.

After each deploy, do a quick smoke check:
```sh
curl -s -o /dev/null -w "%{http_code}\n" https://tektone.com.br/          # marketing
curl -s -o /dev/null -w "%{http_code}\n" https://tektone.com.br/hub       # hub
```

## 3. Push

```sh
git push origin main
```

## 4. Document (`docs/ARCHITECTURE.md`)

Read the file's current section headers first (`grep -n "^## \|^### " docs/ARCHITECTURE.md`)
before editing — don't duplicate an existing section, extend it.

- New architectural pattern, gotcha, or feature → its own `## ` or `### ` section, placed
  near related content (e.g. illustration/media discoveries go near "Landing-page
  illustrations and media"; a new backend feature gets its own top-level section like "The
  CRM" or "Builder profile — gamification").
- New open item, or a resolved one → edit the numbered "Known outstanding items" list at the
  bottom. Renumber if inserting, don't just append past the natural grouping.
- Match the existing terse, technical, no-fluff voice — this file explains *why* a decision
  was made and what broke when it was gotten wrong the first time, not just what the code
  does now.
- If a build was tried and then reverted (design direction rejected, approach abandoned),
  document that explicitly with the commit SHAs — the next session needs to know not to
  re-attempt it blind.

Commit this separately from step 1's code commit (`docs: ...` prefix, matching repo
convention) and push it too.

## 5. Update the Claude Artifact

URL (always update in place, never publish a new one for this):
**`https://claude.ai/code/artifact/f8c9eabe-9c67-41f9-b77a-4d8ee917bc6b`**
("Tektone Hub — Architecture")

This artifact is a **higher-level** bilingual (PT/EN) summary, not a full copy of
`docs/ARCHITECTURE.md` — it doesn't need every gotcha, just the sections a stakeholder
skimming would want: what shipped, why it mattered, what's still open. Match its existing
density (a few sentences + maybe one callout per topic, not a wall of detail).

Steps:
1. `WebFetch` the artifact URL with a prompt asking for the **complete raw HTML source
   verbatim, no summarization** — this works for `claude.ai/code/artifact/{uuid}` URLs
   specifically. It'll save the full HTML to a local tool-results file and show you the head;
   note that path.
2. The saved file has a platform-injected wrapper: everything before `<title>` (a
   `frame-runtime` script + opening `<html><head>...<body>` tags) and the trailing
   `</body></html>` are NOT part of your source — strip them before republishing, or the
   Artifact tool will double-wrap. A quick way:
   ```python
   content = open(saved_path).read()
   start = content.index('<title>')
   end = content.rindex('</script>') + len('</script>')
   clean = content[start:end]
   ```
3. `Edit` the extracted file directly: update the `status-row` pills + date near the top,
   insert/update whatever sections correspond to this round's work (mirror what you just
   wrote into `docs/ARCHITECTURE.md`, but condensed and bilingual — every new `<span
   class="lang-pt">`/`<span class="lang-en">` pair, matching the file's existing CSS classes:
   `.callout.warn`, `.callout.done`, `.card-grid`, `.checklist`, `.steps`, etc. — don't
   invent new component classes), update the "O que falta" / "What's left" checklist and its
   "resolved since last visit" callout, update the footer date.
4. Publish with the **same URL** so it updates in place rather than creating a duplicate:
   `Artifact(action: "publish", file_path: <your edited file>, url: "https://claude.ai/code/artifact/f8c9eabe-9c67-41f9-b77a-4d8ee917bc6b", favicon: "🏛️")`

## Report back

One short summary: what got committed (SHAs), what got deployed (which surfaces, live URL
confirmation), and a one-line pointer to the updated docs section + artifact. Don't re-explain
things already visible in the terminal output above.
