/**
 * MC_BB_FAUXLEATHER_SWATCH_FIX_20260810
 * Faux Leather Bean Bag PDP only (BB-FAUX-LEATHER / bb-faux-leather).
 *
 * Root cause this undoes:
 * 1) Stale fat mc-pdp-auth-cta-form.js?mcrd= overwrites __MC_BB_COVER_ASSET__ with a
 *    faux-fur-default mapper, so "Faux Leather / Black" resolves to FC-FUR-BK and
 *    other leather colors return null (inline script then hits 404 /images/bb-fauxLeather-*).
 * 2) Older leather thumb "fixes" force Black onto photos/bb-fauxLeather-black.jpg
 *    (full product shot) instead of the corduroy color-swatch tile.
 *
 * Delete this file and its loader/comment blocks to undo.
 */
(function (global) {
  "use strict";

  if (global.__MC_BB_FAUXLEATHER_SWATCH_FIX_20260810__) return;
  global.__MC_BB_FAUXLEATHER_SWATCH_FIX_20260810__ = true;

  var d = global.document;
  var STAMP = "v=20260810fl1";

  var LEATHER = {
    black: {
      hero: "https://cordaroys.com/cdn/shop/files/FC-CW-BK.jpg",
      thumb: "/v/vspfiles/swatches/corduroy/fauxLeather-black.jpg"
    },
    coffee: {
      hero: "https://cordaroys.com/cdn/shop/files/FC-CW-CF.jpg",
      thumb: "/v/vspfiles/swatches/corduroy/fauxLeather-coffee.jpg"
    },
    cognac: {
      hero: "https://cordaroys.com/cdn/shop/files/FC-CW-CG.jpg",
      thumb: "/v/vspfiles/swatches/corduroy/fauxLeather-cognac.jpg"
    },
    ivory: {
      hero: "https://cordaroys.com/cdn/shop/files/FC-CW-IV.jpg",
      thumb: "/v/vspfiles/swatches/corduroy/fauxLeather-ivory.jpg"
    }
  };

  var OPT_HERO = {
    "819": LEATHER.black.hero,
    "815": LEATHER.coffee.hero,
    "813": LEATHER.cognac.hero,
    "817": LEATHER.ivory.hero
  };

  function isFauxLeatherPdp() {
    try {
      var code = String(
        global.global_Current_ProductCode ||
          ((d.querySelector('input[name="ProductCode"],input[name="productcode"]') || {}).value) ||
          ""
      );
      var path = String((global.location && global.location.pathname) || "");
      return (
        /FAUX-?LEATHER/i.test(code) ||
        /bb-faux-leather/i.test(path) ||
        (/BB-FAUX/i.test(code) && !/FAUX-?FUR/i.test(code))
      );
    } catch (e) {
      return false;
    }
  }

  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function colorFromLabel(label) {
    var n = normalize(label);
    if (!n) return "";
    var part = n.split("/").pop() || n;
    return part
      .replace(/^faux\s*leather\s+/i, "")
      .replace(/^faux\s*fur\s+/i, "")
      .replace(/^chenille\s+/i, "")
      .trim();
  }

  function leatherAsset(label) {
    var color = colorFromLabel(label);
    return LEATHER[color] || null;
  }

  function stampUrl(url) {
    if (!url) return url;
    return url.indexOf("?") >= 0 ? url : url + "?" + STAMP;
  }

  function installCoverAsset() {
    if (!isFauxLeatherPdp()) return;
    global.__MC_BB_COVER_ASSET__ = function bbCoverAssetLeatherFix20260810(label) {
      var n = normalize(label);
      if (/faux\s*leather/i.test(n) || isFauxLeatherPdp()) {
        var hit = leatherAsset(label);
        if (hit) return { hero: hit.hero, thumb: hit.thumb };
      }
      /* Non-leather labels on this PDP should not fall through to fur-default maps. */
      return null;
    };
    global.__MC_BB_REPAIR_SWATCH_THUMBS__ = repairThumbs;
  }

  function repairThumbs() {
    if (!isFauxLeatherPdp()) return;
    var wrap = d.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.querySelectorAll("img.beanbag-swatch").forEach(function (img) {
      var label = String(img.getAttribute("data-option") || img.getAttribute("alt") || "");
      if (!/faux\s*leather/i.test(label)) return;
      var asset = leatherAsset(label);
      if (!asset || !asset.thumb) return;
      var cur = String(img.getAttribute("src") || img.src || "");
      var wantBase = asset.thumb.split("?")[0];
      var bad =
        /faux-?fur/i.test(cur) ||
        /photos\/bb-fauxLeather/i.test(cur) ||
        /FC-CW-/i.test(cur) ||
        cur.indexOf(wantBase) === -1;
      if (!bad) return;
      try {
        img.removeAttribute("srcset");
        img.setAttribute("src", stampUrl(asset.thumb));
        img.src = stampUrl(asset.thumb);
      } catch (eSet) {}
    });
  }

  var activeHeroUrl = "";
  var activeHeroToken = 0;

  function heroLooksWrong(cur, wantBase) {
    var s = String(cur || "");
    if (/faux-?fur|FC-FUR/i.test(s)) return true;
    if (/\/images\/bb-fauxLeather/i.test(s)) return true;
    if (wantBase && s.indexOf(wantBase) === -1) return true;
    return false;
  }

  function applyHero(url) {
    if (!url) return;
    var mainImg = d.getElementById("product_photo");
    if (!mainImg) return;
    var wantBase = String(url).split("?")[0];
    var target = stampUrl(url);
    activeHeroUrl = wantBase;
    activeHeroToken += 1;
    var token = activeHeroToken;
    try {
      mainImg.removeAttribute("srcset");
      mainImg.setAttribute("src", target);
      mainImg.src = target;
      mainImg.style.setProperty("opacity", "1", "important");
    } catch (eMain) {}
    ["product_photo_zoom_url", "product_photo_zoom_url2"].forEach(function (id) {
      var lnk = d.getElementById(id);
      if (lnk) {
        try {
          lnk.href = url;
        } catch (eZm) {}
      }
    });
    try {
      if (global.vZoom && typeof global.vZoom.add === "function") {
        global.vZoom.add(mainImg, url);
      }
    } catch (eVz) {}
    /* Stale fat form.js change-handlers keep re-applying FC-FUR-BK for Black.
       Re-lock longer than their timed retries. */
    [30, 80, 160, 320, 600, 1000, 1600, 2500, 4000, 6500, 9000].forEach(function (ms) {
      global.setTimeout(function () {
        if (!isFauxLeatherPdp()) return;
        if (token !== activeHeroToken) return;
        var img = d.getElementById("product_photo");
        if (!img) return;
        var cur = String(img.getAttribute("src") || img.src || "");
        if (!heroLooksWrong(cur, wantBase)) return;
        try {
          img.removeAttribute("srcset");
          img.setAttribute("src", target);
          img.src = target;
        } catch (eLock) {}
      }, ms);
    });
  }

  function selectCoverOption(label) {
    var coverSel =
      d.querySelector('#options_table select[name*="___4"]') ||
      d.querySelector('select[name*="___4"]');
    if (!coverSel || !coverSel.options) return { coverSel: null, optVal: "", hero: null };
    var target = normalize(label);
    var targetColor = colorFromLabel(label);
    var found = -1;
    var i;
    for (i = 0; i < coverSel.options.length; i++) {
      var optText = normalize(coverSel.options[i].text);
      var optColor = colorFromLabel(coverSel.options[i].text);
      if (optText === target || optColor === targetColor) {
        found = i;
        break;
      }
    }
    if (found < 0) return { coverSel: coverSel, optVal: "", hero: leatherAsset(label) && leatherAsset(label).hero };
    coverSel.selectedIndex = found;
    coverSel.value = coverSel.options[found].value;
    var optVal = String(coverSel.options[found].value || "");
    var hero = OPT_HERO[optVal] || (leatherAsset(label) && leatherAsset(label).hero);
    return { coverSel: coverSel, optVal: optVal, hero: hero };
  }

  function onSwatchClick(e) {
    if (!isFauxLeatherPdp()) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var swatch = t.closest(".beanbag-swatch");
    if (!swatch) return;
    var label =
      swatch.getAttribute("data-option") ||
      swatch.getAttribute("aria-label") ||
      swatch.getAttribute("alt") ||
      swatch.getAttribute("title") ||
      "";
    if (!/faux\s*leather/i.test(label)) return;

    var selected = selectCoverOption(label);
    if (!selected.hero) return;

    try {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    } catch (eStop) {}

    /* Apply hero FIRST so stale fur mappers lose the first paint. */
    applyHero(selected.hero);
    repairThumbs();

    if (selected.coverSel && selected.optVal) {
      if (typeof global.change_option === "function") {
        try {
          global.change_option(selected.coverSel.name, selected.optVal);
        } catch (eCo) {}
      }
      if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
        try {
          global.AutoUpdatePriceWithSelectedOptions(selected.optVal, 4);
        } catch (eAu) {}
      }
      try {
        selected.coverSel.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (eIn) {}
      try {
        selected.coverSel.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (eCh) {}
      /* Re-assert after option/price scripts finish their fur rewrite. */
      applyHero(selected.hero);
    }

    var labelSpan = d.getElementById("beanbag-selected-cover-name");
    if (labelSpan) {
      try {
        labelSpan.textContent = label;
      } catch (eLbl) {}
    }
    d.querySelectorAll(".beanbag-swatch").forEach(function (node) {
      try {
        node.classList.remove("active");
      } catch (eRm) {}
    });
    try {
      swatch.classList.add("active");
    } catch (eAct) {}
  }

  function onCoverChange(e) {
    if (!isFauxLeatherPdp()) return;
    var sel = e.target;
    if (!sel || !sel.matches || !sel.matches("select")) return;
    if (!sel.matches('#options_table select[name*="___4"], select[name*="___4"]')) return;
    var optVal = String(sel.value || "");
    var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
    var hero = OPT_HERO[optVal] || (opt && leatherAsset(opt.text) && leatherAsset(opt.text).hero);
    if (!hero) return;
    try {
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      e.stopPropagation();
    } catch (eStopCh) {}
    applyHero(hero);
    repairThumbs();
  }

  function stripFatFormOverwrite() {
    if (!isFauxLeatherPdp()) return;
    try {
      d.documentElement.setAttribute("data-mc-pdp-auth-head-boot", "1");
    } catch (eBoot) {}
    try {
      d.querySelectorAll('script[src*="mc-pdp-auth-cta-form.js"]').forEach(function (el) {
        var src = String(el.getAttribute("src") || "");
        /* Keep versioned stubs (chin1 / bbcol4). Remove bare form.js?mcrd= fat hits. */
        if (/mc-pdp-auth-cta-form-\d/i.test(src)) return;
        if (/mc-pdp-auth-cta-form\.js/i.test(src)) {
          try {
            el.remove();
          } catch (eRm) {}
        }
      });
    } catch (eStrip) {}
    installCoverAsset();
    repairThumbs();
  }

  function boot() {
    if (!isFauxLeatherPdp()) return;
    stripFatFormOverwrite();
    if (!global.__MC_BB_FAUXLEATHER_CLICK_BOUND_20260810__) {
      global.__MC_BB_FAUXLEATHER_CLICK_BOUND_20260810__ = true;
      d.addEventListener("click", onSwatchClick, true);
      d.addEventListener("change", onCoverChange, true);
    }
    [0, 100, 300, 800, 1600, 3200, 6000, 10000].forEach(function (ms) {
      global.setTimeout(function () {
        stripFatFormOverwrite();
        repairThumbs();
        if (activeHeroUrl) applyHero(activeHeroUrl);
      }, ms);
    });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
