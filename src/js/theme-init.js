/* Put this in <head>, before the stylesheet if you like. It applies the theme
   a visitor chose earlier before the first paint, so there is no flash of the
   wrong theme. Visitors who never chose get the operating system's setting
   from the CSS alone (prefers-color-scheme), with or without JavaScript. */
(function () {
  try {
    var saved = localStorage.getItem('ld-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-ld-theme', saved);
  } catch (e) { /* storage blocked: the OS setting still applies */ }
})();
