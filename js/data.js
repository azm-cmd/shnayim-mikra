/* Static data: group settings, parshiyos and their aliyos. */
(function(CSM){
'use strict';

/* ---------- Configuration: change these to match the real group ---------- */
CSM.CFG = {
  tz: 'America/New_York',
  tzLabel: 'ET',
  open:  { dow: 4, h: 18, m: 0 },   // Thursday 6:00 PM
  close: { dow: 3, h: 0, m: 0 },    // Wednesday 12:00 AM of the following week (entries close before Wednesday)
  prize: 50,
  orgCode: '613613',                 // Organizer code. Prototype only: visible in the page source.
  sefer: 'Bereishis',
  seferRef: 'Genesis',               // Sefaria's name for the sefer
  start: [2026, 9, 10]               // Shabbos Bereishis, Oct 10 2026 (month is 0-based)
};

/* Pesukim per perek in Bereishis (Hebrew numbering, as on Sefaria). */
CSM.PEREK_LEN = [
  31,25,24,26,32,22,24,22,29,32, 32,20,18,24,21,16,27,33,38,18,
  34,24,20,67,34,35,46,22,35,43, 54,33,20,31,29,43,36,30,23,23,
  57,38,34,34,28,34,31,22,33,26
];

/* [Hebrew, English, seven aliyos as "perek:pasuk-perek:pasuk"].
   Standard weekday-reading divisions, matching Hebcal and Sefaria. */
CSM.PARSHIYOS = [
  ['בראשית','Bereishis',   ['1:1-2:3','2:4-2:19','2:20-3:21','3:22-4:18','4:19-4:22','4:23-5:24','5:25-6:8']],
  ['נח','Noach',           ['6:9-6:22','7:1-7:16','7:17-8:14','8:15-9:7','9:8-9:17','9:18-10:32','11:1-11:32']],
  ['לך לך','Lech Lecha',   ['12:1-12:13','12:14-13:4','13:5-13:18','14:1-14:20','14:21-15:6','15:7-17:6','17:7-17:27']],
  ['וירא','Vayeira',       ['18:1-18:14','18:15-18:33','19:1-19:20','19:21-21:4','21:5-21:21','21:22-21:34','22:1-22:24']],
  ['חיי שרה','Chayei Sarah',['23:1-23:16','23:17-24:9','24:10-24:26','24:27-24:52','24:53-24:67','25:1-25:11','25:12-25:18']],
  ['תולדות','Toldos',      ['25:19-26:5','26:6-26:12','26:13-26:22','26:23-26:29','26:30-27:27','27:28-28:4','28:5-28:9']],
  ['ויצא','Vayeitzei',     ['28:10-28:22','29:1-29:17','29:18-30:13','30:14-30:27','30:28-31:16','31:17-31:42','31:43-32:3']],
  ['וישלח','Vayishlach',   ['32:4-32:13','32:14-32:30','32:31-33:5','33:6-33:20','34:1-35:11','35:12-36:19','36:20-36:43']],
  ['וישב','Vayeishev',     ['37:1-37:11','37:12-37:22','37:23-37:36','38:1-38:30','39:1-39:6','39:7-39:23','40:1-40:23']],
  ['מקץ','Mikeitz',        ['41:1-41:14','41:15-41:38','41:39-41:52','41:53-42:18','42:19-43:15','43:16-43:29','43:30-44:17']],
  ['ויגש','Vayigash',      ['44:18-44:30','44:31-45:7','45:8-45:18','45:19-45:27','45:28-46:27','46:28-47:10','47:11-47:27']],
  ['ויחי','Vayechi',       ['47:28-48:9','48:10-48:16','48:17-48:22','49:1-49:18','49:19-49:26','49:27-50:20','50:21-50:26']]
];

/* One aliyah per day, Sunday through Shabbos. [Hebrew, aliyah, short day, day] */
CSM.DAYS = [
  ['ראשון','Rishon','Sun','Sunday'],
  ['שני','Sheini','Mon','Monday'],
  ['שלישי','Shlishi','Tue','Tuesday'],
  ['רביעי','Revi’i','Wed','Wednesday'],
  ['חמישי','Chamishi','Thu','Thursday'],
  ['שישי','Shishi','Fri','Friday'],
  ['שביעי','Shevi’i','Shabbos','Shabbos']
];

/* ---------- Entry window ----------
   Pure function of the group's local wall-clock time. server/Code.gs has an identical copy;
   keep the two in step (tests/window.test.js checks they agree). */
CSM.windowAt = function(now){
  var C = CSM.CFG, DAY = 864e5;
  var START = new Date(C.start[0], C.start[1], C.start[2]);
  function addDays(d, n, h, m){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h || 0, m || 0); }
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var sat = addDays(today, (6 - today.getDay() + 7) % 7);
  var closeOff = (C.close.dow - 6 + 7) % 7;
  function closesOf(s){ return addDays(s, closeOff, C.close.h, C.close.m); }
  /* Last week's parsha stays open until its deadline passes */
  var prev = addDays(sat, -7);
  var prevIdx = Math.round((prev - START) / (7 * DAY));
  var target = (prevIdx >= 0 && now < closesOf(prev)) ? prev : sat;
  var opens = addDays(target, C.open.dow - 6, C.open.h, C.open.m);
  var closes = closesOf(target);
  var raw = Math.round((target - START) / (7 * DAY));
  return {
    raw: raw, idx: Math.max(0, raw), opens: opens, closes: closes,
    state: now < opens ? 'before' : (now < closes ? 'open' : 'closed'),
    /* Daily learning always follows the coming Shabbos's parsha */
    learnIdx: Math.round((sat - START) / (7 * DAY)), dow: today.getDay()
  };
};

/* ---------- Helpers over the data ---------- */
function parseRange(s){
  var m = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(s);
  return { c1: +m[1], v1: +m[2], c2: +m[3], v2: +m[4] };
}
/* Every pasuk in an aliyah as [perek, pasuk]. */
CSM.pesukim = function(range){
  var r = parseRange(range), out = [];
  for (var c = r.c1; c <= r.c2; c++){
    var from = c === r.c1 ? r.v1 : 1, to = c === r.c2 ? r.v2 : CSM.PEREK_LEN[c - 1];
    for (var v = from; v <= to; v++) out.push([c, v]);
  }
  return out;
};
CSM.sefariaRef = function(range){
  var r = parseRange(range);
  return CSM.CFG.seferRef + '.' + r.c1 + '.' + r.v1 + '-' + r.c2 + '.' + r.v2;
};
CSM.rangeLabel = function(range){
  var r = parseRange(range);
  return CSM.CFG.sefer + ' ' + r.c1 + ':' + r.v1 + '–' + (r.c1 === r.c2 ? '' : r.c2 + ':') + r.v2;
};
/* Hebrew numerals for 1-99, e.g. 15 -> ט״ו */
CSM.heNum = function(n, plain){
  var ones = ['','א','ב','ג','ד','ה','ו','ז','ח','ט'], tens = ['','י','כ','ל','מ','נ','ס','ע','פ','צ'];
  var s = n === 15 ? 'טו' : n === 16 ? 'טז' : tens[Math.floor(n / 10)] + ones[n % 10];
  if (plain) return s;
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
};

})(window.CSM = window.CSM || {});
