/*
 * ReliantOutreach theme switcher.
 * Preferences: "dark" (default), "light", "system" (follows the operating system).
 * The ONLY place a user changes this is Settings > Appearance.
 *
 * 1. Load this file in <head> BEFORE the stylesheets' first paint (see HANDOFF.md, step 2),
 *    so the page never flashes the wrong theme.
 * 2. Any element with data-theme-option="dark|light|system" becomes a working option.
 * 3. Call window.ROTheme.set("light") from your own code if you prefer.
 * 4. To also save the choice to the user's account, listen for "ro:themechange" and call your API.
 */
(function () {
  var KEY = 'ro-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function read() {
    try { return localStorage.getItem(KEY) || root.getAttribute('data-theme-pref') || 'dark'; }
    catch { return root.getAttribute('data-theme-pref') || 'dark'; }
  }
  function resolve(pref) {
    if (pref === 'system') return media && media.matches ? 'light' : 'dark';
    return pref === 'light' ? 'light' : 'dark';
  }
  function apply(pref) {
    root.setAttribute('data-theme', resolve(pref));
    root.setAttribute('data-theme-pref', pref);
    sync(pref);
  }
  function sync(pref) {
    var opts = document.querySelectorAll('[data-theme-option]');
    for (var i = 0; i < opts.length; i++) {
      opts[i].setAttribute('aria-checked', opts[i].getAttribute('data-theme-option') === pref ? 'true' : 'false');
    }
  }
  function set(pref) {
    if (['dark', 'light', 'system'].indexOf(pref) < 0) pref = 'dark';
    try { localStorage.setItem(KEY, pref); } catch {}
    apply(pref);
    document.dispatchEvent(new CustomEvent('ro:themechange', { detail: { preference: pref, theme: resolve(pref) } }));
  }

  apply(read());
  if (media && media.addEventListener) media.addEventListener('change', function () { if (read() === 'system') apply('system'); });
  document.addEventListener('DOMContentLoaded', function () { sync(read()); });
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-theme-option]') : null;
    if (el) { e.preventDefault(); set(el.getAttribute('data-theme-option')); }
  });

  window.ROTheme = { get: read, set: set, resolve: resolve };
})();
