/* Synchronisation de l'historique et de « Mes erreurs » entre appareils (Supabase Auth + tables protégées par RLS).
   Sans connexion, rien ne change : tout reste local dans le navigateur. */
(function () {
  var URL_ = 'https://rcrkksvkkoujrmpnpvov.supabase.co';
  var KEY = 'sb_publishable_cfjmRq5I4YvrEZB0hbSK-w_-GQ_WWzz';
  var AUTH_KEY = 'qcm_auth';
  var DOMAIN = '@qcm.local';

  function getAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
  function setAuth(a) { try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch (e) {} }

  async function tokenCall(grant, body) {
    var r = await fetch(URL_ + '/auth/v1/token?grant_type=' + grant, {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(j.error_description || j.msg || j.error || 'Erreur'); err.status = r.status; throw err; }
    return {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in || 3600) * 1000,
      user_id: j.user && j.user.id,
      username: ((j.user && j.user.email) || '').replace(DOMAIN, '')
    };
  }

  async function login(username, password) {
    var email = String(username || '').trim().toLowerCase() + DOMAIN;
    try {
      var a = await tokenCall('password', { email: email, password: password });
      setAuth(a); return a;
    } catch (e) {
      if (e.status === 400 || e.status === 401) throw new Error("Nom d'utilisateur ou mot de passe incorrect.");
      throw new Error('Connexion impossible pour le moment. Vérifie ta connexion internet.');
    }
  }
  function logout() { setAuth(null); }

  async function getToken() {
    var a = getAuth(); if (!a) return null;
    if (Date.now() < a.expires_at - 60000) return a.access_token;
    try {
      var n = await tokenCall('refresh_token', { refresh_token: a.refresh_token });
      n.username = n.username || a.username; setAuth(n); return n.access_token;
    } catch (e) {
      if (e.status === 400 || e.status === 401) setAuth(null); // session expirée : il faudra se reconnecter
      return null;
    }
  }

  async function rest(path, opts) {
    var t = await getToken(); if (!t) throw new Error('non connecté');
    opts = opts || {};
    var h = Object.assign({ apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, opts.headers || {});
    var r = await fetch(URL_ + '/rest/v1/' + path, { method: opts.method || 'GET', headers: h, body: opts.body });
    if (!r.ok) throw new Error('Erreur ' + r.status);
    var txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  function strip(h) { // on n'envoie pas les images (lourdes) dans l'historique distant
    var c = JSON.parse(JSON.stringify(h));
    (c.details || []).forEach(function (d) { if (d.image) d.image = ''; });
    return c;
  }
  function chunks(arr, n) { var o = []; for (var i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }
  function readLS(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function writeLS(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    try { if (window.localforage) localforage.setItem(k, v); } catch (e) {}
  }

  async function syncHistory() {
    var remote = await rest('user_history?select=session_id,data');
    var local = readLS('qcm_history', []);          // relu juste avant d'écrire (pas d'await entre lecture et écriture)
    var rmap = {}, lmap = {};
    remote.forEach(function (r) { rmap[r.session_id] = r.data; });
    local.forEach(function (h) { lmap[h.date] = h; });
    var up = local.filter(function (h) { return h.date && !rmap[h.date]; }).map(function (h) { return { session_id: h.date, data: strip(h) }; });
    var down = remote.filter(function (r) { return !lmap[r.session_id]; }).map(function (r) { return r.data; });
    var changed = false;
    if (down.length) {
      writeLS('qcm_history', local.concat(down).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }));
      changed = true;
    }
    for (var c of chunks(up, 15)) await rest('user_history', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(c) });
    return changed;
  }

  async function syncErrors() {
    var remote = await rest('user_errors?select=qkey,streak,cleared,t');
    var local = readLS('qcm_errors', {});
    var rmap = {}, up = [], changed = false;
    remote.forEach(function (r) { rmap[r.qkey] = r; });
    Object.keys(local).forEach(function (k) {
      var l = local[k], r = rmap[k];
      if (!r || (l.t || 0) > r.t) up.push({ qkey: k, streak: l.streak || 0, cleared: !!l.cleared, t: l.t || 0 });
    });
    remote.forEach(function (r) {
      var l = local[r.qkey];
      if (!l || r.t > (l.t || 0)) { local[r.qkey] = { streak: r.streak, cleared: r.cleared, t: r.t }; changed = true; }
    });
    if (changed) writeLS('qcm_errors', local);
    for (var c of chunks(up, 100)) await rest('user_errors', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(c) });
    return changed;
  }

  var running = null, timer = null;
  function syncNow() {
    if (!getAuth()) return Promise.resolve({ ok: false, changed: false });
    if (running) return running;
    running = (async function () {
      try {
        var c1 = await syncHistory(), c2 = await syncErrors();
        var res = { ok: true, changed: c1 || c2 };
        window.dispatchEvent(new CustomEvent('qcm-synced', { detail: res }));
        return res;
      } catch (e) { return { ok: false, changed: false, error: e.message }; }
      finally { running = null; }
    })();
    return running;
  }
  function schedule() { if (!getAuth()) return; clearTimeout(timer); timer = setTimeout(syncNow, 1500); }

  async function clearRemoteHistory() {
    if (!getAuth()) return true;
    try { await rest('user_history?session_id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); return true; }
    catch (e) { return false; }
  }

  window.qcmSync = {
    login: login, logout: logout, syncNow: syncNow, schedule: schedule, clearRemoteHistory: clearRemoteHistory,
    user: function () { var a = getAuth(); return a ? (a.username || 'marco') : null; }
  };
  if (getAuth()) setTimeout(syncNow, 150);
  // Porte d'entrée : sans compte connecté ni choix « continuer sans me connecter » (valable pour la visite en cours), on va à la connexion
  var guest = false; try { guest = sessionStorage.getItem('qcm_guest') === '1'; } catch (e) {}
  if (!getAuth() && !guest && !/login\.html$/.test(location.pathname)) location.replace('login.html');
})();
