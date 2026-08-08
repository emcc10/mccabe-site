/* MC_BB_LEATHER_SWATCH_FIX_20260807 — force faux-leather cover thumbs.
   Survives stale CF form.js?mcrd= that mapped Black to faux-fur. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_BB_LEATHER_SWATCH_FIX_20260807__) return;
  g.__MC_BB_LEATHER_SWATCH_FIX_20260807__ = true;

  var MAP = {
    black: "/v/vspfiles/photos/bb-fauxLeather-black.jpg",
    ivory: "/v/vspfiles/swatches/corduroy/fauxLeather-ivory.jpg",
    cognac: "/v/vspfiles/swatches/corduroy/fauxLeather-cognac.jpg",
    coffee: "/v/vspfiles/swatches/corduroy/fauxLeather-coffee.jpg"
  };

  function isFauxLeatherPdp() {
    try {
      var code = String(
        g.global_Current_ProductCode ||
          ((d.querySelector('input[name="ProductCode"],input[name="productcode"]') || {}).value) ||
          ""
      );
      var path = String((g.location && g.location.pathname) || "");
      return /FAUX-?LEATHER/i.test(code) || /BB-FAUX(?!-FUR)/i.test(code) || /bb-faux-leather/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function fix() {
    if (!isFauxLeatherPdp()) return;
    var wrap = d.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.querySelectorAll("img.beanbag-swatch").forEach(function (img) {
      var label = String(img.getAttribute("data-option") || img.getAttribute("alt") || "");
      if (!/faux\s*leather/i.test(label)) return;
      var color = label
        .split("/")
        .pop()
        .replace(/faux\s*leather/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      var want = MAP[color];
      if (!want) return;
      var cur = String(img.getAttribute("src") || img.src || "");
      if (/faux-?fur/i.test(cur) || cur.indexOf(want.split("?")[0]) === -1) {
        try {
          img.removeAttribute("srcset");
          img.setAttribute("src", want + "?v=20260807bbcol5");
          img.src = want + "?v=20260807bbcol5";
        } catch (eSet) {}
      }
    });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", fix);
  else fix();
  [0, 200, 600, 1200, 2500, 5000, 9000].forEach(function (ms) {
    g.setTimeout(fix, ms);
  });
})(window, document);
