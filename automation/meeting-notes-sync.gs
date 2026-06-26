/**
 * TEKTONE — Meeting-notes → Kanban sync (Google Apps Script)
 *
 * Scans a Google Drive folder for new Gemini meeting-notes Docs and POSTs their
 * text to the TEKTONE ingest endpoint, which parses "Próximas etapas" into cards.
 *
 * SETUP
 *   1. Open https://script.google.com → New project, paste this file.
 *   2. Fill in CONFIG below:
 *        ENDPOINT     — your deployed URL + /api/ingest/meeting-notes
 *        INGEST_TOKEN — the same secret you set in Cloudflare (Pages → Settings →
 *                       Variables and Secrets → INGEST_TOKEN)
 *        FOLDER_ID    — the Drive folder where Gemini saves notes. Open the folder
 *                       in Drive; the ID is the last path segment of the URL:
 *                       https://drive.google.com/drive/folders/<FOLDER_ID>
 *                       (Gemini/Meet usually saves to a "Meet Recordings" folder.)
 *   3. Run `installTrigger` once (authorize Drive access when prompted).
 *   4. Optional: run `syncMeetingNotes` manually to test.
 *
 * It only sends Docs that contain a "Próximas etapas" section, and remembers
 * processed file IDs so nothing is sent twice. The server also dedupes.
 */

const CONFIG = {
  ENDPOINT: "https://tektone-app.pages.dev/api/ingest/meeting-notes",
  INGEST_TOKEN: "PASTE_THE_SAME_TOKEN_HERE",
  FOLDER_ID: "PASTE_DRIVE_FOLDER_ID_HERE",
  // Set to "" to scan FOLDER_ID, or override per project (rarely needed).
  PROJECT_HINT: "",
};

function installTrigger() {
  // Remove any existing triggers for this function, then create one.
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncMeetingNotes")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncMeetingNotes").timeBased().everyMinutes(30).create();
  Logger.log("Trigger installed: syncMeetingNotes every 30 minutes.");
}

function syncMeetingNotes() {
  const props = PropertiesService.getScriptProperties();
  const seen = new Set(JSON.parse(props.getProperty("processed") || "[]"));

  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);

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

    // Only Gemini-style notes with an action-items section.
    if (!/pr[óo]ximas etapas/i.test(text)) {
      seen.add(id); // not a notes doc — don't re-check it forever
      continue;
    }

    const payload = {
      title: file.getName(),
      date: Utilities.formatDate(file.getDateCreated(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
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

  // Keep the processed set bounded.
  props.setProperty("processed", JSON.stringify([...seen].slice(-1000)));
  Logger.log("Done. Sent " + sent + " new doc(s).");
}
