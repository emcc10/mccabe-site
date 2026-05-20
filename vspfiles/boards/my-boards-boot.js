/**
 * Standalone loader for My Boards — no template_266.html required.
 * Deploy only this file + boards assets under /v/vspfiles/boards/
 */
(function () {
  'use strict';

  if (window.__MC_BOARDS_BOOT_DONE) return;
  window.__MC_BOARDS_BOOT_DONE = true;

  var VER = '20260524';

  var path = String(location.pathname || '');
  var base =
    path.indexOf('/v/vspfiles/') !== -1
      ? '/v/vspfiles/boards/'
      : path.indexOf('/vspfiles/') !== -1
        ? '/vspfiles/boards/'
        : '/v/vspfiles/boards/';

  window.MC_BOARDS_API_BASE = window.MC_BOARDS_API_BASE || base;

  document.documentElement.classList.add('mc-my-boards-page');
  if (document.body) document.body.classList.add('mc-my-boards-page');

  function hasStylesheet(substr) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].href && links[i].href.indexOf(substr) !== -1) return true;
    }
    return false;
  }

  function addStylesheet(href) {
    if (hasStylesheet(href.split('?')[0])) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function addGoogleFonts() {
    if (hasStylesheet('fonts.googleapis.com')) return;
    var gf = document.createElement('link');
    gf.rel = 'stylesheet';
    gf.href =
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap';
    document.head.appendChild(gf);
  }

  function loadScript(src, onload, onerror) {
    if (document.querySelector('script[src="' + src + '"]')) {
      if (onload) onload();
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () {
      if (onload) onload();
    };
    s.onerror = function () {
      if (onerror) onerror();
    };
    (document.body || document.documentElement).appendChild(s);
  }

  function loadScriptWithFallback(primary, fallback, onload) {
    loadScript(primary, onload, function () {
      if (fallback && fallback !== primary) {
        loadScript(fallback, onload);
      }
    });
  }

  addGoogleFonts();
  addStylesheet(base + 'my-boards-critical.css?v=' + VER);
  addStylesheet(base + 'my-boards-page.css?v=' + VER);

  var stylesPrimary = base + 'board-styles.js?v=' + VER;
  var stylesFallback = stylesPrimary.replace('/v/vspfiles/', '/vspfiles/');
  var pagePrimary = base + 'my-boards-page.js?v=' + VER;
  var pageFallback = pagePrimary.replace('/v/vspfiles/', '/vspfiles/');

  function loadPage() {
    if (window.__MC_BOARDS_PAGE_LOADED) return;
    window.__MC_BOARDS_PAGE_LOADED = true;
    loadScriptWithFallback(pagePrimary, pageFallback);
  }

  if (window.MC_BOARD_STYLES) {
    loadPage();
    return;
  }

  if (document.querySelector('script[src*="board-styles.js"]')) {
    var waited = 0;
    var timer = setInterval(function () {
      waited += 50;
      if (window.MC_BOARD_STYLES || waited > 8000) {
        clearInterval(timer);
        loadPage();
      }
    }, 50);
    return;
  }

  loadScriptWithFallback(stylesPrimary, stylesFallback, loadPage);
})();
