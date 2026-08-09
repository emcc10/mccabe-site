/* MC_BB_CHINCHILLA_PHOTO_FIX_20260809 — restore grey Chinchilla Nest photos.
   Origin slots were corrected; CDN/CF still served cream/tan misfiles on
   BB-CHINCHILLA-2T (?v-cache=1786131640) and alts (?v=20260729altfix3). */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_BB_CHINCHILLA_PHOTO_FIX_20260809__) return;
  g.__MC_BB_CHINCHILLA_PHOTO_FIX_20260809__ = true;

  var VER = "20260809chin1";
  var HERO = "/v/vspfiles/photos/BB-CHINCHILLA-1.jpg?v=" + VER;
  var ALT1 = "/v/vspfiles/photos/BB-CHINCHILLA-1.jpg?v=" + VER;
  var ALT2 = "/v/vspfiles/photos/BB-CHINCHILLA-2.jpg?v=" + VER;

  function isChinchillaNestPdp() {
    try {
      var code = String(
        g.global_Current_ProductCode ||
          ((d.querySelector('input[name="ProductCode"],input[name="productcode"]') || {}).value) ||
          ""
      );
      var path = String((g.location && g.location.pathname) || "");
      return /BB-CHINCHILLA/i.test(code) || /bb-chinchilla\.htm/i.test(path);
    } catch (e) {
      return false;
    }
  }

  function setSrc(el, url) {
    if (!el || !url) return;
    try {
      if (el.removeAttribute) el.removeAttribute("srcset");
      if (el.setAttribute) el.setAttribute("src", url);
      if ("src" in el) el.src = url;
    } catch (eSet) {}
  }

  function setHref(el, url) {
    if (!el || !url) return;
    try {
      if (el.setAttribute) el.setAttribute("href", url);
      if ("href" in el) el.href = url;
    } catch (eHref) {}
  }

  function wantsChinPhoto(url) {
    return /BB-CHINCHILLA|bb-chinchilla|xl-chinchilla|XL-CHINCHILLA/i.test(String(url || ""));
  }

  function fix() {
    if (!isChinchillaNestPdp()) return;

    var hero = d.getElementById("product_photo");
    if (hero) setSrc(hero, HERO);

    d.querySelectorAll("#product_photo_zoom_url, #product_photo_zoom_url2").forEach(function (a) {
      setHref(a, HERO);
    });

    d.querySelectorAll(
      "#mc-pdp-alt-view-row a, #mc-pdp-alt-view-row-host a, .mc-pdp-alt-view-row a, #altviews a"
    ).forEach(function (a) {
      var href = String(a.getAttribute("href") || a.href || "");
      if (!wantsChinPhoto(href) && !a.querySelector("img")) return;
      var img = a.querySelector("img");
      var src = img ? String(img.getAttribute("src") || img.src || "") : href;
      if (/[-_]2(?:T)?\.(?:jpg|jpeg|png|webp)/i.test(src) || /[-_]2(?:T)?\.(?:jpg|jpeg|png|webp)/i.test(href)) {
        setHref(a, ALT2);
        if (img) setSrc(img, ALT2);
      } else {
        setHref(a, ALT1);
        if (img) setSrc(img, ALT1);
      }
    });

    d.querySelectorAll(
      'img[src*="CHINCHILLA"], img[src*="chinchilla"], a[href*="CHINCHILLA"] img, a[href*="chinchilla"] img'
    ).forEach(function (img) {
      if (img.id === "product_photo") return;
      var src = String(img.getAttribute("src") || img.src || "");
      if (!wantsChinPhoto(src)) return;
      if (/[-_]2(?:T)?\.(?:jpg|jpeg|png|webp)/i.test(src)) setSrc(img, ALT2);
      else setSrc(img, ALT1);
    });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", fix);
  else fix();
  [0, 150, 400, 900, 1600, 3000, 6000].forEach(function (ms) {
    g.setTimeout(fix, ms);
  });
})(window, document);
