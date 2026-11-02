/* Rendu de correction partagé (quiz.html + historique.html).
   Style « E1 miroir » : à gauche ce que tu as coché, à droite ce qui est vrai. */
(function () {
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
