/*! ldcss-theme.js v3.3.0 — MIT */
(function () {
try {
var saved = localStorage.getItem('ld-theme');
if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-ld-theme', saved);
} catch (e) { /* storage blocked: the OS setting still applies */ }
})();
