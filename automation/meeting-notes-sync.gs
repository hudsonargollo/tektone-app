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
  // /api/analyze/auto runs the full Gemini "meeting intelligence" (summary +
  // decisions + risks + action items) for EVERY meeting, not just dailies.
  // (Use /api/ingest/meeting-notes instead for the simpler regex-only import.)
  ENDPOINT: "https://tasks.tektone.com.br/api/analyze/auto",
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

  // Shared secret for the on-demand Web App (admin "buscar reuniões" button).
  // Must match the MEETINGS_WEBAPP_TOKEN secret on Cloudflare. Set any long string.
  WEBAPP_TOKEN: "PASTE_A_SECOND_LONG_SECRET_HERE",

  // Google has no native "on file saved" trigger for Drive, so we poll. Every
  // new transcript is processed within POLL_MINUTES of being saved — for ANY
  // meeting, not just the dailies. Allowed: 1, 5, 10, 15, 30.
  // (Project time zone MUST be America/Sao_Paulo — Project Settings ⚙.)
  POLL_MINUTES: 30,
  // Quiet hours (São Paulo): skip the run between QUIET_START and QUIET_END to
  // save compute overnight. 23–5 = no work from 11pm to 5am. Set equal to disable.
  QUIET_START: 23,
  QUIET_END: 5,
  // Alternative: leave POLL_MINUTES and instead run installDailyTrigger() to
  // process once a day at this hour (São Paulo time).
  RUN_HOUR: 17,
};

// True between QUIET_START and QUIET_END in the project's (São Paulo) time zone.
function inQuietHours() {
  const s = CONFIG.QUIET_START, e = CONFIG.QUIET_END;
  if (s === e) return false;
  const h = parseInt(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "H"), 10);
  return s < e ? h >= s && h < e : h >= s || h < e;
}

// Default: poll every POLL_MINUTES so meetings are picked up soon after saving.
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncMeetingNotes")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncMeetingNotes").timeBased().everyMinutes(CONFIG.POLL_MINUTES).create();
  Logger.log("Trigger installed: syncMeetingNotes every " + CONFIG.POLL_MINUTES + " minutes.");
}

// Alternative: once a day at RUN_HOUR (São Paulo). Run this instead of installTrigger.
function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "syncMeetingNotes")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncMeetingNotes").timeBased().atHour(CONFIG.RUN_HOUR).everyDays(1).create();
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
  if (inQuietHours()) {
    Logger.log("Quiet hours (" + CONFIG.QUIET_START + "–" + CONFIG.QUIET_END + ") — skipping.");
    return;
  }

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

    if (text.length < 200) {
      seen.add(id); // too short to analyze — skip permanently
      continue;
    }

    const payload = {
      title: file.getName(),
      date: docDate(file),
      transcript: text,
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

// ── On-demand Web App (admin "buscar reuniões") ───────────────────────────────
// Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access:
// Anyone. Copy the /exec URL into the Cloudflare MEETINGS_WEBAPP_URL secret.
// Re-deploy a new version whenever you change this file.

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// Catalog of candidate meeting docs (most recent first), with processed flag.
function listMeetingDocs_() {
  const seen = new Set(
    JSON.parse(PropertiesService.getScriptProperties().getProperty("processed") || "[]")
  );
  const files = findNotesDocs();
  const out = [];
  let n = 0;
  while (files.hasNext() && n < 100) {
    const f = files.next();
    out.push({ id: f.getId(), title: f.getName(), date: docDate(f), processed: seen.has(f.getId()) });
    n++;
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

// Read one doc and push it through the analysis endpoint.
function processDocById_(id) {
  const file = DriveApp.getFileById(id);
  const text = DocumentApp.openById(id).getBody().getText();
  const res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + CONFIG.INGEST_TOKEN },
    payload: JSON.stringify({ title: file.getName(), date: docDate(file), transcript: text }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  let body = {};
  try {
    body = JSON.parse(res.getContentText());
  } catch (e) {
    /* ignore */
  }
  const ok = code >= 200 && code < 300;
  if (ok) {
    const props = PropertiesService.getScriptProperties();
    const seen = new Set(JSON.parse(props.getProperty("processed") || "[]"));
    seen.add(id);
    props.setProperty("processed", JSON.stringify([...seen].slice(-1000)));
  }
  return { id, title: file.getName(), ok, status: code, result: body };
}

function doGet(e) {
  if (!e || e.parameter.token !== CONFIG.WEBAPP_TOKEN) return json_({ error: "unauthorized" });
  if (e.parameter.action === "list") return json_({ meetings: listMeetingDocs_() });
  if (e.parameter.action === "text") {
    const id = e.parameter.id;
    if (!id) return json_({ error: "missing id" });
    const file = DriveApp.getFileById(id);
    return json_({
      id,
      title: file.getName(),
      date: docDate(file),
      text: DocumentApp.openById(id).getBody().getText(),
    });
  }
  return json_({ error: "unknown action" });
}

function doPost(e) {
  if (!e || e.parameter.token !== CONFIG.WEBAPP_TOKEN) return json_({ error: "unauthorized" });
  if (e.parameter.action === "process") {
    const ids = String(e.parameter.ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    const results = ids.map((id) => {
      try {
        return processDocById_(id);
      } catch (err) {
        return { id, ok: false, error: String(err) };
      }
    });
    return json_({ results });
  }
  return json_({ error: "unknown action" });
}
