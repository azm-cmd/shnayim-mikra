// In-memory stand-ins for the Apps Script services server/Code.gs uses, so it can run under Node.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function makeSheet(name, id){
  const rows = [];
  const sheet = {
    name, id, rows, hidden: [],
    getName: () => name,
    getSheetId: () => id,
    getLastRow: () => rows.length,
    appendRow(r){ rows.push(r.map(v => typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v)); return sheet; },
    deleteRow(n){ rows.splice(n - 1, 1); },
    setFrozenRows(){}, hideColumns(c, n){ sheet.hidden.push([c, n]); },
    getRange(r, c, nr = 1, nc = 1){
      const range = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')),
        getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
        setValues(vals){ vals.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; }); }); return range; },
        setFontWeight: () => range,
        createTextFinder(text){
          let entire = false;
          return {
            matchEntireCell(b){ entire = b; return this; },
            findNext(){
              const t = String(text).toLowerCase();
              for (let i = 0; i < nr; i++){
                const v = String((rows[r - 1 + i] || [])[c - 1] ?? '').toLowerCase();
                if (entire ? v === t : v.includes(t)) return { getRow: () => r + i };
              }
              return null;
            }
          };
        }
      };
      return range;
    }
  };
  return sheet;
}

function makeBook(){
  const sheets = []; let next = 100;
  return {
    sheets,
    getId: () => 'BOOK1', getUrl: () => 'https://docs.google.com/spreadsheets/d/BOOK1/edit',
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet(n, at){ const s = makeSheet(n, next++); if (at === 0) sheets.unshift(s); else sheets.push(s); return s; }
  };
}

/* now: a function returning the real Date to treat as "now" */
function loadServer({ now = () => new Date(), props = {}, tokens = {} } = {}){
  const book = makeBook(), cache = new Map(), calls = { tokeninfo: 0 };
  const store = Object.assign({}, props);
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => book },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => store[k] ?? null, setProperty: (k, v) => { store[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock(){} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s).digest()],
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
      formatDate(d, tz, fmt){
        const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
          .formatToParts(d).forEach(x => { p[x.type] = x.value; });
        if (fmt !== 'yyyy-MM-dd-HH-mm-ss') throw new Error('fmt');
        return `${p.year}-${p.month}-${p.day}-${p.hour}-${p.minute}-${p.second}`;
      }
    },
    UrlFetchApp: {
      fetch(url){
        calls.tokeninfo++;
        const t = decodeURIComponent(url.split('id_token=')[1]), info = tokens[t];
        return { getResponseCode: () => info ? 200 : 400, getContentText: () => JSON.stringify(info || { error: 'invalid_token' }) };
      }
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType(){ return this; } }) }
  };
  // Freeze "now" for the server by swapping Date with a subclass whose no-arg constructor and Date.now() use now().
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a){ if (a.length === 0) super(now().getTime()); else super(...a); }
    static now(){ return now().getTime(); }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../server/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const get = params => JSON.parse(ctx.doGet({ parameter: params }).text);
  return { ctx, book, post, get, props: store, calls };
}

module.exports = { loadServer };
