/**
 * TEKTONE — Meeting-notes → Kanban sync (Google Apps Script)
 *
 * Scans Google Drive for new Gemini meeting-notes Docs and POSTs their text to
 * the TEKTONE ingest endpoint, which parses "Próximas etapas" into cards.
 *
 * SETUP
 *   1. Open https://script.google.com → New project, paste this file.
 *   2. Fill in CONFIG below (ENDPOINT is already set to your subdomain):
 *        INGEST_TOKEN — the same secret you set in Cloudflare
 *                       (Pages → tektone-app → Settings → Variables and secrets).
 *   3. Choose how it finds the Docs (see CONFIG):
 *        • Default: scans "Shared with me" for Docs whose title contains
 *          NAME_CONTAINS — use this when Gemini notes are shared with you by
 *          a teammate (e.g. Pedro), which is the TEKTONE setup.
 *        • Or set FOLDER_ID to scan one specific folder you own.
 *   4. Run `installTrigger` once and authorize Drive access when prompted
 *      (approve the "Google hasn't verified this app" screen — it's your own script).
 *   5. Optional: run `syncMeetingNotes` manually and check Executions / Logs.
 *
 * Only Docs containing a "Próximas etapas" section are sent. Processed file IDs
 * are remembered so nothing is sent twice; the server also dedupes.
 */

const CONFIG = {
  ENDPOINT: "https://tasks.tektone.com.br/api/ingest/meeting-notes",
  INGEST_TOKEN: "PASTE_THE_SAME_TOKEN_HERE",

  // How to locate the notes Docs:
  //   FOLDER_ID empty  → search "Shared with me" by title (TEKTONE default).
  //   FOLDER_ID set     → scan that specific Drive folder you own instead.
  FOLDER_ID: "",
  // Title filter for the "Shared with me" search. "Anotações" matches every
  // Gemini notes Doc; narrow it (e.g. "Daily time Tektone") if you want only
  // certain meetings. Ignored when FOLDER_ID is set.
  NAME_CONTAINS: "Anotações",

  // Optional: force every doc into a fixed project. Leave "" to auto-detect
  // the project from the notes text.
  PROJECT_HINT: "",

  // Hour of day (0–23) to run, in the Apps Script project's time zone.
  // 17 = 5pm — after the 3pm daily, so the notes already exist.
  // IMPORTANT: set the project time zone under Project Settings (⚙) so this
  // hour matches your local time.
  RUN_HOUR: 17,
};

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncMeetingNotes")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncMeetingNotes")
    .timeBased()
    .atHour(CONFIG.RUN_HOUR)
    .everyDays(1)
    .create();
  Logger.log("Trigger installed: syncMeetingNotes daily around " + CONFIG.RUN_HOUR + ":00.");
}

// Returns a FileIterator over candidate notes Docs (folder or shared-with-me).
function findNotesDocs() {
  if (CONFIG.FOLDER_ID) {
    return DriveApp.getFolderById(CONFIG.FOLDER_ID).getFilesByType(MimeType.GOOGLE_DOCS);
  }
  const name = String(CONFIG.NAME_CONTAINS || "").replace(/'/g, "\\'");
  let query = "sharedWithMe = true and mimeType = 'application/vnd.google-apps.document'";
  if (name) query += " and title contains '" + name + "'";
  return DriveApp.searchFiles(query);
}

// Prefer a yyyy-mm-dd date parsed from the title (the real meeting date),
// falling back to the file's creation date.
function docDate(file) {
  const m = String(file.getName()).match(/(\d{4})[/.\-](\d{2})[/.\-](\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  return Utilities.formatDate(file.getDateCreated(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function syncMeetingNotes() {
  const props = PropertiesService.getScriptProperties();
  const seen = new Set(JSON.parse(props.getProperty("processed") || "[]"));

  const files = findNotesDocs();
  let sent = 0;
  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    if (seen.has(id)) continue;

    let text;
    try {
      text = DocumentApp.openById(id).getBody().getText();
    } catch (e) {
      Logger.log("Skip (cannot open) " + file.getName() + ": " + e);
      continue;
    }

    if (!/pr[óo]ximas etapas/i.test(text)) {
      seen.add(id); // not a notes doc — don't re-check it forever
      continue;
    }

    const payload = {
      title: file.getName(),
      date: docDate(file),
      text: text,
      project: CONFIG.PROJECT_HINT || undefined,
    };

    const res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + CONFIG.INGEST_TOKEN },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      seen.add(id);
      sent++;
      Logger.log("Ingested " + file.getName() + " → " + res.getContentText());
    } else {
      Logger.log("FAILED " + file.getName() + " [" + code + "]: " + res.getContentText());
      // leave unmarked so it retries next run
    }
  }

  props.setProperty("processed", JSON.stringify([...seen].slice(-1000)));
  Logger.log("Done. Sent " + sent + " new doc(s).");
}
