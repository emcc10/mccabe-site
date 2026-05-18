/**
 * PLP category grid layout — breadcrumb bar, thumbnail mat, uniform images.
 * MC PLP THUMBNAIL CLEANUP 20260518 / MC_PLP_ENFORCER_20260522
 */
(function (global) {
  "use strict";
  if (global.__MC_PLP_ENFORCER__) return;
  global.__MC_PLP_ENFORCER__ = true;

  var MAT = "#f5f5f3";
  var MAT_H = 190;
  var MAT_H_M = 170;
  var MAT_PAD = 18;
  var MAT_PAD_M = 14;
  var IMG_MAX_W = 235;
  var IMG_MAX_H = 150;
  var IMG_MAX_W_M = 200;
  var IMG_MAX_H_M = 130;
  var OVERSIZE_NAMES = /miami|juno|soren|alula|allula/i;

  var WRAP_SEL =
    "#content_area .v-product-grid .v-product__img," +
    "#content_area .v-product-grid a.v-product__img," +
    "#content_area .v-product-grid .product_image," +
    "#content_area .v-product-grid .v-product-grid__img," +
    "#content_area .v-product-grid .product_productphoto," +
    "#content_area .v-product-grid .v-product__image-wrapper";

  var HERO_SEL =
    "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video," +
    ".mc-hero-video,video.mc-hero-video-el,.mc-hero-video-el";

  var FINAL_CSS =
    "/* MC PLP THUMBNAIL CLEANUP 20260518 */" +
    "html[data-mc-category-plp='1'] #content_area td.colors_lines_light,html.category #content_area td.colors_lines_light{" +
    "background:transparent!important;border:0!important;height:0!important;min-height:0!important;" +
    "max-height:0!important;padding:0!important;margin:0!important;line-height:0!important;overflow:hidden!important}" +
    "html[data-mc-category-plp='1'] #content_area td.colors_lines_light img{display:none!important;height:0!important;width:0!important}" +
    "html[data-mc-category-plp='1'] #content_area table.vCSS_breadcrumb,html.category #content_area table.vCSS_breadcrumb{" +
    "border-bottom:0!important;background:transparent!important;box-shadow:none!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product{background:transparent!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product__img," +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img," +
    "html.category #content_area .v-product-grid a.v-product__img{" +
    "width:100%!important;height:" +
    MAT_H +
    "px!important;min-height:" +
    MAT_H +
    "px!important;max-height:" +
    MAT_H +
    "px!important;display:flex!important;align-items:center!important;justify-content:center!important;" +
    "padding:" +
    MAT_PAD +
    "px!important;overflow:hidden!important;box-sizing:border-box!important;" +
    "background:" +
    MAT +
    "!important;background-color:" +
    MAT +
    "!important;border:0!important;box-shadow:none!important;margin:0!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product__img img," +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img>img," +
    "html.category #content_area .v-product-grid a.v-product__img>img{" +
    "max-width:" +
    IMG_MAX_W +
    "px!important;max-height:" +
    IMG_MAX_H +
    "px!important;width:auto!important;height:auto!important;object-fit:contain!important;" +
    "object-position:center center!important;display:block!important;margin:0 auto!important;" +
    "background:transparent!important;border:0!important;box-shadow:none!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid img.mc-plp-oversized," +
    "html.category #content_area .v-product-grid img.mc-plp-oversized{max-width:215px!important;max-height:140px!important}" +
    "html[data-mc-category-plp='1'] #if_homepage,html[data-mc-category-plp='1'] #slideshow-container," +
    "html[data-mc-category-plp='1'] video.mc-hero-video-el,html.category #slideshow-container," +
    "html.category video.mc-hero-video-el{display:none!important;height:0!important;min-height:0!important;" +
    "opacity:0!important;overflow:hidden!important;background:transparent!important}";

  function isCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      return /-s\//.test(p) && /\.html?/i.test(p);
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

  function injectFinalStyle() {
    var id = "mc-plp-enforcer-final";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
    }
    el.textContent = FINAL_CSS;
    var root = document.body || document.documentElement;
    if (root && el.parentNode !== root) root.appendChild(el);
    else if (root && el !== root.lastElementChild) root.appendChild(el);
  }

  function isOversizedThumb(img) {
    var wrap = img.closest("a.v-product__img, .v-product__img");
    var label = (
      (wrap && (wrap.getAttribute("title") || wrap.getAttribute("alt"))) ||
      img.getAttribute("alt") ||
      img.getAttribute("src") ||
      ""
    ).toLowerCase();
    if (OVERSIZE_NAMES.test(label)) return true;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      var ratio = img.naturalWidth / img.naturalHeight;
      if (ratio > 2.2 || img.naturalHeight > 900) return true;
    }
    return false;
  }

  function styleThumb(wrap, matH, pad, maxW, maxH) {
    if (!wrap || !wrap.closest || !wrap.closest(".v-product-grid")) return;
    if (wrap.closest("#v65-product-related")) return;
    if (wrap.tagName && wrap.tagName.toLowerCase() !== "a") {
      var innerA = wrap.querySelector("a.v-product__img");
      if (innerA) wrap = innerA;
    }
    wrap.classList.add("mc-plp-thumb-mat");
    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("align-items", "center", "important");
    wrap.style.setProperty("justify-content", "center", "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("height", matH + "px", "important");
    wrap.style.setProperty("min-height", matH + "px", "important");
    wrap.style.setProperty("max-height", matH + "px", "important");
    wrap.style.setProperty("padding", pad + "px", "important");
    wrap.style.setProperty("overflow", "hidden", "important");
    wrap.style.setProperty("box-sizing", "border-box", "important");
    wrap.style.setProperty("background", MAT, "important");
    wrap.style.setProperty("background-color", MAT, "important");
    wrap.style.setProperty("border", "0", "important");
    wrap.style.setProperty("box-shadow", "none", "important");
    wrap.style.setProperty("margin", "0", "important");

    var img = wrap.querySelector("img");
    if (!img) return;
    try {
      img.removeAttribute("style");
      img.removeAttribute("border");
    } catch (eAttr) {}

    var ow = maxW;
    var oh = maxH;
    if (isOversizedThumb(img)) {
      img.classList.add("mc-plp-oversized");
      ow = Math.min(maxW, 215);
      oh = Math.min(maxH, 140);
    } else {
      img.classList.remove("mc-plp-oversized");
    }

    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center center", "important");
    img.style.setProperty("max-width", ow + "px", "important");
    img.style.setProperty("max-height", oh + "px", "important");
    img.style.setProperty("width", "auto", "important");
    img.style.setProperty("height", "auto", "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("margin", "0 auto", "important");
    img.style.setProperty("background", "transparent", "important");
    img.style.setProperty("background-color", "transparent", "important");
    img.style.setProperty("border", "0", "important");
    img.style.setProperty("box-shadow", "none", "important");
  }

  function fixBreadcrumbBar() {
    if (!isCategoryPlp()) return;
    document.querySelectorAll("#content_area td.colors_lines_light").forEach(function (td) {
      td.style.setProperty("background", "transparent", "important");
      td.style.setProperty("background-color", "transparent", "important");
      td.style.setProperty("border", "0", "important");
      td.style.setProperty("height", "0", "important");
      td.style.setProperty("min-height", "0", "important");
      td.style.setProperty("max-height", "0", "important");
      td.style.setProperty("padding", "0", "important");
      td.style.setProperty("margin", "0", "important");
      td.style.setProperty("line-height", "0", "important");
      td.style.setProperty("overflow", "hidden", "important");
      var tr = td.closest("tr");
      if (tr) {
        tr.style.setProperty("height", "0", "important");
        tr.style.setProperty("line-height", "0", "important");
      }
    });
  }

  function hideHero() {
    if (isHome()) return;
    global.document.documentElement.classList.remove("mc-allow-home-hero");
    if (global.document.body) global.document.body.classList.remove("is-home");
    document.querySelectorAll(HERO_SEL).forEach(function (n) {
      n.style.setProperty("display", "none", "important");
      n.style.setProperty("height", "0", "important");
      n.style.setProperty("min-height", "0", "important");
      n.style.setProperty("opacity", "0", "important");
      n.style.setProperty("overflow", "hidden", "important");
      n.style.setProperty("background", "transparent", "important");
    });
  }

  function applyThumbs() {
    if (!isCategoryPlp()) return;
    var mobile = global.innerWidth <= 991;
    var matH = mobile ? MAT_H_M : MAT_H;
    var pad = mobile ? MAT_PAD_M : MAT_PAD;
    var maxW = mobile ? IMG_MAX_W_M : IMG_MAX_W;
    var maxH = mobile ? IMG_MAX_H_M : IMG_MAX_H;

    document.querySelectorAll(WRAP_SEL).forEach(function (wrap) {
      styleThumb(wrap, matH, pad, maxW, maxH);
    });

    document.querySelectorAll("#content_area .v-product-grid .v-product").forEach(function (cell) {
      cell.style.setProperty("background", "transparent", "important");
    });
  }

  function run() {
    markCategory();
    injectFinalStyle();
    fixBreadcrumbBar();
    hideHero();
    applyThumbs();
  }

  run();
  document.addEventListener("DOMContentLoaded", run);
  global.addEventListener("load", run);
  global.addEventListener("resize", applyThumbs);
  global.setInterval(run, 400);
  [0, 50, 150, 400, 1000, 2500].forEach(function (t) {
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
    var root = document.getElementById("content_area") || document.body;
    if (root) {
      mo.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class", "src"],
      });
    }
  }

  global.mcPlpEnforcerRun = run;
})(window);
