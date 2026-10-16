(function(CSM){
'use strict';

var CFG = CSM.CFG, PARSHIYOS = CSM.PARSHIYOS, DAYS = CSM.DAYS;
var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var DAY = 864e5;
var START = new Date(CFG.start[0], CFG.start[1], CFG.start[2]);

function $(s){ return document.querySelector(s); }
var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
function buzz(p){ try { if (navigator.vibrate) navigator.vibrate(p); } catch(e){} }

/* ---------- Storage (best effort) ---------- */
var KEY = 'csm.prototype.v1';
function blankStore(){ return { entries: [], winners: [], mine: {}, override: 'auto', progress: {}, taamim: true, double: false }; }
var store = blankStore();
try {
  var raw = localStorage.getItem(KEY);
  if (raw) { var parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') { Object.keys(store).forEach(function(k){ if (parsed[k] !== undefined) store[k] = parsed[k]; }); } }
} catch(e){}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(store)); } catch(e){} }

/* ---------- Time ---------- */
var dtf = new Intl.DateTimeFormat('en-US', { timeZone: CFG.tz, hourCycle: 'h23', year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', second:'numeric' });
function nowTZ(){
  var p = {}; dtf.formatToParts(new Date()).forEach(function(x){ p[x.type] = x.value; });
  return new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
}
function addDays(d, n, h, m){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h || 0, m || 0); }
function time12(h, m){ return ((h % 12) || 12) + ':' + String(m).padStart(2,'0') + ' ' + (h < 12 ? 'AM' : 'PM'); }
var OPEN_LABEL  = DOW[CFG.open.dow]  + ' ' + time12(CFG.open.h,  CFG.open.m)  + ' ' + CFG.tzLabel;
var CLOSE_PHRASE = 'before ' + DOW[CFG.close.dow] + ' of the following week';

function view(){
  var now = nowTZ();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var sat = addDays(today, (6 - today.getDay() + 7) % 7);
  var closeOff = (CFG.close.dow - 6 + 7) % 7;
  function closesOf(s){ return addDays(s, closeOff, CFG.close.h, CFG.close.m); }
  /* Last week's parsha stays open until its deadline passes */
  var prev = addDays(sat, -7);
  var prevIdx = Math.round((prev - START) / (7 * DAY));
  var target = (prevIdx >= 0 && now < closesOf(prev)) ? prev : sat;
  var opens  = addDays(target, CFG.open.dow - 6, CFG.open.h, CFG.open.m);
  var closes = closesOf(target);
  var raw = Math.round((target - START) / (7 * DAY));
  var real = now < opens ? 'before' : (now < closes ? 'open' : 'closed');
  var state = store.override === 'open' ? 'open' : (store.override === 'closed' ? 'closed' : real);
  var idx = Math.max(0, raw);
  /* Organizer works on the most recent parsha whose window has opened */
  var orgIdx = (state === 'before' && idx > 0) ? idx - 1 : idx;
  /* Daily learning always follows the coming Shabbos's parsha */
  var learnIdx = Math.round((sat - START) / (7 * DAY));
  return { now: now, opens: opens, closes: closes, idx: idx, orgIdx: orgIdx, complete: raw > 11, state: state, real: real,
           learnIdx: learnIdx, dow: today.getDay() };
}
function fmt(ms){
  var s = Math.max(0, Math.floor(ms / 1000));
  var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + String(m).padStart(2,'0') + 'm ' + String(sec).padStart(2,'0') + 's';
  return m + 'm ' + String(sec).padStart(2,'0') + 's';
}

/* ---------- Data helpers ---------- */
function entriesFor(idx){ return store.entries.filter(function(e){ return e.idx === idx; }); }
function mineEntry(idx){ var id = store.mine[idx]; return id ? store.entries.find(function(e){ return e.id === id; }) : null; }
function winnerFor(idx){ return store.winners.find(function(w){ return w.idx === idx; }); }
function parseContact(v){
  v = v.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { type:'email', value:v.toLowerCase(), display:v };
  var digits = v.replace(/\D/g, '');
  if (/^[+()\-.\s\d]+$/.test(v) && digits.length >= 10 && digits.length <= 15) return { type:'phone', value:digits, display:v };
  return null;
}
function mask(c){
  if (c.indexOf('@') > -1){ var p = c.split('@'); return p[0].charAt(0) + '•••@' + p[1]; }
  var d = c.replace(/\D/g, ''); return '•••-•••-' + d.slice(-4);
}
function shortName(n){ var p = n.trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length-1].charAt(0) + '.' : p[0]; }
function randInt(n){ var a = new Uint32Array(1); crypto.getRandomValues(a); return Math.floor(a[0] / 4294967296 * n); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pName(idx){ return PARSHIYOS[Math.min(Math.max(idx,0),11)]; }
function el(tag, props, kids){
  var n = document.createElement(tag);
  if (props) Object.keys(props).forEach(function(k){ if (k === 'text') n.textContent = props[k]; else if (k === 'class') n.className = props[k]; else n.setAttribute(k, props[k]); });
  (kids || []).forEach(function(c){ n.appendChild(c); });
  return n;
}
function checkIcon(){
  var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), use = document.createElementNS(NS, 'use');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#i-check'); svg.appendChild(use);
  return svg;
}

/* ---------- Daily progress ---------- */
function progKey(idx, d){ return idx + ':' + d; }
function doneList(idx, d){ return store.progress[progKey(idx, d)] || []; }
function pesukimOf(idx, d){ return CSM.pesukim(PARSHIYOS[idx][2][d]); }
function dayStats(idx, d){
  var total = pesukimOf(idx, d).length, done = doneList(idx, d).length;
  return { total: total, done: done, frac: total ? Math.min(1, done / total) : 0, complete: total > 0 && done >= total };
}

/* Progress ring: an SVG track plus a bar whose dash offset shows the fraction done. */
var RING_C = 2 * Math.PI * 20;
function makeRing(host){
  host.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="trk" cx="24" cy="24" r="20"/>' +
    '<circle class="bar zero" cx="24" cy="24" r="20" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="' + RING_C.toFixed(2) + '"/></svg><span class="ltr"></span>';
  return host;
}
function setRing(host, frac, label, lang){
  var bar = host.querySelector('.bar'), ltr = host.querySelector('.ltr');
  bar.setAttribute('stroke-dashoffset', (RING_C * (1 - frac)).toFixed(2));
  bar.classList.toggle('zero', frac <= 0);
  ltr.textContent = label;
  if (lang) ltr.setAttribute('lang', lang); else ltr.removeAttribute('lang');
}

/* ---------- Hero ---------- */
var heTitle = $('#heTitle'), banner = $('#banner'), card = $('#card');
function fitBanner(){
  heTitle.style.fontSize = '100px';
  var avail = banner.clientWidth, w = heTitle.getBoundingClientRect().width || 1;
  var fs = Math.max(32, Math.min(128, 100 * avail / w * 0.94));
  heTitle.style.fontSize = fs.toFixed(1) + 'px';
}
function renderHero(){
  var v = view();
  $('#stepWindow').textContent = 'Tick the box and add your name and email or phone. The box opens ' + OPEN_LABEL + ' and closes ' + CLOSE_PHRASE + '.';
  if (v.complete){
    heTitle.textContent = 'סיום הספר';
    $('#enTitle').textContent = 'Sefer ' + CFG.sefer + ' complete';
    $('#weekLine').textContent = '';
    $('#lede').textContent = 'The $300 Sefer raffle is coming up.';
    card.hidden = true; document.title = 'Chevra Shnayim Mikra';
  } else {
    var p = pName(v.idx);
    heTitle.textContent = 'פרשת ' + p[0];
    $('#enTitle').textContent = 'Parshas ' + p[1];
    $('#weekLine').textContent = 'Week ' + (v.idx + 1) + ' of 12 in Sefer ' + CFG.sefer;
    $('#lede').textContent = "Finish shnayim mikra v'echad targum, then check in " + CLOSE_PHRASE + " to join this week's $" + CFG.prize + ' raffle.';
    card.hidden = false; document.title = 'Parshas ' + p[1] + ' · Chevra Shnayim Mikra';
  }
  fitBanner();
}

/* ---------- Day strip ---------- */
var daysEl = $('#days'), dayList = $('#dayList'), dayBtns = [];
DAYS.forEach(function(dn, d){
  var btn = el('button', { type: 'button', class: 'day' }, [
    makeRing(el('span', { class: 'ring' })),
    el('span', { class: 'lbl', text: dn[1] }),
    el('span', { class: 'dw', text: dn[2] })
  ]);
  btn.addEventListener('click', function(){ openReader(d); });
  dayBtns.push(btn);
  dayList.appendChild(el('li', null, [btn]));
});
function renderDays(){
  var v = view(), idx = v.learnIdx;
  daysEl.hidden = idx < 0 || idx > 11;
  if (daysEl.hidden) return;
  var p = PARSHIYOS[idx], finished = 0;
  $('#daysParsha').textContent = 'Parshas ' + p[1];
  dayBtns.forEach(function(btn, d){
    var s = dayStats(idx, d), today = d === v.dow;
    if (s.complete) finished++;
    btn.classList.toggle('today', today);
    btn.classList.toggle('done', s.complete);
    if (today) btn.setAttribute('aria-current', 'date'); else btn.removeAttribute('aria-current');
    btn.setAttribute('aria-label', DAYS[d][1] + ', ' + DAYS[d][3] + (today ? ', today' : '') + ', ' + CSM.rangeLabel(p[2][d]) + ', ' +
      (s.complete ? 'complete' : s.done + ' of ' + s.total + ' pesukim read'));
    setRing(btn.querySelector('.ring'), s.frac, CSM.heNum(d + 1, true), 'he');
  });
  $('#daysCount').textContent = finished === 7 ? 'All 7 done' : finished + ' of 7 done';
}

/* ---------- Check-in card ---------- */
var chk = $('#chk'), reveal = $('#reveal'), ticket = $('#ticket'), note = $('#note');
var fName = $('#fName'), fContact = $('#fContact'), eName = $('#eName'), eContact = $('#eContact');
var userChecked = false;

function renderCount(v){
  var c = $('#count');
  if (store.override !== 'auto' && v.real !== v.state){ c.textContent = 'Preview mode'; return; }
  if (v.state === 'before') c.textContent = 'Opens in ' + fmt(v.opens - v.now);
  else if (v.state === 'open') c.textContent = 'Closes in ' + fmt(v.closes - v.now);
  else c.textContent = 'Entries closed';
}
function renderCard(){
  var v = view(); if (v.complete) return;
  var p = pName(v.idx), mine = mineEntry(v.idx), isOpen = v.state === 'open';
  card.dataset.state = v.state;
  $('#chipText').textContent = v.state === 'open' ? 'Entries open' : (v.state === 'before' ? 'Opens soon' : 'Entries closed');
  $('#chkLabel').textContent = 'I finished Parshas ' + p[1];
  renderCount(v);

  if (!isOpen) userChecked = false;
  chk.disabled = !isOpen || !!mine;
  chk.checked = !!mine || (isOpen && userChecked);

  var showForm = isOpen && chk.checked && !mine;
  reveal.classList.toggle('on', showForm);
  reveal.inert = !showForm;

  ticket.hidden = !mine;
  if (mine){
    $('#ticketTitle').textContent = "You're entered in the Parshas " + p[1] + ' raffle';
    $('#ticketText').textContent = 'If your name is drawn, the winner is contacted at ' + mask(mine.contact) + '.';
    $('#withdraw').hidden = !isOpen;
  }

  var w = winnerFor(v.idx), msg = '';
  if (v.state === 'before') msg = 'The box opens ' + OPEN_LABEL + '.';
  else if (v.state === 'closed') msg = w ? ('This week’s winner: ' + shortName(w.name) + '.') : ('Entries are closed. The winner is drawn after entries close, and the next window opens ' + OPEN_LABEL + '.');
  note.textContent = msg; note.hidden = !msg;
}

chk.addEventListener('change', function(){
  userChecked = chk.checked;
  buzz(8);
  renderCard();
});

function setErr(input, errEl, msg){
  errEl.textContent = msg || '';
  if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  if (input === fContact) $('#hContact').hidden = !!msg;
}
function checkName(){ var ok = fName.value.trim().length >= 2; setErr(fName, eName, ok ? '' : 'Enter your name.'); return ok; }
function checkContact(){ var c = parseContact(fContact.value); setErr(fContact, eContact, c ? '' : 'Enter a valid email address or phone number.'); return c; }
fName.addEventListener('blur', function(){ if (fName.value) checkName(); });
fContact.addEventListener('blur', function(){ if (fContact.value) checkContact(); });
fName.addEventListener('input', function(){ if (fName.getAttribute('aria-invalid') && fName.value.trim().length >= 2) setErr(fName, eName, ''); });
fContact.addEventListener('input', function(){ if (fContact.getAttribute('aria-invalid') && parseContact(fContact.value)) setErr(fContact, eContact, ''); });

$('#entryForm').addEventListener('submit', function(e){
  e.preventDefault();
  var v = view(); if (v.state !== 'open') return;
  var okName = checkName(), c = checkContact();
  if (!okName){ fName.focus(); return; }
  if (!c){ fContact.focus(); return; }
  var key = c.type + ':' + c.value;
  if (store.entries.some(function(x){ return x.idx === v.idx && x.key === key; })){
    setErr(fContact, eContact, 'That ' + (c.type === 'email' ? 'email' : 'number') + ' is already entered for Parshas ' + pName(v.idx)[1] + '.');
    fContact.focus(); return;
  }
  var entry = { id: uid(), idx: v.idx, name: fName.value.trim(), contact: c.display, key: key, ts: Date.now() };
  store.entries.push(entry); store.mine[v.idx] = entry.id; save();
  fName.value = ''; fContact.value = '';
  buzz([10, 40, 14]);
  renderCard(); renderOrganizer();
  ticket.classList.remove('pop'); void ticket.offsetWidth; ticket.classList.add('pop');
});
$('#withdraw').addEventListener('click', function(){
  var v = view(), m = mineEntry(v.idx);
  if (m){ store.entries = store.entries.filter(function(x){ return x.id !== m.id; }); }
  delete store.mine[v.idx]; userChecked = false; save();
  renderCard(); renderOrganizer();
});

/* ---------- Sefer tiles ---------- */
function renderSefer(){
  var v = view(), ul = $('#tiles'); ul.textContent = '';
  PARSHIYOS.forEach(function(p, i){
    var d = new Date(START.getFullYear(), START.getMonth(), START.getDate() + i * 7);
    var ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var cls = v.complete || i < v.idx ? 'past' : (i === v.idx ? 'now' : '');
    var li = el('li', { class: 'tile ' + cls });
    var dt = el('span', { class: 'dt' });
    if (cls === 'past') dt.appendChild(checkIcon());
    dt.appendChild(document.createTextNode(cls === 'now' ? 'This week, ' + ds : ds));
    li.appendChild(el('span', { class: 'he', lang: 'he', dir: 'rtl', text: p[0] }));
    li.appendChild(el('span', { class: 'en', text: p[1] }));
    li.appendChild(dt);
    if (cls === 'now') li.setAttribute('aria-current', 'true');
    ul.appendChild(li);
  });
}

/* ---------- Winners ---------- */
function renderWinners(){
  var v = view(), ul = $('#winnersList'); ul.textContent = '';
  var list = store.winners.slice().sort(function(a, b){ return b.idx - a.idx; });
  list.forEach(function(w){
    var p = pName(w.idx);
    ul.appendChild(el('li', null, [
      el('div', { class: 'p' }, [ el('span', { lang: 'he', dir: 'rtl', text: p[0] }), el('span', { text: 'Parshas ' + p[1] }) ]),
      el('div', { class: 'who' }, [ document.createTextNode(shortName(w.name)), el('small', { text: '$' + CFG.prize }) ])
    ]));
  });
  var empty = $('#winnersEmpty');
  empty.hidden = list.length > 0;
  empty.textContent = v.complete ? 'No weekly winners recorded.' : 'No winners yet. The first $' + CFG.prize + ' winner is drawn after entries close for Parshas ' + pName(v.idx)[1] + '.';
}

/* ---------- Bottom sheet: spring open/close, drag to dismiss ---------- */
function runSpring(o){
  var w = 2 * Math.PI / o.resp, k = w * w, c = 2 * o.zeta * w;
  var x = o.from, vel = o.v || 0, last = performance.now(), id = 0;
  function step(now){
    var dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
    for (var i = 0; i < n; i++){ vel += (-k * (x - o.to) - c * vel) * h; x += vel * h; }
    o.apply(x, vel);
    if (Math.abs(x - o.to) < 0.4 && Math.abs(vel) < 8){ o.apply(o.to, 0); if (o.done) o.done(); return; }
    id = requestAnimationFrame(step);
  }
  id = requestAnimationFrame(step);
  return { cancel: function(){ cancelAnimationFrame(id); } };
}
function rubber(over, dim){ var c = 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

var activeSheet = null;
function Sheet(root, opts){
  var sheet = root.querySelector('.sheet'), scrim = root.querySelector('.scrim'), grab = root.querySelector('.sheet-head');
  var sy = 0, spr = null, lastFocus = null, drag = null, self = { root: root, el: sheet, isOpen: false };

  function setY(y){
    sy = y; sheet.style.transform = 'translateY(' + y + 'px)';
    var h = sheet.offsetHeight || 1; scrim.style.opacity = Math.max(0, Math.min(1, 1 - y / h));
  }
  self.open = function(){
    lastFocus = document.activeElement; self.isOpen = true; activeSheet = self;
    var was = root.hidden; root.hidden = false;
    document.documentElement.classList.add('locked');
    if (opts.onOpen) opts.onOpen();
    if (spr) spr.cancel();
    var h = sheet.offsetHeight;
    if (RM.matches){ setY(0); }
    else { var from = was ? h : sy; setY(from); spr = runSpring({ from: from, to: 0, zeta: 1, resp: 0.42, apply: setY }); }
    var f = opts.focus ? opts.focus() : sheet;
    f.focus({ preventScroll: true });
  };
  self.close = function(vel){
    if (!self.isOpen) return; self.isOpen = false;
    if (spr) spr.cancel();
    var h = sheet.offsetHeight;
    function fin(){
      root.hidden = true; document.documentElement.classList.remove('locked');
      if (activeSheet === self) activeSheet = null;
      if (opts.onClose) opts.onClose();
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    if (RM.matches){ fin(); return; }
    spr = runSpring({ from: sy, to: h + 8, v: vel || 0, zeta: 1, resp: 0.38, apply: setY, done: fin });
  };

  scrim.addEventListener('click', function(){ self.close(0); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-close]'), function(b){ b.addEventListener('click', function(){ self.close(0); }); });

  /* Drag to dismiss: 1:1 tracking, momentum projection, velocity handoff */
  grab.addEventListener('pointerdown', function(e){
    if (e.target.closest('button,input,label,a')) return;
    grab.setPointerCapture(e.pointerId);
    if (spr) spr.cancel();
    drag = { id: e.pointerId, startY: e.clientY, startSy: sy, hist: [{ t: e.timeStamp, y: e.clientY }] };
  });
  grab.addEventListener('pointermove', function(e){
    if (!drag || e.pointerId !== drag.id) return;
    drag.hist.push({ t: e.timeStamp, y: e.clientY }); if (drag.hist.length > 8) drag.hist.shift();
    var y = drag.startSy + (e.clientY - drag.startY);
    if (y < 0) y = -rubber(-y, 320);
    setY(y);
  });
  function endDrag(e){
    if (!drag || e.pointerId !== drag.id) return;
    var hs = drag.hist, lastP = hs[hs.length - 1], v = 0;
    var recent = hs.filter(function(p){ return lastP.t - p.t <= 100; });
    if (recent.length > 1){ var dt = (lastP.t - recent[0].t) / 1000; if (dt > 0) v = (lastP.y - recent[0].y) / dt; }
    drag = null;
    var h = sheet.offsetHeight, projected = sy + (v / 1000) * 0.998 / (1 - 0.998);
    if (projected > h * 0.5) self.close(v);
    else spr = runSpring({ from: sy, to: 0, v: v, zeta: 0.85, resp: 0.38, apply: setY });
  }
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);
  return self;
}
document.addEventListener('keydown', function(e){
  var s = activeSheet; if (!s || !s.isOpen) return;
  if (e.key === 'Escape'){ s.close(0); return; }
  if (e.key === 'Tab'){
    var f = Array.prototype.filter.call(s.el.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])'), function(n){ return !n.disabled && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === s.el)){ e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl){ e.preventDefault(); first.focus(); }
  }
});

/* ---------- Reader: one day's aliyah, pasuk by pasuk ---------- */
var reader = null, readerSheet = Sheet($('#readerRoot'), { onClose: stopTracking });
var readerRing = makeRing($('#readerRing')), pesukimEl = $('#pesukim'), readerBody = $('#readerBody');
var taamimEl = $('#taamim'), doubleEl = $('#double');
var rLoading = $('#readerLoading'), rError = $('#readerError'), rFoot = $('#readerFoot');
taamimEl.checked = store.taamim !== false;
doubleEl.checked = !!store.double;

function openReader(d){
  var idx = view().learnIdx; if (idx < 0 || idx > 11) return;
  var range = PARSHIYOS[idx][2][d];
  reader = { idx: idx, d: d, range: range, ref: CSM.sefariaRef(range), list: CSM.pesukim(range), text: null };
  $('#readerTitle').textContent = '';
  $('#readerTitle').appendChild(document.createTextNode(DAYS[d][1] + ' '));
  $('#readerTitle').appendChild(el('span', { lang: 'he', dir: 'rtl', text: DAYS[d][0] }));
  $('#readerSub').textContent = DAYS[d][3] + ' · Parshas ' + PARSHIYOS[idx][1] + ' · ' + CSM.rangeLabel(range) + ' · ' + reader.list.length + ' pesukim';
  $('#readerErrorLink').href = CSM.sefariaLink(reader.ref);
  pesukimEl.textContent = ''; readerBody.scrollTop = 0;
  renderReaderHead(); renderHow();
  readerSheet.open();
  loadReader();
}
function loadReader(){
  var r = reader;
  rLoading.hidden = false; rError.hidden = true; rFoot.hidden = true;
  CSM.loadAliyah(r.ref).then(function(t){
    if (reader !== r) return;
    r.text = t; rLoading.hidden = true;
    renderPesukim();
    resumeAtFirstUnread();
    startTracking();
  }, function(){
    if (reader !== r) return;
    rLoading.hidden = true; rError.hidden = false;
  });
}
$('#readerRetry').addEventListener('click', loadReader);

function renderHow(){
  $('#readerHow').textContent = (store.double
    ? 'Each pasuk is printed twice, then the Targum.'
    : 'Read each pasuk twice, then the Targum once.') + ' Pesukim are marked read as you scroll past them.';
}
function renderReaderHead(){
  var s = dayStats(reader.idx, reader.d), name = DAYS[reader.d][1];
  setRing(readerRing, s.frac, s.done + '/' + s.total);
  readerRing.querySelector('.bar').style.stroke = s.complete ? 'var(--ok)' : '';
  $('#markAll').textContent = s.complete ? 'Clear progress for ' + name : 'Mark all pesukim read';
  var end = $('#readerEnd');
  end.classList.toggle('complete', s.complete);
  end.textContent = '';
  end.appendChild(el('b', { text: s.complete ? name + ' complete' : 'End of ' + name }));
  end.appendChild(document.createTextNode(s.complete ? 'All ' + s.total + ' pesukim read.' : s.done + ' of ' + s.total + ' pesukim read so far.'));
}
function renderPesukim(){
  var r = reader, done = doneList(r.idx, r.d), withTaamim = store.taamim !== false, lastPerek = 0;
  pesukimEl.textContent = '';
  r.items = [];
  r.list.forEach(function(pv, i){
    if (pv[0] !== lastPerek){
      lastPerek = pv[0];
      pesukimEl.appendChild(el('li', { class: 'perek', 'aria-hidden': 'true' }, [
        el('span', { text: 'Perek ' + pv[0] }), el('span', { lang: 'he', dir: 'rtl', text: 'פרק ' + CSM.heNum(pv[0]) })
      ]));
    }
    var mikra = r.text.mikra[i] || '', targum = r.text.targum[i] || '';
    if (!withTaamim){ mikra = CSM.stripTaamim(mikra); targum = CSM.stripTaamim(targum); }
    var num = el('span', { class: 'num', text: CSM.heNum(pv[1], true) });
    var m = el('p', { class: 'mikra', lang: 'he' }, [num]);
    m.appendChild(document.createTextNode(mikra));
    var kids = [m];
    if (store.double) kids.push(el('p', { class: 'mikra again', lang: 'he', 'aria-hidden': 'true', text: mikra }));
    if (targum) kids.push(el('p', { class: 'targum', lang: 'arc', text: targum }));
    var li = el('li', { class: 'pasuk', id: 'p' + i, 'aria-label': 'Pasuk ' + pv[0] + ':' + pv[1] }, kids);
    markItem(li, done.indexOf(i) > -1);
    pesukimEl.appendChild(li);
    r.items.push(li);
  });
  var src = $('#readerSource'); src.textContent = 'Text from Sefaria: ' +
    [r.text.mikraVersion, r.text.targumVersion && ('Targum Onkelos (' + r.text.targumVersion + ')')].filter(Boolean).join(' and ') + '. ';
  src.appendChild(el('a', { href: CSM.sefariaLink(r.ref), target: '_blank', rel: 'noopener', text: 'Open on Sefaria' }));
  rFoot.hidden = false;
}
function markItem(li, on){
  if (li.classList.contains('read') === on && li.dataset.marked) return;
  li.dataset.marked = '1';
  li.classList.toggle('read', on);
  var num = li.querySelector('.num'), icon = num.querySelector('svg');
  if (on && !icon) num.insertBefore(checkIcon(), num.firstChild);
  if (!on && icon) icon.remove();
}
function setDone(next){
  var r = reader, key = progKey(r.idx, r.d), was = dayStats(r.idx, r.d).complete;
  if (next.length) store.progress[key] = next.sort(function(a, b){ return a - b; }); else delete store.progress[key];
  save();
  (r.items || []).forEach(function(li, i){ markItem(li, next.indexOf(i) > -1); });
  renderReaderHead(); renderDays();
  if (!was && dayStats(r.idx, r.d).complete) buzz([12, 50, 18]);
}
/* Reopening a day that's partly read starts at the first unread pasuk. */
function resumeAtFirstUnread(){
  var r = reader, done = doneList(r.idx, r.d);
  if (!done.length || done.length >= r.list.length) return;
  for (var i = 0; i < r.items.length; i++){
    if (done.indexOf(i) === -1){
      var target = i > 0 ? r.items[i] : null; if (!target) return;
      readerBody.scrollTop += target.getBoundingClientRect().top - readerBody.getBoundingClientRect().top - 12;
      return;
    }
  }
}

/* Scroll-based progress. A pasuk counts as read once it has been on screen for
   SEEN_MS in total and has scrolled up past the reading line, 30% from the top.
   Flicking straight to the end doesn't count, because the pesukim weren't on screen long enough. */
var SEEN_MS = 1500, LINE = 0.3, track = null;
function startTracking(){
  stopTracking();
  track = { seen: reader.list.map(function(){ return 0; }), last: performance.now(), raf: 0 };
  track.timer = setInterval(tick, 250);
  readerBody.addEventListener('scroll', onReaderScroll, { passive: true });
}
function stopTracking(){
  if (!track) return;
  clearInterval(track.timer); cancelAnimationFrame(track.raf);
  readerBody.removeEventListener('scroll', onReaderScroll);
  track = null;
}
function onReaderScroll(){
  if (track && !track.raf) track.raf = requestAnimationFrame(function(){ if (track){ track.raf = 0; tick(); } });
}
function tick(){
  if (!track || !reader || !reader.items) return;
  var now = performance.now(), dt = Math.min(now - track.last, 500); track.last = now;
  if (document.hidden) return;
  var box = readerBody.getBoundingClientRect(), line = box.top + box.height * LINE;
  var done = doneList(reader.idx, reader.d), added = [];
  reader.items.forEach(function(li, i){
    var rc = li.getBoundingClientRect();
    if (rc.bottom > box.top && rc.top < box.bottom) track.seen[i] += dt;
    if (rc.bottom < line && track.seen[i] >= SEEN_MS && done.indexOf(i) === -1) added.push(i);
  });
  if (added.length) setDone(done.concat(added));
}

$('#markAll').addEventListener('click', function(){
  if (!reader) return;
  setDone(dayStats(reader.idx, reader.d).complete ? [] : reader.list.map(function(_, i){ return i; }));
});
function rerenderKeepingPlace(){
  if (!reader || !reader.text) return;
  /* Keep the pasuk at the top of the screen in place when the layout changes. */
  var box = readerBody.getBoundingClientRect(), anchor = 0;
  reader.items.forEach(function(li, i){ if (li.getBoundingClientRect().top <= box.top + 1) anchor = i; });
  renderPesukim();
  if (readerBody.scrollTop > 0) readerBody.scrollTop += reader.items[anchor].getBoundingClientRect().top - box.top;
}
taamimEl.addEventListener('change', function(){ store.taamim = taamimEl.checked; save(); rerenderKeepingPlace(); });
doubleEl.addEventListener('change', function(){ store.double = doubleEl.checked; save(); renderHow(); rerenderKeepingPlace(); });

/* ---------- Organizer sheet ---------- */
var lockView = $('#lockForm'), orgContent = $('#orgContent'), codeInput = $('#orgCode'), eCode = $('#eCode');
var unlocked = false, fails = 0, lockedUntil = 0, drawing = false;
try { unlocked = sessionStorage.getItem('csm.org') === '1'; } catch(e){}
function applyLock(){ lockView.hidden = unlocked; orgContent.hidden = !unlocked; }
var orgSheet = Sheet($('#sheetRoot'), {
  onOpen: function(){ applyLock(); renderOrganizer(); },
  focus: function(){ return unlocked ? $('#sheet') : codeInput; }
});

/* Organizer code gate (prototype). Replace with real sign-in later. */
lockView.addEventListener('submit', function(e){
  e.preventDefault();
  var now = Date.now();
  if (now < lockedUntil){ eCode.textContent = 'Too many attempts. Try again in ' + Math.ceil((lockedUntil - now) / 1000) + ' seconds.'; return; }
  if (codeInput.value.trim() === CFG.orgCode){
    unlocked = true; fails = 0; codeInput.value = ''; eCode.textContent = ''; codeInput.removeAttribute('aria-invalid');
    try { sessionStorage.setItem('csm.org', '1'); } catch(e){}
    applyLock(); renderOrganizer();
    buzz(10);
  } else {
    fails++; codeInput.setAttribute('aria-invalid', 'true');
    if (fails >= 5){ lockedUntil = now + 30000; fails = 0; eCode.textContent = 'Too many attempts. Try again in 30 seconds.'; }
    else eCode.textContent = 'Incorrect code.';
    codeInput.select();
  }
});
codeInput.addEventListener('input', function(){ if (codeInput.getAttribute('aria-invalid')){ codeInput.removeAttribute('aria-invalid'); eCode.textContent = ''; } });
$('#lockBtn').addEventListener('click', function(){
  unlocked = false; try { sessionStorage.removeItem('csm.org'); } catch(e){}
  applyLock(); $('#sheet').focus({ preventScroll: true });
});
$('#openOrg').addEventListener('click', orgSheet.open);
$('#openOrgSmall').addEventListener('click', orgSheet.open);

function renderOrganizer(){
  var v = { idx: view().orgIdx }, p = pName(v.idx), list = entriesFor(v.idx), w = winnerFor(v.idx);
  $('#orgParsha').textContent = 'Parshas ' + p[1];
  $('#orgCount').textContent = list.length === 1 ? '1 entry' : list.length + ' entries';
  $('#drawBtn').disabled = !list.length || drawing;
  $('#drawBtn').textContent = w ? 'Draw again' : 'Draw $' + CFG.prize + ' winner';
  if (!drawing){
    var box = $('#winnerBox'); box.hidden = !w;
    if (w){ $('#winnerLabel').textContent = '$' + CFG.prize + ' winner'; $('#drawName').textContent = w.name; $('#drawContact').textContent = w.contact; }
  }
  var ul = $('#elist'); ul.textContent = '';
  list.forEach(function(e){
    var rm = el('button', { type: 'button', text: 'Remove', 'aria-label': 'Remove entry for ' + e.name });
    rm.addEventListener('click', function(){
      store.entries = store.entries.filter(function(x){ return x.id !== e.id; });
      Object.keys(store.mine).forEach(function(k){ if (store.mine[k] === e.id) delete store.mine[k]; });
      save(); renderAll();
    });
    ul.appendChild(el('li', null, [ el('div', null, [ el('b', { text: e.name }), el('span', { text: e.contact }) ]), rm ]));
  });
  $('#eempty').hidden = list.length > 0;
  Array.prototype.forEach.call($('#seg').children, function(b){ b.setAttribute('aria-checked', String(b.dataset.v === store.override)); });
}

$('#drawBtn').addEventListener('click', function(){
  var v = { idx: view().orgIdx }, list = entriesFor(v.idx); if (!list.length || drawing) return;
  var pick = list[randInt(list.length)], out = $('#drawName');
  function finish(){
    out.textContent = pick.name; $('#drawContact').textContent = pick.contact;
    store.winners = store.winners.filter(function(x){ return x.idx !== v.idx; });
    store.winners.push({ idx: v.idx, name: pick.name, contact: pick.contact, ts: Date.now() });
    save(); drawing = false; renderAll();
    buzz([12, 50, 18]);
  }
  if (RM.matches || list.length === 1){ finish(); return; }
  drawing = true; $('#drawBtn').disabled = true; $('#winnerBox').hidden = false; $('#winnerLabel').textContent = 'Drawing';
  var delay = 60, t0 = performance.now();
  (function roll(){
    out.textContent = list[randInt(list.length)].name; $('#drawContact').textContent = '';
    delay *= 1.12;
    if (performance.now() - t0 < 1500) setTimeout(roll, delay); else finish();
  })();
});
$('#seg').addEventListener('click', function(e){
  var b = e.target.closest('button'); if (!b) return;
  store.override = b.dataset.v; save(); renderAll();
});
$('#demoBtn').addEventListener('click', function(){
  var v = { idx: view().orgIdx }, names = ['Chana Levy','Yosef Katz','Devorah Stern','Meir Goldberg','Rivka Adler'];
  names.forEach(function(n){
    var email = n.split(' ')[0].toLowerCase() + '@example.com', key = 'email:' + email;
    if (!store.entries.some(function(x){ return x.idx === v.idx && x.key === key; }))
      store.entries.push({ id: uid(), idx: v.idx, name: n, contact: email, key: key, ts: Date.now() });
  });
  save(); renderAll();
});
var clearArmed = null;
$('#clearBtn').addEventListener('click', function(){
  var b = $('#clearBtn');
  if (!clearArmed){
    b.textContent = 'Tap again to clear everything';
    clearArmed = setTimeout(function(){ clearArmed = null; b.textContent = 'Clear all prototype data'; }, 3000);
    return;
  }
  clearTimeout(clearArmed); clearArmed = null; b.textContent = 'Clear all prototype data';
  store = blankStore(); taamimEl.checked = true; doubleEl.checked = false; userChecked = false; save(); renderAll();
});

/* ---------- Orchestration ---------- */
function renderAll(){ renderHero(); renderDays(); renderCard(); renderSefer(); renderWinners(); renderOrganizer(); }
renderAll();

function viewKey(v){ return [v.state, v.idx, v.complete, v.learnIdx, v.dow].join('|'); }
var lastKey = viewKey(view());
setInterval(function(){
  var v = view(), key = viewKey(v);
  if (key !== lastKey){ lastKey = key; renderAll(); } else if (!v.complete){ renderCount(v); }
}, 1000);

/* Small-screen nav: single Organizer button */
function syncNav(){
  var small = window.matchMedia('(max-width: 720px)').matches;
  $('#openOrg').hidden = small; $('#openOrgSmall').hidden = !small;
}
syncNav();
window.addEventListener('resize', function(){ syncNav(); fitBanner(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBanner);

var nav = $('#nav');
window.addEventListener('scroll', function(){ nav.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
})(window.CSM);
