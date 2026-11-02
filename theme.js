/* Thème centralisé : lit qcm_settings, pose data-theme + couleur d'accent sur <html>.
   Chargé en <head> (avant le rendu) pour éviter tout flash. */
(function () {
  var DEFAULTS = { light: '#237A31', dark: '#4ADE80' };
  var LEGACY = ['#00c853', '#e8ff00']; // anciens défauts : on les remplace par le défaut du thème
  function lum(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  function shade(hex, f) { // f<1 assombrit
    var c = [1, 3, 5].map(function (i) { return Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))); });
    return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function rgba(hex, a) {
    return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';
  }
  window.applyQcmTheme = function (theme, accent) {
    var t = theme === 'dark' ? 'dark' : 'light';
    var c = (accent && /^#[0-9a-f]{6}$/i.test(accent) && LEGACY.indexOf(accent.toLowerCase()) < 0) ? accent : DEFAULTS[t];
    var r = document.documentElement;
    r.setAttribute('data-theme', t);
    r.style.setProperty('--yellow', c);
    r.style.setProperty('--accent-color', c);
    r.style.setProperty('--yellow-text', t === 'dark' ? c : shade(c, 0.75));
    r.style.setProperty('--yellow-dim', rgba(c, t === 'dark' ? 0.14 : 0.12));
    r.style.setProperty('--accent-deep', shade(c, t === 'dark' ? 0.55 : 0.68));
    r.style.setProperty('--on-accent', lum(c) > 150 ? '#10200f' : '#ffffff');
  };
  var s = {};
  try { s = JSON.parse(localStorage.getItem('qcm_settings') || '{}'); } catch (e) {}
  window.applyQcmTheme(s.theme, s.accentColor);
})();
