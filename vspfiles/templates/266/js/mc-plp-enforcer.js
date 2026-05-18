/**
 * PLP fixes — DOM-driven, scoped to inspected Volusion markup.
 * MC_PLP_ENFORCER_20260530
 *
 * DOM (category listing):
 *   table.colors_backgroundlight + SearchResults_SubCat_Angle  ← black bar (legacy subcat chrome)
 *   #content_area > table > tr > td.colors_lines_light           ← breadcrumb divider
 *   .v-product-grid > .v-product > a.v-product__img > img      ← thumb (flat, no inner wrapper)
 */
(function (global) {
  "use strict";

  var VERSION = "20260530";
  var PLP_MAT = "#ffffff";
  if (global.__MC_PLP_ENFORCER_VER__ === VERSION) return;
  global.__MC_PLP_ENFORCER_VER__ = VERSION;
  global.__MC_PLP_ENFORCER__ = true;

  var MAT = PLP_MAT;
  var TILE = 280;
  var STAGE = 220;
  var TILE_M = 220;
  var STAGE_M = 172;
  var PAD = 14;
  var PAD_M = 12;
  var TARGET_FILL = 0.78;

  var SCALE_OVERRIDES = {
    miami: 0.84,
    juno: 0.88,
    alula: 0.86,
    "juno apartment": 0.88,
    "miami track": 0.84,
    "miami roll": 0.84,
  };

  var THUMB_SEL = "#content_area .v-product-grid a.v-product__img";

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

  function haystack(wrap, img) {
    return (
      (wrap.getAttribute("href") || "") +
      " " +
      (img.getAttribute("alt") || "") +
      " " +
      (img.getAttribute("title") || "") +
      " " +
      (img.getAttribute("src") || "")
    ).toLowerCase();
  }

  function manualScale(wrap, img) {
    var text = haystack(wrap, img);
    var key;
    for (key in SCALE_OVERRIDES) {
      if (Object.prototype.hasOwnProperty.call(SCALE_OVERRIDES, key) && text.indexOf(key) !== -1) {
        return SCALE_OVERRIDES[key];
      }
    }
    return null;
  }

  function applyScale(img, scale) {
    scale = Math.max(0.7, Math.min(1, scale));
    scale = Math.round(scale * 100) / 100;
    img.setAttribute("data-scale", String(scale));
    img.style.setProperty("--thumb-scale", String(scale));
    img.style.transformOrigin = "center bottom";
    if (scale < 0.995) {
      img.style.transform = "scale(var(--thumb-scale))";
    } else {
      img.style.transform = "";
      img.removeAttribute("data-scale");
    }
  }

  function measureFill(img, cb) {
    if (!img.complete || !img.naturalWidth) {
      img.addEventListener(
        "load",
        function () {
          measureFill(img, cb);
        },
        { once: true }
      );
      return;
    }
    try {
      var maxSide = 160;
      var nw = img.naturalWidth;
      var nh = img.naturalHeight;
      var w = nw >= nh ? maxSide : Math.round((maxSide * nw) / nh);
      var h = nh >= nw ? maxSide : Math.round((maxSide * nh) / nw);
      if (w < 1) w = 1;
      if (h < 1) h = 1;

      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
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
          var r = data[i];
          var g = data[i + 1];
          var b = data[i + 2];
          var a = data[i + 3];
          if (a < 20) continue;
          if (r > 238 && g > 238 && b > 238) continue;
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (!found) {
        cb(1);
        return;
      }
      var fillW = (maxX - minX + 1) / w;
      var fillH = (maxY - minY + 1) / h;
      cb(Math.max(fillW, fillH));
    } catch (err) {
      cb(1);
    }
  }

  function normalizeScale(wrap, img) {
    var forced = manualScale(wrap, img);
    if (forced != null) {
      applyScale(img, forced);
      img.setAttribute("data-mc-scale-done", "1");
      return;
    }
    if (img.getAttribute("data-mc-scale-done") === "1") return;

    measureFill(img, function (fill) {
      var scale = 1;
      if (fill > TARGET_FILL + 0.04) {
        scale = TARGET_FILL / fill;
      }
      applyScale(img, scale);
      img.setAttribute("data-mc-scale-done", "1");
    });
  }

  function fixPLPThumbBackgrounds() {
    if (!isCategoryPlp()) return;
    document
      .querySelectorAll(
        '#content_area .v-product-grid img[src*="/v/vspfiles/photos/"],' +
          '#content_area .v-product-grid img[src*="vspfiles/photos"]'
      )
      .forEach(function (img) {
        if (!img.closest(".v-product-grid") || img.closest("#v65-product-related")) return;

        img.style.setProperty("background", PLP_MAT, "important");
        img.style.setProperty("background-color", PLP_MAT, "important");
        img.style.setProperty("border", "0", "important");
        img.style.setProperty("box-shadow", "none", "important");

        var el = img.parentElement;
        var i;
        for (i = 0; i < 5 && el; i++) {
          if (!el.closest || !el.closest(".v-product-grid")) break;
          el.style.setProperty("background", PLP_MAT, "important");
          el.style.setProperty("background-color", PLP_MAT, "important");
          el.style.setProperty("border", "0", "important");
          el.style.setProperty("box-shadow", "none", "important");
          el = el.parentElement;
        }
      });
  }

  function clearInnerThumbChrome(node) {
    if (!node || !node.style) return;
    node.style.setProperty("background", "transparent", "important");
    node.style.setProperty("background-color", "transparent", "important");
    node.style.setProperty("border", "0", "important");
    node.style.setProperty("box-shadow", "none", "important");
    node.style.setProperty("outline", "0", "important");
  }

  function fixThumb(wrap) {
    if (!wrap || !wrap.classList || !wrap.classList.contains("v-product__img")) return;
    if (!wrap.closest(".v-product-grid")) return;
    if (wrap.closest("#v65-product-related")) return;

    var mobile = global.innerWidth <= 991;
    var tile = mobile ? TILE_M : TILE;
    var stage = mobile ? STAGE_M : STAGE;
    var pad = mobile ? PAD_M : PAD;

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

    wrap.querySelectorAll(".v-product__image-wrap, span, div").forEach(function (node) {
      node.style.setProperty("background", PLP_MAT, "important");
      node.style.setProperty("background-color", PLP_MAT, "important");
      node.style.setProperty("border", "0", "important");
      node.style.setProperty("box-shadow", "none", "important");
    });

    var img = wrap.querySelector(":scope > img") || wrap.querySelector("img");
    if (!img) return;

    try {
      img.removeAttribute("style");
      img.removeAttribute("border");
    } catch (eAttr) {}

    clearInnerThumbChrome(img);
    img.style.setProperty("background", PLP_MAT, "important");
    img.style.setProperty("background-color", PLP_MAT, "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("width", "auto", "important");
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
    img.style.transformOrigin = "center bottom";

    normalizeScale(wrap, img);
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

  function applyThumbs() {
    if (!isCategoryPlp()) return;
    document.querySelectorAll(THUMB_SEL).forEach(fixThumb);
  }

  function run() {
    if (!isCategoryPlp()) return;
    markCategory();
    removeLegacyCategoryBars();
    fixPLPThumbBackgrounds();
    applyThumbs();
    hideHero();
  }

  run();
  document.addEventListener("DOMContentLoaded", run);
  global.addEventListener("load", run);
  global.addEventListener("resize", applyThumbs);
  [0, 100, 400, 1200, 3000].forEach(function (t) {
    global.setTimeout(run, t);
  });

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        run();
      });
    });
    var root = document.body || document.getElementById("content_area");
    if (root) {
      mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    }
  }

  global.mcPlpEnforcerRun = run;
})(window);
