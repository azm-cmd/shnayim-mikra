/* Live service: raffle entries in a Google Sheet through the Apps Script web app (server/Code.gs),
   and Sign in with Google for organizers. Unused in demo mode (no api in js/config.js). */
(function(CSM){
'use strict';

var S = CSM.SERVICE || {};
CSM.live = !!S.api;

/* Apps Script answers a plain-text POST without a CORS preflight. */
function call(body){
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 25000) : 0;
  return fetch(S.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
    .then(function(r){ return r.json(); })
    .catch(function(){ throw Object.assign(new Error('Couldn’t reach the raffle. Check your connection and try again.'), { code: 'network' }); })
    .then(function(j){ if (!j || !j.ok) throw Object.assign(new Error((j && j.message) || 'Something went wrong.'), { code: (j && j.code) || 'server' }); return j; })
    .finally(function(){ clearTimeout(timer); });
}

CSM.remote = {
  submit: function(idx, name, contact, website){ return call({ action: 'submit', idx: idx, name: name, contact: contact, website: website || '' }); },
  withdraw: function(idx, mine){ return call({ action: 'withdraw', idx: idx, id: mine.id, token: mine.token }); },
  winners: function(){
    return fetch(S.api + '?action=winners').then(function(r){ return r.json(); }).then(function(j){
      if (!j || !j.ok) throw new Error('winners'); return j.winners;
    });
  },
  org:    function(idx){ return call({ action: 'org', idx: idx, idToken: CSM.auth.token() }); },
  draw:   function(idx){ return call({ action: 'draw', idx: idx, idToken: CSM.auth.token() }); },
  remove: function(idx, id){ return call({ action: 'remove', idx: idx, id: id, idToken: CSM.auth.token() }); }
};

/* ---------- Sign in with Google (Google Identity Services) ---------- */
var KEY = 'csm.org.idToken', cred = null, listeners = [], gisLoading = null;
try { cred = sessionStorage.getItem(KEY); } catch(e){}

function payload(t){
  try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch(e){ return null; }
}
function valid(t){ var p = t && payload(t); return !!(p && p.exp * 1000 > Date.now() + 60000); }
function set(t){
  cred = t;
  try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch(e){}
  listeners.forEach(function(fn){ fn(); });
}
function loadGis(){
  if (gisLoading) return gisLoading;
  gisLoading = new Promise(function(resolve, reject){
    if (window.google && google.accounts && google.accounts.id) return resolve();
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ gisLoading = null; reject(new Error('Couldn’t load Google sign-in. Check your connection and try again.')); };
    document.head.appendChild(s);
  }).then(function(){
    google.accounts.id.initialize({ client_id: S.googleClientId, callback: function(r){ set(r.credential); }, auto_select: true, cancel_on_tap_outside: true, use_fedcm_for_prompt: true });
  });
  return gisLoading;
}

CSM.auth = {
  configured: !!S.googleClientId,
  token: function(){ return valid(cred) ? cred : null; },
  email: function(){ var p = valid(cred) && payload(cred); return p ? p.email : ''; },
  onChange: function(fn){ listeners.push(fn); },
  renderButton: function(el){
    return loadGis().then(function(){
      el.textContent = '';
      var dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
      google.accounts.id.renderButton(el, { type: 'standard', theme: dark ? 'filled_black' : 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 280 });
    });
  },
  signOut: function(){
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch(e){}
    set(null);
  },
  expire: function(){ set(null); }
};

})(window.CSM = window.CSM || {});
