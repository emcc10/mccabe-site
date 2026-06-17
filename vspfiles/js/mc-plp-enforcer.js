/**
 * PLP fixes — DOM-driven, scoped to inspected Volusion markup.
 * MC_PLP_ENFORCER_20260628d — site-wide strip .00 from prices (full content sweep); PLP thumbnails
 *
 * Thumbnails: .mc-plp-image-box; image element sized to the wrapper, object-fit: contain (no crop).
 */
(function (global) {
  "use strict";

  var VERSION = "20260628d";

  function plpVerNum(v) {
    var n = parseInt(String(v || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  var PLP_MAT = "#ffffff";
  if (plpVerNum(global.__MC_PLP_ENFORCER_VER__) >= plpVerNum(VERSION)) return;
  global.__MC_PLP_ENFORCER_VER__ = VERSION;
  global.__MC_PLP_ENFORCER__ = true;

  function injectCriticalThumbCss() {
    if (document.getElementById("mc-plp-critical-css")) return;
    var s = document.createElement("style");
    s.id = "mc-plp-critical-css";
    s.textContent =
      "html.category #content_area .v-product-grid a.v-product__img.mc-plp-image-box," +
      "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img.mc-plp-image-box{" +
      "display:flex!important;align-items:center!important;justify-content:center!important;" +
      "width:100%!important;height:260px!important;overflow:visible!important;background:#fff!important;padding:0!important}" +
      "html.category #content_area .v-product-grid a.v-product__img.mc-plp-image-box>img," +
      "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img.mc-plp-image-box>img{" +
      "width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;" +
      "object-fit:contain!important;object-position:center center!important;transform:none!important;" +
      "border:none!important;box-shadow:none!important;background:transparent!important}";
    (document.head || document.documentElement).appendChild(s);
  }

  (function injectPlpBodyLastCss() {
    function attach() {
      if (isCloseoutSalePlp()) return;
      injectCriticalThumbCss();
      if (document.getElementById("mc-plp-body-last-css")) return;
      var l = document.createElement("link");
      l.id = "mc-plp-body-last-css";
      l.rel = "stylesheet";
      l.href = "/v/vspfiles/css/mc-plp-body-last.css?v=" + VERSION;
      (document.body || document.documentElement).appendChild(l);
    }
    if (document.body) attach();
    else document.addEventListener("DOMContentLoaded", attach);
  })();

  var TARGET_VISIBLE_W = 300;
  var BOX_HEIGHT = 260;
  var NORMALIZED_W = 420;
  var NORMALIZED_H = 260;
  var BOUNDS_JSON = "/v/vspfiles/js/mc-plp-sofa-bounds.json";
  var BOUNDS_SAMPLE = 320;

  var boundsMap = null;
  var boundsMapLoading = false;
  var boundsMapWaiters = [];

  function isCloseoutSalePlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var s = String(global.location.search || "").toLowerCase();
      if (/\/category-s\/181\.htm/i.test(p)) return true;
      if (/searchresults\.asp/i.test(p) && /(?:^|[?&])cat=181(?:&|$)/.test(s)) return true;
    } catch (eCo) {}
    return false;
  }

  function isCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var body = global.document.body;
      if (body && body.classList.contains("productdetails")) return false;
      if (/(?:-p\/|product-p\/)/.test(p)) return false;
      if (/(?:shoppingcart|one-page-checkout|checkout|orderconfirm)/i.test(p)) return false;
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return false;
      if (/\/index\.html?$/i.test(p)) return false;
      if ((/-s\//.test(p) || /category-s\//.test(p)) && /\.html?/i.test(p)) return true;
      if (/productslist\.asp|searchresults\.asp/.test(p)) return true;
      if (
        global.document.documentElement &&
        global.document.documentElement.classList.contains("vol-list")
      ) {
        return true;
      }
      var root = global.document.getElementById("content_area");
      if (
        root &&
        root.querySelector(
          ".v-product-grid a.v-product__img, .v-product-grid .v-product__img, ul.v-product-grid li.v-product"
        )
      ) {
        return true;
      }
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

  function isProductPhoto(img) {
    var src = String(img.currentSrc || img.src || "").toLowerCase();
    return /vspfiles\/photos\//.test(src) || /vspfiles\/product\//.test(src);
  }

  function isNoPhotoPlaceholder(src) {
    return /nophoto\.gif/i.test(String(src || ""));
  }

  function skuFromProductTitle(title) {
    var m = String(title || "").match(/,\s*([^,"]+)\s*$/);
    return m ? String(m[1]).trim() : "";
  }

  /** Travel mats use TMH-TRV-* on Volusion; repo photos may be TMH-MAT-* stems. */
  var TMH_TRV_PHOTO_ALIASES = {
    "TMH-TRV-AMETHYST-GEM-MAT": "TMH-MAT-AMETHYST-GEM-TRAVEL-MAT",
    "TMH-TRV-AMETHYST-TABLE-MAT": "TMH-MAT-AMETHYST-TABLE-TRAVEL-MAT",
    "TMH-TRV-BLUE-MAT": "TMH-MAT-BLUE-MAT",
    "TMH-TRV-ELEC-BLU-GARDEN": "TMH-MAT-ELEC-BLU-GARDEN",
    "TMH-TRV-ELEC-BLU-TRELLIS": "TMH-MAT-ELEC-BLU-TRELLIS",
    "TMH-TRV-EMERALD-GEM-MAT": "TMH-MAT-EMERALD-GEM-MAT",
    "TMH-TRV-EMERALD-TABLE-MAT": "TMH-MAT-EMERALD-TABLE-MAT",
    "TMH-TRV-LILAC-GARDEN-MAT": "TMH-MAT-LILAC-GARDEN-MAT",
    "TMH-TRV-LILAC-TRELLIS-MAT": "TMH-MAT-LILAC-TRELLIS-MAT",
    "TMH-TRV-PLUM-GARDEN-MAT": "TMH-MAT-PLUM-GARDEN-MAT",
    "TMH-TRV-PLUM-TRELLIS-MAT": "TMH-MAT-PLUM-TRELLIS-MAT",
    "TMH-TRV-PURP-RED-GRN": "TMH-MAT-DECO-OLIVE-AND-RED-MAT",
    "TMH-TRV-RUBY-GEM-MAT": "TMH-MAT-RUBY-GEM-MAT",
    "TMH-TRV-RUBY-TABLE-MAT": "TMH-MAT-RUBY-TABLE-MAT",
    "TMH-TRV-SAPPHIRE-GEM-MAT": "TMH-MAT-SAPPHIRE-GEM-MAT",
    "TMH-TRV-SAPPHIRE-TABLE-MAT": "TMH-MAT-SAPPHIRE-TABLE-MAT",
    "TMH-TRV-TEAL-GARDEN-MAT": "TMH-MAT-TEAL-GARDEN-MAT",
    "TMH-TRV-TEAL-TRELLIS-MAT": "TMH-MAT-TEAL-TRELLIS-MAT",
  };

  function resolveTmhMatPhotoCode(sku) {
    var code = String(sku || "").trim().toUpperCase();
    if (!code) return code;
    if (TMH_TRV_PHOTO_ALIASES[code]) return TMH_TRV_PHOTO_ALIASES[code];
    return code;
  }

  function fixTmhMatPlpThumbnails(root) {
    root = root || document.getElementById("content_area") || document;
    root.querySelectorAll('img[src*="/vspfiles/photos/TMH-MAT-"]').forEach(function (img) {
      var src = String(img.getAttribute("src") || img.src || "");
      if (!/-2T\.(jpg|jpeg|png|webp)/i.test(src)) return;
      img.setAttribute("src", src.replace(/-2T\.(jpg|jpeg|png|webp)/i, "-1.$1"));
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
    });
    root.querySelectorAll(".v-product, td a.productnamecolor, td a.colors_productname").forEach(function (node) {
      var title = String(
        (node.getAttribute && (node.getAttribute("title") || node.textContent)) || ""
      );
      if (!/TMH-MAT-|TMH-TRV-/i.test(title)) return;
      var m = title.match(/,\s*(TMH-(?:MAT|TRV)-[A-Z0-9-]+)\s*$/i);
      if (!m) return;
      var code = resolveTmhMatPhotoCode(m[1]);
      var block = node.closest ? node.closest(".v-product, tr, td") : node;
      if (!block) return;
      var img =
        (block.querySelector && block.querySelector("a.v-product__img img, .v-product__img img, img")) ||
        null;
      if (!img) return;
      img.setAttribute("src", sameOriginPhotoUrl(code + "-1.jpg") + "?v=" + VERSION);
      img.removeAttribute("data-mc-scale-done");
      img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
    });
  }

  /** Volusion PLP often bakes NoPhoto.gif even when {SKU}-1.jpg exists on SFTP — probe and swap. */
  function fixNoPhotoThumbnails() {
    if (isCloseoutSalePlp()) return;
    var root = document.getElementById("content_area");
    if (!root) return;

    root.querySelectorAll(".v-product").forEach(function (block) {
      var titleEl = block.querySelector("a.v-product__title");
      var sku = skuFromProductTitle(
        titleEl && (titleEl.getAttribute("title") || titleEl.textContent)
      );
      if (!sku || !/^[0-9A-Za-z][0-9A-Za-z-]*$/.test(sku)) return;

      var photoCode = resolveTmhMatPhotoCode(sku);
      var img =
        block.querySelector("a.v-product__img img") ||
        block.querySelector(".v-product__img img") ||
        block.querySelector("img");
      if (!img || !isNoPhotoPlaceholder(img.currentSrc || img.src)) return;

      var file = photoCode + "-1.jpg";
      var probe = new Image();
      probe.onload = function () {
        if (probe.naturalWidth < 80) return;
        img.src = sameOriginPhotoUrl(file) + "?v=" + VERSION;
        img.removeAttribute("data-mc-scale-done");
        img.classList.remove("mc-plp-img-fit", "mc-plp-img-sized");
        var parent = thumbBox(img);
        if (parent) {
          parent.classList.add("mc-plp-image-box");
          clearClippingStyles(img, parent);
        }
        if (img.complete && img.naturalWidth) {
          if (isPreNormalizedPhoto(img)) {
            applyPreNormalizedPhoto(img, parent);
          } else {
            applyNormalizedImage(img, parent, null);
          }
        } else {
          img.addEventListener(
            "load",
            function () {
              if (isPreNormalizedPhoto(img)) {
                applyPreNormalizedPhoto(img, parent);
              } else {
                applyNormalizedImage(img, parent, null);
              }
            },
            { once: true }
          );
        }
      };
      probe.onerror = function () {};
      probe.src = sameOriginPhotoUrl(file) + "?mc-nophoto-probe=" + Date.now();
    });
  }

  function thumbBox(img) {
    if (!img || !img.closest) return img ? img.parentElement : null;
    return (
      img.closest("a.v-product__img, .v-product__img") ||
      img.parentElement
    );
  }

  function isBackgroundPixel(r, g, b, a) {
    if (a < 10) return true;
    if (r > 245 && g > 245 && b > 245) return true;
    if (r > 235 && g > 235 && b > 235) return true;
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
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
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
      if (!found || minX >= maxX || minY >= maxY) {
        cb(null);
        return;
      }

      var sx = nw / w;
      var sy = nh / h;
      cb({
        width: (maxX - minX + 1) * sx,
        height: (maxY - minY + 1) * sy,
      });
    } catch (err) {
      cb(null);
    }
  }

  function isPreNormalizedPhoto(img) {
    return (
      img &&
      img.naturalWidth === NORMALIZED_W &&
      img.naturalHeight === NORMALIZED_H
    );
  }

  function targetVisibleWidth(parent) {
    var boxW = parent && parent.clientWidth ? parent.clientWidth : 280;
    return Math.min(360, Math.max(TARGET_VISIBLE_W, boxW - 20));
  }

  function getVisibleBounds(img, cb) {
    var file = photoFilename(img.currentSrc || img.src);
    withBoundsMap(function (map) {
      if (file && map[file] && map[file].visibleW > 0) {
        var b = map[file];
        var nw = img.naturalWidth || b.nw;
        var nh = img.naturalHeight || b.nh;
        if (b.nw > 0 && b.nh > 0 && nw > 0 && nh > 0) {
          var sx = nw / b.nw;
          var sy = nh / b.nh;
          cb({ width: b.visibleW * sx, height: b.visibleH * sy });
          return;
        }
        cb({ width: b.visibleW, height: b.visibleH });
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

  function clearClippingStyles(img, parent) {
    parent.classList.remove("mc-plp-thumb-mat");
    parent.style.removeProperty("max-height");
    parent.style.removeProperty("min-height");
    parent.style.removeProperty("clip-path");
    parent.style.setProperty("overflow", "visible", "important");
    parent.style.setProperty("background", "transparent", "important");
    parent.style.setProperty("background-color", "transparent", "important");

    img.style.removeProperty("transform");
    img.removeAttribute("data-scale");
    img.removeAttribute("data-mc-scale-done");
    img.style.removeProperty("clip-path");
    img.style.removeProperty("max-height");
    img.style.removeProperty("min-height");
    img.style.setProperty("transform", "none", "important");
    img.style.setProperty("border", "none", "important");
    img.style.setProperty("outline", "none", "important");
    img.style.setProperty("box-shadow", "none", "important");
    img.style.setProperty("background", "transparent", "important");
    img.removeAttribute("border");
  }

  function applyImageBoxLayout(parent) {
    parent.classList.add("mc-plp-image-box");
    parent.style.setProperty("height", BOX_HEIGHT + "px", "important");
    parent.style.setProperty("overflow", "visible", "important");
    parent.style.setProperty("display", "flex", "important");
    parent.style.setProperty("align-items", "center", "important");
    parent.style.setProperty("justify-content", "center", "important");
    parent.style.setProperty("width", "100%", "important");
    parent.style.setProperty("background", "#ffffff", "important");
    parent.style.setProperty("background-color", "#ffffff", "important");
  }

  /* Image element always matches the wrapper box exactly; object-fit: contain scales the photo inside. */
  function applyWrapperFill(img, parent, extraClass) {
    applyImageBoxLayout(parent);
    clearClippingStyles(img, parent);
    img.classList.add(extraClass);
    img.style.setProperty("width", "100%", "important");
    img.style.setProperty("height", "100%", "important");
    img.style.setProperty("max-width", "none", "important");
    img.style.setProperty("max-height", "none", "important");
    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center center", "important");
    img.style.setProperty("transform", "none", "important");
    img.style.setProperty("display", "block", "important");
  }

  function applyPreNormalizedPhoto(img, parent) {
    applyWrapperFill(img, parent, "mc-plp-img-fit");
  }

  function applyNormalizedImage(img, parent, bounds) {
    applyWrapperFill(img, parent, "mc-plp-img-sized");
  }

  function normalizePLPImages() {
    if (!isCategoryPlp() || isCloseoutSalePlp()) return;

    var root = document.getElementById("content_area");
    if (!root) return;

    root.querySelectorAll("img").forEach(function (img) {
      if (!isProductPhoto(img)) return;
      if (img.closest("#v65-product-related")) return;

      var parent = thumbBox(img);
      if (!parent) return;

      parent.classList.add("mc-plp-image-box");
      clearClippingStyles(img, parent);

      function apply() {
        if (!img.naturalWidth) return;
        if (isPreNormalizedPhoto(img)) {
          applyPreNormalizedPhoto(img, parent);
          return;
        }
        applyNormalizedImage(img, parent, null);
      }

      if (img.complete && img.naturalWidth) apply();
      else img.addEventListener("load", apply, { once: true });
    });
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
    injectCriticalThumbCss();
    removeLegacyCategoryBars();
    fixNoPhotoThumbnails();
    fixTmhMatPlpThumbnails();
    normalizePLPImages();
    hideHero();
    if (!global.__MC_PLP_NORM_RETRIES__) {
      global.__MC_PLP_NORM_RETRIES__ = 1;
      [200, 800, 2500].forEach(function (ms) {
        global.setTimeout(function () {
          fixNoPhotoThumbnails();
          fixTmhMatPlpThumbnails();
          normalizePLPImages();
        }, ms);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", run);
  global.addEventListener("load", run);
  global.addEventListener("resize", normalizePLPImages);
  if (isCategoryPlp()) {
    markCategory();
    run();
  }

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var mo = new MutationObserver(function (mutations) {
      var needsBar = false;
      var needsThumb = false;
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "childList") {
          needsBar = true;
          needsThumb = true;
          break;
        }
      }
      if (!needsBar && !needsThumb) return;
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        if (!isCategoryPlp()) return;
        if (needsBar) removeLegacyCategoryBars();
        if (needsThumb) normalizePLPImages();
      });
    });
    var root = document.getElementById("content_area") || document.body;
    if (root) {
      mo.observe(root, { childList: true, subtree: true });
    }
  }

  global.mcPlpEnforcerRun = run;

  var PRICE_ZERO_CENT_SELECTOR =
    ".product_list_price,.product_sale_price,.product_saleprice,.product_productprice,.product_price," +
    ".v-product__price,.mc-member-grid-price,.mc-pdp-stack-retail-amt,.mc-pdp-top-price-value,.mtl-top-price__amount," +
    "#priceWithOptions,#priceWithOptionsNoTax,.colors_productprice,.pricecolor,.mc-member-price-caption," +
    ".mc-pdp-member-line__amount,.v65-product-price,.mc-member-grid-price__amount";

  function stripZeroCentTextNodes(scope) {
    if (!scope || typeof global.document.createTreeWalker !== "function") return;
    var walker = global.document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.indexOf(".00") === -1) {
          return NodeFilter.FILTER_REJECT;
        }
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "OPTION") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = walker.nextNode())) {
      var v = n.nodeValue;
      var nv = v.replace(/(\$\d[\d,]*)\.00(?!\d)/g, "$1");
      if (nv !== v) n.nodeValue = nv;
    }
  }

  function stripPriceZeroCentsLocal(root) {
    if (typeof global.mcStripPriceZeroCents === "function") {
      global.mcStripPriceZeroCents(root);
      return;
    }
    root = root || global.document.body;
    if (!root || !root.querySelectorAll) return;
    try {
      root.querySelectorAll(PRICE_ZERO_CENT_SELECTOR).forEach(function (el) {
        stripZeroCentTextNodes(el);
      });
    } catch (eStrip) {}
    // Category/search pages can render prices in containers not covered by the
    // selector list above. Sweep the content area so no $X.00 slips through.
    try {
      var area = global.document.getElementById("content_area") || root;
      stripZeroCentTextNodes(area);
    } catch (eSweep) {}
  }

  function runGlobalPriceDisplayFix() {
    stripPriceZeroCentsLocal();
  }

  global.document.addEventListener("DOMContentLoaded", runGlobalPriceDisplayFix);
  global.addEventListener("load", runGlobalPriceDisplayFix);
  [200, 800, 2500].forEach(function (ms) {
    global.setTimeout(runGlobalPriceDisplayFix, ms);
  });

  if (typeof MutationObserver !== "undefined") {
    var priceMoScheduled = false;
    var priceMo = new MutationObserver(function (mutations) {
      var i;
      for (i = 0; i < mutations.length; i++) {
        if (mutations[i].type === "characterData" || mutations[i].type === "childList") {
          if (priceMoScheduled) return;
          priceMoScheduled = true;
          global.requestAnimationFrame(function () {
            priceMoScheduled = false;
            runGlobalPriceDisplayFix();
          });
          return;
        }
      }
    });
    var priceRoot = global.document.getElementById("content_area") || global.document.body;
    if (priceRoot) {
      priceMo.observe(priceRoot, { childList: true, subtree: true, characterData: true });
    }
  }

  var PDP_AUTH_WANT = "20260617pdp78";

  function loadPdpAuthCtaFix() {
    try {
      var b = global.document.body;
      var onPdp =
        (b && b.classList.contains("productdetails")) ||
        !!global.document.getElementById("v65-product-parent");
      if (!onPdp) return;
      if (String(global.__MC_PDP_AUTH_CTA_FIX_VER__ || "") === PDP_AUTH_WANT) return;
      global.document
        .querySelectorAll('script[src*="mc-pdp-auth-cta-fix.js"]')
        .forEach(function (old) {
          try {
            old.remove();
          } catch (eRm) {}
        });
      delete global.__MC_PDP_AUTH_CTA_FIX_VER__;
      var s = global.document.createElement("script");
      s.src =
        "/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=" +
        PDP_AUTH_WANT +
        "&mcrd=" +
        Date.now();
      s.async = false;
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eLoad) {}
  }

  loadPdpAuthCtaFix();
  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", loadPdpAuthCtaFix);
  }
  global.addEventListener("load", loadPdpAuthCtaFix);
  [0, 400, 1500].forEach(function (ms) {
    global.setTimeout(loadPdpAuthCtaFix, ms);
  });
})(window);
