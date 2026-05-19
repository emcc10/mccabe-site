/**
 * PLP fixes — DOM-driven, scoped to inspected Volusion markup.
 * MC_PLP_ENFORCER_20260609
 *
 * DOM (category listing):
 *   table.colors_backgroundlight + SearchResults_SubCat_Angle  ← black bar (legacy subcat chrome)
 *   #content_area > table > tr > td.colors_lines_light           ← breadcrumb divider
 *   .v-product-grid > .v-product > a.v-product__img > img      ← thumb (flat, no inner wrapper)
 */
(function (global) {
  "use strict";

  var VERSION = "20260609";
  var PLP_MAT = "#ffffff";
  if (global.__MC_PLP_ENFORCER_VER__ === VERSION) return;
  global.__MC_PLP_ENFORCER_VER__ = VERSION;
  global.__MC_PLP_ENFORCER__ = true;

  (function injectPlpBodyLastCss() {
    function attach() {
      if (document.getElementById("mc-plp-body-last-css")) return;
      var l = document.createElement("link");
      l.id = "mc-plp-body-last-css";
      l.rel = "stylesheet";
      l.href = "/v/vspfiles/css/mc-plp-body-last.css?v=20260609";
      (document.body || document.documentElement).appendChild(l);
    }
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
  })();

  var MAT = PLP_MAT;
  var TILE = 280;
  var STAGE = 220;
  var TILE_M = 220;
  var STAGE_M = 172;
  var PAD = 14;
  var PAD_M = 12;
  var REF_STORAGE_KEY = "MC_PLP_JUNO_APT_REF";
  var JUNO_APT_PHOTO = "77494-91-1.jpg";
  var JUNO_APT_BOUNDS = {
    visibleW: 757,
    visibleH: 335,
    maxY: 357,
    nh: 410,
    nw: 800,
  };
  var BOUNDS_JSON = "/v/vspfiles/js/mc-plp-sofa-bounds.json";
  var SCALE_MIN = 0.45;
  var SCALE_MAX = 2.2;
  var BOUNDS_SAMPLE = 320;

  var THUMB_SEL = "#content_area .v-product-grid a.v-product__img";
  var normalizeScheduled = false;
  var normalizeGen = 0;
  var boundsMap = null;
  var boundsMapLoading = false;
  var boundsMapWaiters = [];

  function isCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      return (/-s\//.test(p) || /category-s\//.test(p)) && /\.html?/i.test(p);
    } catch (e) {}
    return false;
  }

  function isHome() {
    if (isCategoryPlp()) return false;
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
    } catch (e2) {}
    return false;
  }

  function markCategory() {
    if (!isCategoryPlp()) return;
    document.documentElement.classList.add("category");
    document.documentElement.setAttribute("data-mc-category-plp", "1");
    if (document.body) {
      document.body.classList.add("category");
      document.body.classList.remove("is-home");
    }
    document.documentElement.classList.remove("mc-allow-home-hero");
  }

  function isLegacySubcatChromeTable(tbl) {
    if (!tbl) return false;
    if (tbl.querySelector('img[src*="SearchResults_SubCat_Angle"]')) return true;
    if (
      String(tbl.getAttribute("width") || "") === "215" &&
      tbl.querySelector("td.colors_lines_light")
    ) {
      return true;
    }
    if (
      tbl.querySelector('img[src*="clear1x1.gif"][width="15"][height="15"]') &&
      tbl.querySelector("td.colors_lines_light")
    ) {
      return true;
    }
    return false;
  }

  function looksLikeProductTable(tbl) {
    if (!tbl || !tbl.querySelector) return false;
    if (
      tbl.querySelector(
        'a[href*="-p/"], a[href*="product-p/"], a.productnamecolor, .v-product, .productnamecolor, .v-product-grid'
      )
    ) {
      return true;
    }
    var imgs = tbl.querySelectorAll("img");
    var i;
    for (i = 0; i < imgs.length; i++) {
      var src = (imgs[i].getAttribute("src") || "").toLowerCase();
      if (!src) continue;
      if (src.indexOf("clear1x1") !== -1) continue;
      if (src.indexOf("searchresults_subcat_angle") !== -1) continue;
      if (src.indexOf("divider_horizontal") !== -1) continue;
      return true;
    }
    return false;
  }

  function removeLegacyCategoryBars() {
    document.querySelectorAll("table.colors_backgroundlight").forEach(function (tbl) {
      if (isLegacySubcatChromeTable(tbl)) {
        tbl.parentNode.removeChild(tbl);
        return;
      }

      if (looksLikeProductTable(tbl)) return;
      Array.prototype.forEach.call(tbl.rows, function (tr) {
        var td = tr.querySelector("td.colors_lines_light");
        if (!td) return;
        var img = td.querySelector('img[src*="clear1x1"]');
        if (!img) return;
        tr.parentNode.removeChild(tr);
      });
    });

    var scope = document.getElementById("content_area");
    if (!scope) return;
    var child;
    for (child = scope.firstElementChild; child; child = child.nextElementSibling) {
      if (child.tagName !== "TABLE") continue;
      Array.prototype.forEach.call(child.rows, function (tr) {
        if (tr.cells.length !== 1) return;
        var td = tr.cells[0];
        if (!td.classList.contains("colors_lines_light")) return;
        var img = td.querySelector('img[src*="clear1x1"]');
        if (!img) return;
        tr.parentNode.removeChild(tr);
      });
    }
  }

  function productText(wrap) {
    var parts = [wrap.getAttribute("href") || ""];
    var img = wrap.querySelector("img");
    if (img) {
      parts.push(img.getAttribute("alt") || "", img.getAttribute("title") || "", img.getAttribute("src") || "");
    }
    var parent = wrap.parentElement;
    if (parent) {
      parent.querySelectorAll("a.v-product__title, a.productnamecolor, .productnamecolor").forEach(function (a) {
        parts.push(a.textContent || "");
      });
    }
    return parts.join(" ").toLowerCase().replace(/\s+/g, " ");
  }

  function photoFilename(src) {
    var m = String(src || "").match(/\/photos\/([^?#]+)/i);
    return m ? m[1].toLowerCase() : "";
  }

  function sameOriginPhotoUrl(filename) {
    return "/v/vspfiles/photos/" + filename;
  }

  function withBoundsMap(cb) {
    if (boundsMap) {
      cb(boundsMap);
      return;
    }
    boundsMapWaiters.push(cb);
    if (boundsMapLoading) return;
    boundsMapLoading = true;
    fetch(BOUNDS_JSON + "?v=" + VERSION, { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (map) {
        boundsMap = map || {};
        boundsMapLoading = false;
        var waiters = boundsMapWaiters.slice();
        boundsMapWaiters.length = 0;
        waiters.forEach(function (fn) {
          fn(boundsMap);
        });
      });
  }

  function isJunoApartmentRef(wrap) {
    var text = productText(wrap);
    return /juno\s+apartment/.test(text) || photoFilename(wrap.querySelector("img") && wrap.querySelector("img").src) === JUNO_APT_PHOTO;
  }

  function isBackgroundPixel(r, g, b, a) {
    if (a < 20) return true;
    if (r > 235 && g > 235 && b > 235) return true;
    var hi = Math.max(r, g, b);
    var lo = Math.min(r, g, b);
    if (hi - lo < 18 && hi > 192) return true;
    return false;
  }

  function measureProbe(probe, cb) {
    try {
      var nw = probe.naturalWidth;
      var nh = probe.naturalHeight;
      if (!nw || !nh) {
        cb(null);
        return;
      }
      var maxSide = BOUNDS_SAMPLE;
      var w = nw >= nh ? maxSide : Math.round((maxSide * nw) / nh);
      var h = nh >= nw ? maxSide : Math.round((maxSide * nh) / nw);
      if (w < 1) w = 1;
      if (h < 1) h = 1;

      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(probe, 0, 0, w, h);
      var data = ctx.getImageData(0, 0, w, h).data;

      var minX = w;
      var minY = h;
      var maxX = 0;
      var maxY = 0;
      var found = false;
      var x;
      var y;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          if (isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (!found) {
        cb(null);
        return;
      }

      var sx = nw / w;
      var sy = nh / h;
      cb({
        visibleW: (maxX - minX + 1) * sx,
        visibleH: (maxY - minY + 1) * sy,
        minX: minX * sx,
        minY: minY * sy,
        maxX: (maxX + 1) * sx,
        maxY: (maxY + 1) * sy,
        nw: nw,
        nh: nh,
      });
    } catch (err) {
      cb(null);
    }
  }

  function detectSofaBounds(img, cb) {
    var file = photoFilename(img.currentSrc || img.src);
    withBoundsMap(function (map) {
      if (file && map[file]) {
        cb(map[file]);
        return;
      }
      if (!file) {
        cb(null);
        return;
      }
      var probe = new Image();
      probe.onload = function () {
        measureProbe(probe, cb);
      };
      probe.onerror = function () {
        cb(null);
      };
      probe.src = sameOriginPhotoUrl(file) + "?mc-b=" + Date.now();
    });
  }

  function fitScale(nw, nh, boxW, boxH) {
    return Math.min(boxW / nw, boxH / nh);
  }

  function displayedVisibleWidth(bounds, boxW, boxH) {
    return bounds.visibleW * fitScale(bounds.nw, bounds.nh, boxW, boxH);
  }

  function contentHeight(nw, nh, boxW, stage) {
    return nh * fitScale(nw, nh, boxW, stage);
  }

  function footOffsetPx(bounds, boxW, stage, scale) {
    return ((bounds.nh - bounds.maxY) / bounds.nh) * contentHeight(bounds.nw, bounds.nh, boxW, stage) * scale;
  }

  function saveReference(ref) {
    try {
      global.sessionStorage.setItem(REF_STORAGE_KEY, JSON.stringify(ref));
    } catch (e) {}
  }

  function loadReference() {
    try {
      var raw = global.sessionStorage.getItem(REF_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e2) {
      return null;
    }
  }

  function applySofaTransform(img, scale, translateY) {
    scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));
    scale = Math.round(scale * 1000) / 1000;
    translateY = Math.round(translateY * 10) / 10;
    img.style.transformOrigin = "center bottom";
    if (Math.abs(scale - 1) < 0.005 && Math.abs(translateY) < 0.5) {
      img.style.removeProperty("transform");
      img.removeAttribute("data-scale");
      return;
    }
    img.setAttribute("data-scale", String(scale));
    img.style.setProperty(
      "transform",
      "translateY(" + translateY + "px) scale(" + scale + ")",
      "important"
    );
  }

  function normalizeSofaSizes() {
    if (!isCategoryPlp()) return;
    withBoundsMap(function (map) {
      var gen = ++normalizeGen;
      var mobile = global.innerWidth <= 991;
      var stage = mobile ? STAGE_M : STAGE;
      var pad = mobile ? PAD_M : PAD;
      var wraps = Array.prototype.slice.call(document.querySelectorAll(THUMB_SEL));
      if (!wraps.length) return;

      var pending = wraps.length;
      var entries = [];
      var junoEntry = null;

      function doneOne() {
        pending--;
        if (pending > 0) return;
        if (gen !== normalizeGen) return;

        var ref = junoEntry ? junoEntry.bounds : null;
        var refBoxW = junoEntry ? junoEntry.boxW : 0;
        if (ref && junoEntry) {
          saveReference({
            visibleW: ref.visibleW,
            visibleH: ref.visibleH,
            maxY: ref.maxY,
            nh: ref.nh,
            nw: ref.nw,
            boxW: refBoxW,
            stage: stage,
          });
        } else if (map[JUNO_APT_PHOTO]) {
          ref = map[JUNO_APT_PHOTO];
        } else {
          var cached = loadReference();
          if (cached && cached.visibleW > 0) {
            ref = cached;
            refBoxW = cached.boxW || refBoxW;
          } else {
            ref = JUNO_APT_BOUNDS;
          }
        }

        if (!ref || !ref.visibleW || !entries.length) return;

        var fallbackBoxW = refBoxW || entries[0].boxW;
        var refVisW = displayedVisibleWidth(ref, fallbackBoxW, stage);
        var refFoot = footOffsetPx(ref, fallbackBoxW, stage, 1);

        entries.forEach(function (entry) {
          if (!entry.bounds || gen !== normalizeGen) return;
          var visW = displayedVisibleWidth(entry.bounds, entry.boxW, stage);
          if (!visW) return;
          var scale = refVisW / visW;
          var foot = footOffsetPx(entry.bounds, entry.boxW, stage, scale);
          applySofaTransform(entry.img, scale, refFoot - foot);
          entry.img.setAttribute("data-mc-scale-done", "1");
        });
      }

      wraps.forEach(function (wrap) {
        var img = wrap.querySelector(":scope > img") || wrap.querySelector("img");
        if (!img) {
          doneOne();
          return;
        }
        img.removeAttribute("data-mc-scale-done");
        var boxW = Math.max(40, wrap.clientWidth - pad * 2);
        detectSofaBounds(img, function (bounds) {
          if (gen !== normalizeGen) return;
          var entry = { wrap: wrap, img: img, bounds: bounds, boxW: boxW };
          entries.push(entry);
          if (bounds && isJunoApartmentRef(wrap)) junoEntry = entry;
          doneOne();
        });
      });
    });
  }

  function scheduleNormalize() {
    if (normalizeScheduled) return;
    normalizeScheduled = true;
    global.requestAnimationFrame(function () {
      global.requestAnimationFrame(function () {
        normalizeScheduled = false;
        normalizeSofaSizes();
      });
    });
  }

  function fixThumb(wrap) {
    if (!wrap || !wrap.classList || !wrap.classList.contains("v-product__img")) return;
    if (!wrap.closest(".v-product-grid")) return;
    if (wrap.closest("#v65-product-related")) return;

    var mobile = global.innerWidth <= 991;
    var tile = mobile ? TILE_M : TILE;
    var stage = mobile ? STAGE_M : STAGE;
    var pad = mobile ? PAD_M : PAD;
    var initialized = wrap.getAttribute("data-mc-plp-thumb") === "1";

    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("align-items", "flex-end", "important");
    wrap.style.setProperty("justify-content", "center", "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("height", tile + "px", "important");
    wrap.style.setProperty("min-height", tile + "px", "important");
    wrap.style.setProperty("max-height", tile + "px", "important");
    wrap.style.setProperty("padding", pad + "px", "important");
    wrap.style.setProperty("overflow", "hidden", "important");
    wrap.style.setProperty("box-sizing", "border-box", "important");
    wrap.style.setProperty("background", MAT, "important");
    wrap.style.setProperty("background-color", MAT, "important");
    wrap.style.setProperty("border", "0", "important");
    wrap.style.setProperty("box-shadow", "none", "important");
    wrap.style.setProperty("line-height", "0", "important");

    var img = wrap.querySelector(":scope > img") || wrap.querySelector("img");
    if (!img) return;

    if (!initialized) {
      try {
        img.removeAttribute("style");
        img.removeAttribute("border");
      } catch (eAttr) {}
      wrap.setAttribute("data-mc-plp-thumb", "1");
    }

    img.style.setProperty("background", PLP_MAT, "important");
    img.style.setProperty("background-color", PLP_MAT, "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("max-width", "100%", "important");
    img.style.setProperty("height", stage + "px", "important");
    img.style.setProperty("max-height", stage + "px", "important");
    img.style.setProperty("min-height", "0", "important");
    img.style.setProperty("min-width", "0", "important");
    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center bottom", "important");
    img.style.setProperty("margin", "0 auto", "important");
    img.style.setProperty("padding", "0", "important");
    img.style.setProperty("flex", "0 0 auto", "important");
    img.style.setProperty("border", "0", "important");
    img.style.setProperty("box-shadow", "none", "important");
    img.style.transformOrigin = "center bottom";
  }

  function applyThumbs() {
    if (!isCategoryPlp()) return;
    document.querySelectorAll(THUMB_SEL).forEach(fixThumb);
    scheduleNormalize();
  }

  function hideHero() {
    if (isHome()) return;
    document.documentElement.classList.remove("mc-allow-home-hero");
    if (document.body) document.body.classList.remove("is-home");
    document
      .querySelectorAll(
        "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video,.mc-hero-video,video.mc-hero-video-el"
      )
      .forEach(function (n) {
        n.style.setProperty("display", "none", "important");
        n.style.setProperty("height", "0", "important");
        n.style.setProperty("min-height", "0", "important");
        n.style.setProperty("opacity", "0", "important");
        n.style.setProperty("overflow", "hidden", "important");
      });
  }

  function run() {
    if (!isCategoryPlp()) return;
    markCategory();
    removeLegacyCategoryBars();
    applyThumbs();
    hideHero();
    if (!global.__MC_PLP_NORM_RETRIES__) {
      global.__MC_PLP_NORM_RETRIES__ = 1;
      [200, 800, 2500].forEach(function (ms) {
        global.setTimeout(applyThumbs, ms);
      });
    }
  }

  if (isCategoryPlp()) {
    markCategory();
    run();
    document.addEventListener("DOMContentLoaded", run);
    global.addEventListener("load", run);
    global.addEventListener("resize", applyThumbs);
  }

  if (typeof MutationObserver !== "undefined" && isCategoryPlp()) {
    var scheduled = false;
    var mo = new MutationObserver(function (mutations) {
      var needsBar = false;
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList") {
          needsBar = true;
          break;
        }
      }
      if (!needsBar) return;
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        removeLegacyCategoryBars();
      });
    });
    var root = document.getElementById("content_area") || document.body;
    if (root) {
      mo.observe(root, { childList: true, subtree: true });
    }
  }

  global.mcPlpEnforcerRun = run;
})(window);
