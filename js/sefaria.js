/* Loads Mikra and Targum Onkelos for a range of pesukim from Sefaria (sefaria.org).
   Tries the v3 texts API first and falls back to the v1 API. Results are cached. */
(function(CSM){
'use strict';

var BASE = 'https://www.sefaria.org';
var CACHE_KEY = 'csm.text.v1', CACHE_MAX = 21;
var mem = {};

function readCache(){
  try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && c.order && c.items) return c; } catch(e){}
  return { order: [], items: {} };
}
function writeCache(ref, val){
  var c = readCache();
  c.items[ref] = val;
  c.order = c.order.filter(function(r){ return r !== ref; }).concat(ref);
  while (c.order.length > CACHE_MAX) delete c.items[c.order.shift()];
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }
  catch(e){ try { localStorage.removeItem(CACHE_KEY); } catch(e2){} }
}

function getJSON(url){
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 15000) : 0;
  return fetch(url, { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .finally(function(){ clearTimeout(timer); });
}
/* Spanning refs come back as one array per perek; flatten to one array of pesukim. */
function flat(a){
  return (Array.isArray(a) ? a : [a]).reduce(function(out, x){ return out.concat(Array.isArray(x) ? flat(x) : [x]); }, []);
}
function fromV3(j){
  var v = j && j.versions && j.versions[0];
  if (!v || !v.text) throw new Error('No text');
  return { text: flat(v.text), version: v.versionTitle || '' };
}
function fromV1(j){
  if (!j || !j.he || !j.he.length) throw new Error('No text');
  return { text: flat(j.he), version: j.heVersionTitle || '' };
}
function fetchVersion(ref, lang){
  var enc = encodeURIComponent(ref);
  return getJSON(BASE + '/api/v3/texts/' + enc + '?version=' + lang).then(fromV3)
    .catch(function(){ return getJSON(BASE + '/api/texts/' + enc + '?context=0&commentary=0&pad=0').then(fromV1); });
}

/* Sefaria text is lightly marked up: drop footnotes and petucha/setuma markers, keep the words. */
function clean(html){
  if (!html) return '';
  var doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
  Array.prototype.forEach.call(doc.querySelectorAll('i.footnote, sup, .footnote'), function(n){ n.remove(); });
  return doc.body.textContent.replace(/\{[פס]\}/g, '').replace(/\s+/g, ' ').trim();
}

/* ref like "Genesis.9.18-10.32". Resolves { mikra: [], targum: [], mikraVersion, targumVersion }. */
CSM.loadAliyah = function(ref){
  if (mem[ref]) return Promise.resolve(mem[ref]);
  var cached = readCache().items[ref];
  if (cached){ mem[ref] = cached; return Promise.resolve(cached); }
  return Promise.all([ fetchVersion(ref, 'hebrew'), fetchVersion('Onkelos ' + ref, 'primary') ]).then(function(r){
    var val = {
      mikra: r[0].text.map(clean), targum: r[1].text.map(clean),
      mikraVersion: r[0].version, targumVersion: r[1].version
    };
    if (!val.mikra.length) throw new Error('Empty text');
    mem[ref] = val; writeCache(ref, val);
    return val;
  });
};
CSM.sefariaLink = function(ref){ return BASE + '/' + ref + '?lang=he'; };

/* Remove cantillation (ta'amim) and paseq; keep nikud and maqaf. */
CSM.stripTaamim = function(s){
  return s.replace(/[֑-ֽ֯]/g, '').replace(/\s*׀\s*/g, ' ');
};

})(window.CSM = window.CSM || {});
