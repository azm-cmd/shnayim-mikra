/**
 * Chevra Shnayim Mikra: raffle entries in a Google Sheet.
 *
 * Paste into Extensions > Apps Script of the Sheet that should hold entries, then follow SETUP.md.
 * Each week gets its own tab ("05 Chayei Sarah"); winners go to the "Winners" tab.
 *
 * Script properties (Project Settings > Script properties):
 *   ORGANIZERS        Comma-separated Google account emails allowed into the organizer panel
 *   GOOGLE_CLIENT_ID  OAuth client ID used by Sign in with Google on the site
 */

var CONFIG = {
  tz: 'America/New_York',
  start: [2026, 9, 10],               // Shabbos Bereishis, Oct 10 2026 (month is 0-based). Same as js/data.js
  open:  { dow: 4, h: 18, m: 0 },     // Thursday 6:00 PM
  close: { dow: 3, h: 0, m: 0 },      // Wednesday 12:00 AM of the following week
  parshiyos: ['Bereishis','Noach','Lech Lecha','Vayeira','Chayei Sarah','Toldos',
              'Vayeitzei','Vayishlach','Vayeishev','Mikeitz','Vayigash','Vayechi'],
  maxPerMinute: 600,                  // Rough flood guard; a 1,000-person group peaks far below this
  orgListLimit: 200                   // Entries sent to the organizer panel; the Sheet has them all
};
var ENTRY_HEAD = ['Submitted', 'Name', 'Contact', 'Type', 'Entry ID', 'Key', 'Token'];
var WIN_HEAD = ['Parsha #', 'Parsha', 'Name', 'Contact', 'Drawn at', 'Drawn by'];

/* ---------- HTTP ---------- */
function doGet(e){
  return respond(function(){
    var action = (e && e.parameter && e.parameter.action) || 'status';
    if (action === 'winners') return { winners: publicWinners() };
    var w = windowAt(nowLocal());
    return { window: { idx: w.idx, state: w.state, raw: w.raw } };
  });
}
function doPost(e){
  return respond(function(){
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (body.action){
      case 'submit':   return submit(body);
      case 'withdraw': return withdraw(body);
      case 'org':      return orgState(body);
      case 'draw':     return draw(body);
      case 'remove':   return removeEntry(body);
    }
    throw fail('bad_request', 'Unknown action.');
  });
}
function respond(fn){
  var out;
  try { out = fn(); out.ok = true; }
  catch (err){ out = { ok: false, code: err.code || 'server', message: err.code ? err.message : 'Something went wrong on the server.' }; if (!err.code) console.error(err); }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function fail(code, message){ var e = new Error(message); e.code = code; return e; }

/* ---------- Entry window (identical to CSM.windowAt in js/data.js) ---------- */
function windowAt(now){
  var C = CONFIG, DAY = 864e5;
  var START = new Date(C.start[0], C.start[1], C.start[2]);
  function addDays(d, n, h, m){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h || 0, m || 0); }
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var sat = addDays(today, (6 - today.getDay() + 7) % 7);
  var closeOff = (C.close.dow - 6 + 7) % 7;
  function closesOf(s){ return addDays(s, closeOff, C.close.h, C.close.m); }
  var prev = addDays(sat, -7);
  var prevIdx = Math.round((prev - START) / (7 * DAY));
  var target = (prevIdx >= 0 && now < closesOf(prev)) ? prev : sat;
  var opens = addDays(target, C.open.dow - 6, C.open.h, C.open.m);
  var closes = closesOf(target);
  var raw = Math.round((target - START) / (7 * DAY));
  return {
    raw: raw, idx: Math.max(0, raw), opens: opens, closes: closes,
    state: now < opens ? 'before' : (now < closes ? 'open' : 'closed'),
    learnIdx: Math.round((sat - START) / (7 * DAY)), dow: today.getDay()
  };
}
/* The group's wall-clock time as a plain Date, like nowTZ() on the site. */
function nowLocal(){
  var p = Utilities.formatDate(new Date(), CONFIG.tz, 'yyyy-MM-dd-HH-mm-ss').split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
}

/* ---------- Validation ---------- */
function parseContact(v){
  v = String(v || '').trim();
  if (v.length > 80) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { type: 'email', value: v.toLowerCase(), display: v };
  var digits = v.replace(/\D/g, '');
  if (/^[+()\-.\s\d]+$/.test(v) && digits.length >= 10 && digits.length <= 15) return { type: 'phone', value: digits, display: v };
  return null;
}
function cleanName(v){
  v = String(v || '').replace(/\s+/g, ' ').trim();
  if (v.length < 2 || v.length > 60) throw fail('bad_name', 'Enter your name.');
  /* Keep a spreadsheet from treating the name as a formula */
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
function checkIdx(idx){
  idx = Number(idx);
  if (!(idx >= 0 && idx < CONFIG.parshiyos.length && idx === Math.floor(idx))) throw fail('bad_request', 'Unknown parsha.');
  return idx;
}
function shortName(n){ var p = String(n).replace(/^'/, '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1].charAt(0) + '.' : p[0]; }

/* ---------- Sheets ---------- */
function book(){
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function tabFor(idx, create){
  var ss = book(), name = ('0' + (idx + 1)).slice(-2) + ' ' + CONFIG.parshiyos[idx], sh = ss.getSheetByName(name);
  if (!sh && create) return withLock(function(){ return ss.getSheetByName(name) || newTab(ss, name); });
  return sh;
}
function newTab(ss, name){
  var sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, ENTRY_HEAD.length).setValues([ENTRY_HEAD]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.hideColumns(6, 2);   // Key and Token are for the server
  return sh;
}
function winnersTab(){
  var ss = book(), sh = ss.getSheetByName('Winners');
  if (!sh){
    sh = ss.insertSheet('Winners', 0);
    sh.getRange(1, 1, 1, WIN_HEAD.length).setValues([WIN_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function findRow(sh, col, value){
  if (!sh || sh.getLastRow() < 2) return 0;
  var hit = sh.getRange(2, col, sh.getLastRow() - 1, 1).createTextFinder(value).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}
function withLock(fn){
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw fail('busy', 'The raffle is busy right now. Try again in a moment.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- Public: enter and withdraw ---------- */
function submit(b){
  if (b.website) return { id: Utilities.getUuid(), token: '' };   // Honeypot: bots fill the hidden field
  var w = windowAt(nowLocal()), idx = checkIdx(b.idx);
  if (w.state !== 'open' || w.raw !== idx) throw fail('closed', 'Entries for this parsha are closed.');
  var name = cleanName(b.name), c = parseContact(b.contact);
  if (!c) throw fail('bad_contact', 'Enter a valid email address or phone number.');
  var key = c.type + ':' + c.value;
  var cache = CacheService.getScriptCache(), rk = 'rate:' + Math.floor(Date.now() / 60000), n = Number(cache.get(rk) || 0);
  if (n >= CONFIG.maxPerMinute) throw fail('busy', 'The raffle is busy right now. Try again in a moment.');
  cache.put(rk, String(n + 1), 120);
  /* No script lock here: appendRow is atomic, so many entries can land at once.
     Two identical entries in the same instant could both pass the check; the draw counts each contact once. */
  var sh = tabFor(idx, true);
  if (findRow(sh, 6, key)) throw fail('duplicate', 'That ' + (c.type === 'email' ? 'email' : 'number') + ' is already entered for Parshas ' + CONFIG.parshiyos[idx] + '.');
  var id = Utilities.getUuid(), token = Utilities.getUuid();
  sh.appendRow([new Date(), name, "'" + c.display, c.type, id, key, token]);
  return { id: id, token: token };
}
function withdraw(b){
  var w = windowAt(nowLocal()), idx = checkIdx(b.idx);
  if (w.state !== 'open' || w.raw !== idx) throw fail('closed', 'Entries for this parsha are closed.');
  return withLock(function(){
    var sh = tabFor(idx, false), row = findRow(sh, 5, String(b.id || ''));
    if (row && sh.getRange(row, 7).getValue() === b.token) sh.deleteRow(row);
    return {};
  });
}
function publicWinners(){
  var sh = book().getSheetByName('Winners');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .filter(function(r){ return r[0] !== ''; })
    .map(function(r){ return { idx: Number(r[0]) - 1, name: shortName(r[2]) }; });
}

/* ---------- Organizers: Sign in with Google, checked here ---------- */
function organizer(b){
  var props = PropertiesService.getScriptProperties(), clientId = props.getProperty('GOOGLE_CLIENT_ID');
  var allowed = String(props.getProperty('ORGANIZERS') || '').toLowerCase().split(/[\s,;]+/).filter(String);
  var token = String(b.idToken || '');
  if (!token) throw fail('signin', 'Sign in with Google to continue.');
  var cache = CacheService.getScriptCache();
  var ck = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var email = cache.get(ck);
  if (!email){
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw fail('signin', 'Your sign-in expired. Sign in again.');
    var t = JSON.parse(res.getContentText()), left = Number(t.exp) - Date.now() / 1000;
    var issuerOk = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
    if (!clientId || t.aud !== clientId || !issuerOk || String(t.email_verified) !== 'true' || !(left > 0))
      throw fail('signin', 'Your sign-in expired. Sign in again.');
    email = String(t.email).toLowerCase();
    cache.put(ck, email, Math.max(1, Math.min(3000, Math.floor(left))));
  }
  if (allowed.indexOf(email) === -1) throw fail('not_organizer', email + ' isn’t on the organizer list. Ask the group admin to add it.');
  return email;
}
function entriesOf(sh){
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().map(function(r){
    return { ts: r[0] instanceof Date ? r[0].getTime() : 0, name: String(r[1]).replace(/^'/, ''), contact: String(r[2]).replace(/^'/, ''), id: String(r[4]), key: String(r[5]) };
  });
}
function winnerOf(idx){
  var sh = book().getSheetByName('Winners'), row = findRow(sh, 1, String(idx + 1));
  if (!row) return null;
  var r = sh.getRange(row, 1, 1, 6).getValues()[0];
  return { name: String(r[2]).replace(/^'/, ''), contact: String(r[3]).replace(/^'/, ''), at: r[4] instanceof Date ? r[4].getTime() : 0, by: r[5] };
}
function orgState(b){
  var email = organizer(b), idx = checkIdx(b.idx), sh = tabFor(idx, false), list = entriesOf(sh);
  var ss = book();
  return {
    email: email, idx: idx, total: list.length,
    entries: list.slice(-CONFIG.orgListLimit).reverse().map(function(e){ return { ts: e.ts, name: e.name, contact: e.contact, id: e.id }; }),
    winner: winnerOf(idx),
    sheetUrl: ss.getUrl() + (sh ? '#gid=' + sh.getSheetId() : '')
  };
}
function draw(b){
  var email = organizer(b), idx = checkIdx(b.idx);
  return withLock(function(){
    var seen = {}, list = entriesOf(tabFor(idx, false)).filter(function(e){ if (seen[e.key]) return false; seen[e.key] = 1; return true; });
    if (!list.length) throw fail('empty', 'No entries yet for Parshas ' + CONFIG.parshiyos[idx] + '.');
    var pick = list[Math.floor(Math.random() * list.length)];
    var sh = winnersTab(), row = findRow(sh, 1, String(idx + 1));
    var vals = [[idx + 1, CONFIG.parshiyos[idx], pick.name, "'" + pick.contact, new Date(), email]];
    if (row) sh.getRange(row, 1, 1, 6).setValues(vals); else sh.appendRow(vals[0]);
    return { winner: { name: pick.name, contact: pick.contact }, total: list.length };
  });
}
function removeEntry(b){
  organizer(b);
  var idx = checkIdx(b.idx);
  return withLock(function(){
    var sh = tabFor(idx, false), row = findRow(sh, 5, String(b.id || ''));
    if (row) sh.deleteRow(row);
    return {};
  });
}

/* ---------- One-time setup: run from the editor ---------- */
function setup(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  winnersTab();
  var props = PropertiesService.getScriptProperties();
  console.log('Sheet linked: ' + ss.getUrl());
  console.log('ORGANIZERS: ' + (props.getProperty('ORGANIZERS') || '(not set yet)'));
  console.log('GOOGLE_CLIENT_ID: ' + (props.getProperty('GOOGLE_CLIENT_ID') || '(not set yet)'));
}
