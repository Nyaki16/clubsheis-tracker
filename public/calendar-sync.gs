/**
 * ClubSheIs calendar sync → Tracker (Debbie).
 *
 * Runs as info@clubsheis.com. Sends every meeting (with the text of its
 * "Notes by Gemini" docs) to the Tracker: discovery calls become clients, and
 * every meeting — Team Scroll, Boardroom, client calls, one-on-ones — goes
 * into Debbie's memory. It also writes each client's Profile and Strategy
 * Brief into Google Docs.
 *
 * Setup (once):
 * 1. Services (+) → add "Google Calendar API".
 * 2. Project Settings → Script properties:
 *      TRACKER_URL = https://clubsheis-tracker.vercel.app
 *      SYNC_SECRET = the same value as CALENDAR_SYNC_SECRET on Vercel
 * 3. Run `backfill` once and approve the permissions. It imports every meeting
 *    since November 2025 in chunks, continuing on its own until it's done
 *    (check the Executions page; the last run logs "Backfill complete").
 * 4. Run `installTrigger` once. From then on `syncRecent` runs every 10 minutes.
 */

var PAGE_SIZE = 250;
var BATCH = 10;
var BACKFILL_FROM = '2025-11-01T00:00:00+02:00';
var CHUNK_DAYS = 7;
var TIME_BUDGET_MS = 4.5 * 60 * 1000; // Apps Script stops runs at 6 minutes

function syncRecent() {
  syncRange_(daysFromNow_(-3), daysFromNow_(60));
  syncDocs_();
}

function backfill() {
  var started = Date.now();
  var props = PropertiesService.getScriptProperties();
  var cursor = new Date(props.getProperty('BACKFILL_CURSOR') || BACKFILL_FROM);
  var end = daysFromNow_(60);
  while (cursor < end) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      props.setProperty('BACKFILL_CURSOR', cursor.toISOString());
      continueLater_();
      Logger.log('Paused at ' + cursor.toISOString() + '; continuing in a minute');
      return;
    }
    var next = new Date(Math.min(cursor.getTime() + CHUNK_DAYS * 24 * 60 * 60 * 1000, end.getTime()));
    syncRange_(cursor, next);
    cursor = next;
    props.setProperty('BACKFILL_CURSOR', cursor.toISOString());
  }
  props.deleteProperty('BACKFILL_CURSOR');
  removeTriggers_('backfill');
  syncDocs_();
  Logger.log('Backfill complete');
}

function installTrigger() {
  removeTriggers_('syncRecent');
  ScriptApp.newTrigger('syncRecent').timeBased().everyMinutes(10).create();
}

function continueLater_() {
  removeTriggers_('backfill');
  ScriptApp.newTrigger('backfill').timeBased().after(60 * 1000).create();
}

function removeTriggers_(name) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === name) ScriptApp.deleteTrigger(t);
  });
}

function syncRange_(from, to) {
  var events = [];
  var pageToken;
  do {
    var res = Calendar.Events.list('primary', {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      showDeleted: true,
      maxResults: PAGE_SIZE,
      pageToken: pageToken,
    });
    (res.items || []).forEach(function (e) {
      var people = (e.attendees || []).filter(function (a) { return !a.resource; });
      var hasNotes = (e.attachments || []).some(isGeminiNotes_);
      // Meetings with other people or notes; skip personal blocks.
      if (people.length >= 2 || hasNotes || /discovery/i.test(e.summary || '')) events.push(toPayload_(e));
    });
    pageToken = res.nextPageToken;
  } while (pageToken);

  for (var i = 0; i < events.length; i += BATCH) send_('/api/calendar/ingest', { events: events.slice(i, i + BATCH) });
  Logger.log('Sent ' + events.length + ' meetings (' + from.toISOString().slice(0, 10) + ' to ' + to.toISOString().slice(0, 10) + ')');
}

function isGeminiNotes_(a) {
  return a && a.fileId && /^Notes by Gemini/i.test(a.title || '');
}

function toPayload_(e) {
  var notes = (e.attachments || []).filter(isGeminiNotes_);
  var texts = [];
  notes.forEach(function (n) {
    try {
      texts.push(DocumentApp.openById(n.fileId).getBody().getText());
    } catch (err) {
      // No access to this doc; skip it.
    }
  });
  return {
    id: e.id,
    status: e.status,
    summary: e.summary || '',
    start: (e.start && (e.start.dateTime || e.start.date)) || '',
    end: (e.end && (e.end.dateTime || e.end.date)) || '',
    description: e.description || '',
    attendees: (e.attendees || []).map(function (a) {
      return { email: a.email, displayName: a.displayName || '', organizer: !!a.organizer, self: !!a.self, resource: !!a.resource };
    }),
    notesUrl: notes.length ? notes[0].fileUrl : '',
    notesText: texts.join('\n\n---\n\n').slice(0, 120000),
  };
}

// Copy Debbie's latest Client Profiles / Strategy Briefs into Google Docs.
function syncDocs_() {
  var res = send_('/api/client-docs/process', {});
  var writes = (res && res.writes) || [];
  var done = [];
  writes.forEach(function (w) {
    try {
      var doc = w.docId ? DocumentApp.openById(w.docId) : null;
      if (!doc) {
        doc = DocumentApp.create(w.title);
        var file = DriveApp.getFileById(doc.getId());
        if (w.folderId) {
          try { file.moveTo(DriveApp.getFolderById(w.folderId)); } catch (err) { /* keep in My Drive */ }
        }
        try {
          file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (err) {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
      }
      doc.setName(w.title);
      writeMarkdown_(doc.getBody(), w.content);
      doc.saveAndClose();
      done.push({ id: w.id, clientId: w.clientId, kind: w.kind, docId: doc.getId(), url: doc.getUrl() });
    } catch (err) {
      Logger.log('Could not write ' + w.title + ': ' + err);
    }
  });
  if (done.length) send_('/api/client-docs/written', { writes: done });
}

function writeMarkdown_(body, md) {
  body.clear();
  var H = DocumentApp.ParagraphHeading;
  md.split('\n').forEach(function (raw) {
    var line = raw.replace(/\s+$/, '');
    if (!line.trim()) return;
    var el;
    if (/^# /.test(line)) el = body.appendParagraph(line.slice(2)).setHeading(H.HEADING1);
    else if (/^## /.test(line)) el = body.appendParagraph(line.slice(3)).setHeading(H.HEADING2);
    else if (/^### /.test(line)) el = body.appendParagraph(line.slice(4)).setHeading(H.HEADING3);
    else if (/^\s*[-*] /.test(line)) el = body.appendListItem(line.replace(/^\s*[-*] /, '')).setGlyphType(DocumentApp.GlyphType.BULLET);
    else el = body.appendParagraph(line).setHeading(H.NORMAL);
    var text = el.editAsText();
    // **bold** → bold, then strip the markers.
    var s = text.getText();
    var m;
    while ((m = /\*\*([^*]+)\*\*/.exec(s))) {
      text.deleteText(m.index + m[0].length - 2, m.index + m[0].length - 1);
      text.deleteText(m.index, m.index + 1);
      text.setBold(m.index, m.index + m[1].length - 1, true);
      s = text.getText();
    }
    // Highlight [GAP: …] so they stand out.
    var re = /\[GAP[^\]]*\]/g;
    while ((m = re.exec(s))) text.setBackgroundColor(m.index, m.index + m[0].length - 1, '#FFF59D');
  });
  if (body.getNumChildren() > 1 && !body.getChild(0).asText().getText()) body.removeChild(body.getChild(0));
}

function send_(path, payload) {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('TRACKER_URL') || '').replace(/\/$/, '') + path;
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + props.getProperty('SYNC_SECRET') },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 300) throw new Error('Tracker said ' + code + ' on ' + path + ': ' + body.slice(0, 300));
  try { return JSON.parse(body); } catch (err) { return null; }
}

function daysFromNow_(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
