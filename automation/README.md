# Meeting-notes → Kanban automation

Turns Gemini meeting-notes Google Docs into kanban cards automatically.

```
Apps Script (time trigger, daily at 5pm)
  → finds new Gemini notes Docs ("Shared with me" or a folder)
  → POSTs the doc text to https://tasks.tektone.com.br/api/ingest/meeting-notes
        ↓
Cloudflare Pages Function (functions/api/ingest/[[path]].js)
  → parses the "Próximas etapas" section
  → resolves the project (auto-creates it if missing)
  → maps each "[Names]" to board members ("[The group]" → unassigned)
  → creates cards in "A Fazer" (todo), deduped
```

## Google prerequisites (what you need — and don't)

With the Apps Script approach there is **no Google Cloud project, no API key, no
service account, no API enablement, no billing**. You only need:

- **The right Google account.** The script must run as someone who can *see* the
  notes. At TEKTONE the Gemini notes are created by the meeting organizer (Pedro)
  and land in your **"Shared with me"** — so run the script under your own account
  and use the default "Shared with me" search mode below.
- **An Apps Script project** (free, lives in that Google account).
- **One-time authorization.** The first run prompts for three auto-detected scopes
  — Drive (read), External requests (`UrlFetchApp`), and Triggers. You'll also see a
  "Google hasn't verified this app" screen; click **Advanced → Go to project → Allow**
  (normal for a personal script).
- **Gemini note-taking enabled** in Workspace — that's what produces the Docs in the
  first place (already the case at TEKTONE).

## One-time setup

### 1. Pick a secret token
Generate one (or use any long random string):
```sh
openssl rand -hex 32
```
This single value is shared between Cloudflare (the server) and Apps Script (the caller).

### 2. Set the token in Cloudflare
Cloudflare dashboard → your Pages project (`tektone-app`) → **Settings → Variables and secrets** → add a **Secret** named `INGEST_TOKEN` with the value from step 1, for the **Production** environment. Redeploy (or it applies on the next deploy).

CLI alternative:
```sh
npx wrangler pages secret put INGEST_TOKEN --project-name tektone-app
```

### 3. Create the Apps Script
1. Go to <https://script.google.com> → **New project**.
2. Paste the contents of [`meeting-notes-sync.gs`](./meeting-notes-sync.gs).
3. Edit the `CONFIG` block:
   - `ENDPOINT` — already set to `https://tasks.tektone.com.br/api/ingest/meeting-notes`.
   - `INGEST_TOKEN` — the **same** value from step 1.
   - **Where it looks for the Docs:**
     - *Default (TEKTONE):* leave `FOLDER_ID` empty. The script searches your
       **"Shared with me"** for Docs whose title contains `NAME_CONTAINS` (default
       `"Anotações"`). Use this because the Gemini notes are shared with you by Pedro
       rather than living in a folder you own. Narrow `NAME_CONTAINS` (e.g.
       `"Daily time Tektone"`) if you only want specific meetings.
     - *Alternative:* set `FOLDER_ID` to a folder you own to scan just that folder
       (ID = last segment of the folder URL `…/folders/<FOLDER_ID>`).
4. Run the `installTrigger` function once. Approve the Drive authorization (and the
   "Google hasn't verified this app" screen). This schedules `syncMeetingNotes` to run
   **once a day around 5pm** (`CONFIG.RUN_HOUR`), after the 3pm daily. Set the project
   time zone under **Project Settings (⚙)** so the hour matches your local time.
5. (Optional) Run `syncMeetingNotes` manually once and check **Executions** /
   **Logs** to confirm it found and ingested a doc.

## How parsing works

- Only Docs containing a **"Próximas etapas"** heading are processed.
- Each action line must look like: `[Names] Title: Description`
  (e.g. `[Alison Aparecido, Hudson Argollo] Atualizar VSL: Incluir as novas fotos.`).
- **Project** is detected from the notes text: an existing project name mentioned in
  the doc wins; otherwise a `projeto "…"` / `projeto Nome Próprio` phrase is used; if
  nothing is found it falls back to a **"Reuniões"** project. New projects are created
  automatically.
- **Members**: each name is matched to a board member. `[The group]` / `[O grupo]`
  tasks are left **unassigned**. Multiple assignees are supported — the first is the
  card's primary assignee (shown as the avatar) and the full list is stored on the card
  and noted in the description (`👥 …`).
- New cards land in **A Fazer** with medium priority.

## Dedup / safety

- Apps Script remembers processed Drive file IDs (won't re-send a doc).
- The server hashes each doc (`ingest:docs` in KV) and skips re-sent docs, and also
  skips any task whose title already exists under that project.
- The endpoint requires `Authorization: Bearer <INGEST_TOKEN>`; without it → 401.

## Testing the endpoint directly

```sh
curl -X POST https://tasks.tektone.com.br/api/ingest/meeting-notes \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Daily Tektone","date":"2026-06-22","text":"Resumo do projeto \"Código Internacional\".\n\nPróximas etapas\n[Hudson Argollo] Subir VSL: Publicar o arquivo.\n[The group] Melhorar VSL: Listar pontos.\n\nDetalhes\n..."}'
```
Returns the project, which tasks were `created`, and which were `skipped`.
