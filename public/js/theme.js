/* Runs in <head> before first paint so the page never flashes the wrong theme. */
(function () {
  'use strict';
  var KEY = 'uzconv.theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; } catch (e) { return null; }
  }
  function current() { return stored() || (media && media.matches ? 'dark' : 'light'); }
  function apply(theme) { root.setAttribute('data-theme', theme); }

  apply(current());

  // Follow the device setting until the visitor makes an explicit choice.
  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (!stored()) apply(current()); });
  }

  window.UzTheme = {
    get: function () { return root.getAttribute('data-theme') || 'light'; },
    set: function (theme) {
      apply(theme);
      try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: applies for this visit only */ }
    }
  };
})();
