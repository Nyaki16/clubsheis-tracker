/**
 * ClubSheIs calendar sync → Tracker.
 *
 * Runs as info@clubsheis.com. Sends every calendar event with "Discovery" in
 * the title (plus the text of any "Notes by Gemini" doc attached to it) to the
 * Tracker, which creates or updates the client.
 *
 * Setup (once):
 * 1. In this Apps Script project: Services (+) → add "Google Calendar API".
 * 2. Project Settings → Script properties → add:
 *      TRACKER_URL   = https://clubsheis-tracker.vercel.app
 *      SYNC_SECRET   = the same value as CALENDAR_SYNC_SECRET on Vercel
 * 3. Run `backfill` once (approve the permissions it asks for).
 * 4. Run `installTrigger` once. From then on `syncRecent` runs every 10 minutes.
 */

var PAGE_SIZE = 250;
var BATCH = 20;

function syncRecent() {
  syncRange_(daysFromNow_(-14), daysFromNow_(90));
}

function backfill() {
  syncRange_(new Date('2025-11-01T00:00:00+02:00'), daysFromNow_(90));
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncRecent') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncRecent').timeBased().everyMinutes(10).create();
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
      q: 'Discovery',
      pageToken: pageToken,
    });
    (res.items || []).forEach(function (e) {
      if (/discovery/i.test(e.summary || '')) events.push(toPayload_(e));
    });
    pageToken = res.nextPageToken;
  } while (pageToken);

  for (var i = 0; i < events.length; i += BATCH) {
    send_(events.slice(i, i + BATCH));
  }
  Logger.log('Sent ' + events.length + ' discovery events');
}

function toPayload_(e) {
  var notes = (e.attachments || []).filter(function (a) {
    return a.title === 'Notes by Gemini' && a.fileId;
  })[0];
  var notesText = '';
  if (notes) {
    try {
      notesText = DocumentApp.openById(notes.fileId).getBody().getText().slice(0, 60000);
    } catch (err) {
      notesText = '';
    }
  }
  return {
    id: e.id,
    status: e.status,
    summary: e.summary || '',
    start: (e.start && (e.start.dateTime || e.start.date)) || '',
    description: e.description || '',
    attendees: (e.attendees || []).map(function (a) {
      return { email: a.email, displayName: a.displayName || '', organizer: !!a.organizer, self: !!a.self };
    }),
    notesUrl: notes ? notes.fileUrl : '',
    notesText: notesText,
  };
}

function send_(events) {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty('TRACKER_URL') || '').replace(/\/$/, '') + '/api/calendar/ingest';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + props.getProperty('SYNC_SECRET') },
    payload: JSON.stringify({ events: events }),
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  if (res.getResponseCode() >= 300) throw new Error('Tracker said ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
}

function daysFromNow_(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}
