// Run: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadServer } = require('./gas-mock');

const CLIENT = 'client-123.apps.googleusercontent.com';
const exp = () => Math.floor(Date.parse('2026-11-06T17:00:00Z') / 1000) + 3600;
const tokens = {
  'tok-org':   { aud: CLIENT, iss: 'https://accounts.google.com', email: 'Gabbai@Example.com', email_verified: 'true', exp: String(exp()) },
  'tok-other': { aud: CLIENT, iss: 'accounts.google.com', email: 'someone@example.com', email_verified: 'true', exp: String(exp()) },
  'tok-wrongaud': { aud: 'other-app', iss: 'accounts.google.com', email: 'gabbai@example.com', email_verified: 'true', exp: String(exp()) }
};
const props = { ORGANIZERS: 'gabbai@example.com, second@example.com', GOOGLE_CLIENT_ID: CLIENT };
// Friday Nov 6 2026, noon in New York: Chayei Sarah (idx 4) is open
const OPEN = () => new Date('2026-11-06T17:00:00Z');
// Wednesday Nov 11 2026, 9 AM New York: Chayei Sarah closed, Toldos not open yet
const CLOSED = () => new Date('2026-11-11T14:00:00Z');

test('entry window matches the site exactly', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), ctx);
  const client = ctx.window.CSM.windowAt;
  const { ctx: srv } = loadServer();
  const t0 = Date.UTC(2026, 8, 1), span = 400 * 864e5;
  for (let i = 0; i < 20000; i++){
    const d = new Date(t0 + Math.floor((i / 20000) * span) + (i % 97) * 60000);
    const a = client(d), b = srv.windowAt(d);
    assert.deepEqual([a.raw, a.idx, a.state, a.learnIdx, a.dow, +a.opens, +a.closes], [b.raw, b.idx, b.state, b.learnIdx, b.dow, +b.opens, +b.closes], d.toISOString());
  }
});

test('submit stores the entry in that week’s tab', () => {
  const s = loadServer({ now: OPEN, props });
  const r = s.post({ action: 'submit', idx: 4, name: 'Shmuel Cohen', contact: 'Shmuel@Example.com' });
  assert.equal(r.ok, true); assert.ok(r.id && r.token);
  const tab = s.book.getSheetByName('05 Chayei Sarah');
  assert.equal(tab.rows.length, 2);
  assert.equal(JSON.stringify(tab.rows[1].slice(1, 6)), JSON.stringify(['Shmuel Cohen', 'Shmuel@Example.com', 'email', r.id, 'email:shmuel@example.com']));
  assert.equal(JSON.stringify(tab.hidden), '[[6,2]]');
});

test('one entry per email or phone per week', () => {
  const s = loadServer({ now: OPEN, props });
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'A B', contact: '(555) 555-0123' }).ok, true);
  const dup = s.post({ action: 'submit', idx: 4, name: 'C D', contact: '555.555.0123' });
  assert.equal(dup.code, 'duplicate');
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'E F', contact: 'e@example.com' }).ok, true);
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'G H', contact: 'E@EXAMPLE.COM' }).code, 'duplicate');
});

test('server refuses closed windows, wrong parsha and bad input', () => {
  const closed = loadServer({ now: CLOSED, props });
  assert.equal(closed.post({ action: 'submit', idx: 4, name: 'A B', contact: 'a@example.com' }).code, 'closed');
  const s = loadServer({ now: OPEN, props });
  assert.equal(s.post({ action: 'submit', idx: 3, name: 'A B', contact: 'a@example.com' }).code, 'closed');
  assert.equal(s.post({ action: 'submit', idx: 99, name: 'A B', contact: 'a@example.com' }).code, 'bad_request');
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'A', contact: 'a@example.com' }).code, 'bad_name');
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'A B', contact: 'not-an-email' }).code, 'bad_contact');
  assert.equal(s.post({ action: 'nope' }).code, 'bad_request');
});

test('names that look like formulas are stored as text', () => {
  const s = loadServer({ now: OPEN, props });
  s.post({ action: 'submit', idx: 4, name: '=HYPERLINK("x")', contact: 'f@example.com' });
  assert.equal(s.book.getSheetByName('05 Chayei Sarah').rows[1][1], '=HYPERLINK("x")'); // the mock strips the leading apostrophe, as Sheets does
});

test('honeypot submissions look accepted but are not stored', () => {
  const s = loadServer({ now: OPEN, props });
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'Bot', contact: 'b@example.com', website: 'http://spam' }).ok, true);
  assert.equal(s.book.getSheetByName('05 Chayei Sarah'), null);
});

test('withdraw needs the token from the entry', () => {
  const s = loadServer({ now: OPEN, props });
  const r = s.post({ action: 'submit', idx: 4, name: 'A B', contact: 'a@example.com' });
  s.post({ action: 'withdraw', idx: 4, id: r.id, token: 'wrong' });
  assert.equal(s.book.getSheetByName('05 Chayei Sarah').rows.length, 2);
  s.post({ action: 'withdraw', idx: 4, id: r.id, token: r.token });
  assert.equal(s.book.getSheetByName('05 Chayei Sarah').rows.length, 1);
});

test('organizer actions need a valid Google sign-in on the list', () => {
  const s = loadServer({ now: OPEN, props, tokens });
  assert.equal(s.post({ action: 'org', idx: 4 }).code, 'signin');
  assert.equal(s.post({ action: 'org', idx: 4, idToken: 'forged' }).code, 'signin');
  assert.equal(s.post({ action: 'org', idx: 4, idToken: 'tok-wrongaud' }).code, 'signin');
  const other = s.post({ action: 'org', idx: 4, idToken: 'tok-other' });
  assert.equal(other.code, 'not_organizer'); assert.match(other.message, /someone@example.com/);
  assert.equal(s.post({ action: 'draw', idx: 4, idToken: 'tok-other' }).code, 'not_organizer');
  const ok = s.post({ action: 'org', idx: 4, idToken: 'tok-org' });
  assert.equal(ok.ok, true); assert.equal(ok.email, 'gabbai@example.com');
  // verified tokens are cached instead of re-checked with Google every call
  const before = s.calls.tokeninfo;
  s.post({ action: 'org', idx: 4, idToken: 'tok-org' });
  assert.equal(s.calls.tokeninfo, before);
});

test('expired tokens are refused', () => {
  const old = { 'tok-old': Object.assign({}, tokens['tok-org'], { exp: String(Math.floor(Date.parse('2026-11-06T17:00:00Z') / 1000) - 10) }) };
  const s = loadServer({ now: OPEN, props, tokens: old });
  assert.equal(s.post({ action: 'org', idx: 4, idToken: 'tok-old' }).code, 'signin');
});

test('1,000 entries: organizer list, draw and public winners', () => {
  let i = 0;  // entries arrive 2 seconds apart, about 33 minutes in all
  const s = loadServer({ now: () => new Date(OPEN().getTime() + i * 2000), props, tokens });
  for (; i < 1000; i++){
    const r = s.post({ action: 'submit', idx: 4, name: 'Person ' + i + ' Last' + i, contact: 'p' + i + '@example.com' });
    assert.equal(r.ok, true, r.message);
  }
  const st = s.post({ action: 'org', idx: 4, idToken: 'tok-org' });
  assert.equal(st.total, 1000);
  assert.equal(st.entries.length, 200);
  assert.equal(st.entries[0].name, 'Person 999 Last999');
  assert.match(st.sheetUrl, /#gid=\d+$/);
  const d = s.post({ action: 'draw', idx: 4, idToken: 'tok-org' });
  assert.equal(d.ok, true); assert.match(d.winner.name, /^Person \d+ Last\d+$/);
  const again = s.post({ action: 'draw', idx: 4, idToken: 'tok-org' });
  assert.equal(s.book.getSheetByName('Winners').rows.length, 2, 'drawing again replaces the winner');
  const pub = s.get({ action: 'winners' });
  assert.equal(JSON.stringify(pub.winners), JSON.stringify([{ idx: 4, name: again.winner.name.split(' ')[0] + ' ' + again.winner.name.split(' ').pop()[0] + '.' }]));
  assert.ok(!JSON.stringify(pub).includes('@'), 'public winners never include contacts');
});

test('organizers can remove an entry', () => {
  const s = loadServer({ now: OPEN, props, tokens });
  const r = s.post({ action: 'submit', idx: 4, name: 'Spam Bot', contact: 's@example.com' });
  s.post({ action: 'remove', idx: 4, id: r.id, idToken: 'tok-org' });
  assert.equal(s.post({ action: 'org', idx: 4, idToken: 'tok-org' }).total, 0);
});

test('a burst of 600 entries in one minute is accepted; the flood guard stops the 601st', () => {
  const s = loadServer({ now: OPEN, props });
  for (let i = 0; i < 600; i++) assert.equal(s.post({ action: 'submit', idx: 4, name: 'Burst ' + i, contact: 'b' + i + '@example.com' }).ok, true);
  assert.equal(s.post({ action: 'submit', idx: 4, name: 'One more', contact: 'x@example.com' }).code, 'busy');
});

test('the draw counts each contact once', () => {
  const s = loadServer({ now: OPEN, props, tokens });
  s.post({ action: 'submit', idx: 4, name: 'Only One', contact: 'one@example.com' });
  const tab = s.book.getSheetByName('05 Chayei Sarah');
  tab.rows.push(tab.rows[1].slice());   // simulate two identical entries landing at the same instant
  for (let k = 0; k < 20; k++) assert.equal(s.post({ action: 'draw', idx: 4, idToken: 'tok-org' }).total, 1);
});
