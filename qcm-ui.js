/* Rendu de correction partagé (quiz.html + historique.html).
   Style « E1 miroir » : à gauche ce que tu as coché, à droite ce qui est vrai. */
(function () {
  window.qKey = function(q) {
  const s = (q.tag || '') + '|' + (q.type || 'qcm') + '|' + String(q.question || '').replace(/\s+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'q' + (h >>> 0).toString(36);
};
  var L = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  function list(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];
  }
  /* q : question ; userAns : tableau d'index cochés ; ptsStr : "+1 pt" déjà formaté ; pts : nombre */
  window.qcmCorrectionHTML = function (q, userAns, pts, ptsStr, opts) {
    opts = opts || {};
    userAns = Array.isArray(userAns) ? userAns : [];
    var correct = q.correct || [];
    var missed = [], wrong = [];
    var h = '<div class="corr-legend"><span>À gauche : <strong>ce que tu as coché</strong></span>' +
            '<span>À droite : <strong>ce qui est vrai</strong></span></div><div class="corr-list">';
    (q.options || []).forEach(function (opt, i) {
      var good = correct.indexOf(i) > -1, picked = userAns.indexOf(i) > -1, ok = good === picked;
      if (good && !picked) missed.push(L[i]);
      if (!good && picked) wrong.push(L[i]);
      var exp = q.optExps && q.optExps[i] ? q.optExps[i] : '';
      h += '<div class="corr-row' + (ok ? '' : ' err') + '">' +
           '<div class="corr-mine"><div class="corr-chip' + (picked ? ' on' : '') + '">' + L[i] + '</div>' +
           '<div class="corr-cap">' + (picked ? 'cochée' : 'non cochée') + '</div></div>' +
           '<div class="corr-body"><div class="corr-text">' + opt + '</div>' +
           (exp ? '<div class="corr-exp">' + exp + '</div>' : '') + '</div>' +
           '<div class="corr-verdict"><div class="corr-pill' + (good ? '' : ' false') + '">' + (good ? 'VRAIE' : 'FAUSSE') + '</div>' +
           '<div class="corr-res">' + (ok ? 'Juste' : 'Erreur') + '</div></div></div>';
    });
    h += '</div>';
    var cls, title, sub;
    if (!missed.length && !wrong.length) { cls = ''; title = 'Bravo !'; sub = 'Tout est juste.'; }
    else {
      cls = pts > 0 ? 'partial' : 'err';
      title = pts > 0 ? 'Presque !' : 'Raté';
      var parts = [];
      if (missed.length) parts.push('Il fallait aussi cocher ' + list(missed) + '.');
      if (wrong.length) parts.push(list(wrong) + (wrong.length > 1 ? ' étaient fausses.' : ' était fausse.'));
      sub = parts.join(' ');
    }
    if (opts.banner !== false) h += '<div class="corr-banner ' + cls + '"><div><div class="t">' + title + '</div></div>' +
         '<div class="s">' + sub + (ptsStr ? ' <strong>' + ptsStr + '</strong>' : '') + (opts.note ? '<br>' + opts.note : '') + '</div></div>';
    if (opts.explanation !== false && q.explanation) h += '<div class="corr-free" style="margin-top:12px;"><span class="k">À retenir</span>' + q.explanation + '</div>';
    return h;
  };
})();

/* Stats par tag : Fait / Réussite / Ancrage (3 dernières réponses justes). Utilisé par l'accueil et stats.html */
window.qcmStats = function (questions, hist) {
  var total = {}, qtag = {}, attempts = {}, st = {};
  questions.forEach(function (q) { var t = q.tag || 'Sans chapitre'; total[t] = (total[t] || 0) + 1; qtag[qKey(q)] = t; });
  hist.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (h) {
    (h.details || []).forEach(function (d) {
      var answered = Array.isArray(d.userAns) ? d.userAns.length > 0 : String(d.userAns || '').trim() !== '';
      if (!answered && d.type !== 'qzone') return;
      if (typeof d.pts !== 'number') return;
      (attempts[qKey(d)] = attempts[qKey(d)] || []).push(d.pts);
    });
  });
  Object.keys(total).forEach(function (t) { st[t] = { t: t, total: total[t], seen: 0, ok: 0, n: 0, anch: 0 }; });
  Object.keys(attempts).forEach(function (k) {
    var t = qtag[k]; if (!t) return;
    var a = attempts[k], x = st[t];
    x.seen++; x.n += a.length; x.ok += a.filter(function (p) { return p >= 1; }).length;
    if (a.length >= 3 && a.slice(-3).every(function (p) { return p >= 1; })) x.anch++;
  });
  return Object.keys(st).map(function (t) {
    var x = st[t];
    x.fait = Math.round(x.seen / x.total * 100);
    x.reu = x.n ? Math.round(x.ok / x.n * 100) : null;
    x.anc = Math.round(x.anch / x.total * 100);
    return x;
  });
};
window.qcmStatSort = function (list, mode) {
  var l = list.slice();
  if (mode === 'az') return l.sort(function (a, b) { return a.t.localeCompare(b.t, 'fr', { numeric: true }); });
  var worst = mode === 'worst';
  return l.sort(function (a, b) {
    if ((a.reu === null) !== (b.reu === null)) return a.reu === null ? 1 : -1; // jamais travaillés en bas
    var d = worst ? (a.reu || 0) - (b.reu || 0) : (b.reu || 0) - (a.reu || 0);
    return d || (worst ? a.anc - b.anc : b.anc - a.anc) || a.t.localeCompare(b.t, 'fr', { numeric: true });
  });
};
window.qcmStatColor = function (r) { return r === null ? 'var(--border-2)' : r >= 75 ? 'var(--green)' : r >= 50 ? 'var(--amber-text)' : 'var(--red)'; };
