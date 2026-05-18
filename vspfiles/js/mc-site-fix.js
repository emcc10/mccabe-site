/**
 * McCabe site-wide fixes for Volusion baked template (category PLP + hero/logo).
 * Loaded from mtl-sectional-renderer.js on storefront pages.
 * MC_SITE_FIX_BUILD_20260518b
 */
(function (global) {
  "use strict";
  if (global.__MC_SITE_FIX_LOADED__) return;
  global.__MC_SITE_FIX_LOADED__ = true;

  var MAT = "#ffffff";
  var TILE_H = 280;
  var STAGE_H = 220;
  var TILE_H_M = 220;
  var STAGE_H_M = 172;

  function isHomepage() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      var q = String(global.location.search || "");
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
      if (/(?:^|[?&])page=home/i.test(q)) return true;
    } catch (eHome) {}
    return false;
  }

  function injectCriticalCss() {
    if (document.getElementById("mc-site-fix-critical")) return;
    var st = document.createElement("style");
    st.id = "mc-site-fix-critical";
    st.textContent =
      "body:not(.is-home) #if_homepage,body:not(.is-home) #slideshow-container," +
      "html:not(.mc-allow-home-hero) #if_homepage,html:not(.mc-allow-home-hero) #slideshow-container," +
      "body.category #if_homepage,body.category #slideshow-container," +
      "html.category #if_homepage,html.category #slideshow-container," +
      "html.is-category-or-listing-page #if_homepage,html.is-category-or-listing-page #slideshow-container{" +
      "display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;" +
      "max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;" +
      "opacity:0!important;pointer-events:none!important;background:transparent!important;border:0!important}" +
      "body:not(.is-home) #slideshow-container .mc-hero-video,body:not(.is-home) .mc-hero-video," +
      "html.category #slideshow-container .mc-hero-video{display:none!important;height:0!important;" +
      "min-height:0!important;overflow:hidden!important;opacity:0!important;background:transparent!important}" +
      "#display_homepage_title,#display_homepage_title *{display:none!important;visibility:hidden!important;" +
      "height:0!important;width:0!important;max-width:0!important;margin:0!important;padding:0!important;" +
      "overflow:hidden!important;opacity:0!important;pointer-events:none!important;font-size:0!important}" +
      "header.header .header__section>.col-xs-6.col-sm-8.col-md-9.col-lg-3:first-child{display:none!important;" +
      "width:0!important;padding:0!important;margin:0!important;overflow:hidden!important}" +
      "#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat{display:flex!important;align-items:flex-end!important;" +
      "justify-content:center!important;background:#ffffff!important;box-sizing:border-box!important;" +
      "height:280px!important;min-height:280px!important;max-height:280px!important;padding:14px!important;" +
      "overflow:hidden!important;width:100%!important;margin:0!important}" +
      "#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat>img," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat>img{width:100%!important;height:220px!important;" +
      "max-height:220px!important;object-fit:contain!important;object-position:center bottom!important;" +
      "border:0!important;border-width:0!important;display:block!important;margin:0 auto!important;" +
      "background:transparent!important}" +
      "@media(max-width:991px){#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat{height:220px!important;min-height:220px!important;" +
      "max-height:220px!important;padding:12px!important}#content_area .v-product-grid a.v-product__img.mc-plp-thumb-mat>img," +
      ".v-product-grid a.v-product__img.mc-plp-thumb-mat>img{height:172px!important;max-height:172px!important}}";
    (document.head || document.documentElement).appendChild(st);
  }

  function hideHeroAndLogo() {
    var home = isHomepage();
    if (!home) {
      global.document.documentElement.classList.remove("mc-allow-home-hero");
      if (global.document.body) global.document.body.classList.remove("is-home");
    }

    var logo = document.getElementById("display_homepage_title");
    if (logo) {
      logo.style.setProperty("display", "none", "important");
      logo.style.setProperty("visibility", "hidden", "important");
      logo.style.setProperty("height", "0", "important");
      logo.style.setProperty("width", "0", "important");
      logo.style.setProperty("overflow", "hidden", "important");
      logo.style.setProperty("opacity", "0", "important");
    }

    if (home) return;

    var sel =
      "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video,.mc-hero-video";
    document.querySelectorAll(sel).forEach(function (node) {
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("height", "0", "important");
      node.style.setProperty("min-height", "0", "important");
      node.style.setProperty("max-height", "0", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("opacity", "0", "important");
      node.style.setProperty("pointer-events", "none", "important");
      node.style.setProperty("background", "transparent", "important");
      node.style.setProperty("border", "0", "important");
    });
  }

  function applyPlpThumbs() {
    var mobile = global.innerWidth <= 991;
    var tileH = mobile ? TILE_H_M : TILE_H;
    var stageH = mobile ? STAGE_H_M : STAGE_H;
    var pad = mobile ? 12 : 14;

    document
      .querySelectorAll(
        "#content_area .v-product-grid a.v-product__img, .v-product-grid a.v-product__img"
      )
      .forEach(function (wrap) {
        if (!wrap || !wrap.closest || !wrap.closest(".v-product-grid")) return;
        if (wrap.closest("#v65-product-related")) return;

        wrap.classList.add("mc-plp-thumb-mat");
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("align-items", "flex-end", "important");
        wrap.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("width", "100%", "important");
        wrap.style.setProperty("height", tileH + "px", "important");
        wrap.style.setProperty("min-height", tileH + "px", "important");
        wrap.style.setProperty("max-height", tileH + "px", "important");
        wrap.style.setProperty("margin", "0", "important");
        wrap.style.setProperty("padding", pad + "px", "important");
        wrap.style.setProperty("overflow", "hidden", "important");
        wrap.style.setProperty("box-sizing", "border-box", "important");
        wrap.style.setProperty("background", MAT, "important");
        wrap.style.setProperty("line-height", "0", "important");

        var img = wrap.querySelector("img");
        if (!img) return;
        img.style.setProperty("border", "0", "important");
        img.style.setProperty("border-width", "0", "important");
        img.style.setProperty("outline", "0", "important");
        img.style.setProperty("width", "100%", "important");
        img.style.setProperty("height", stageH + "px", "important");
        img.style.setProperty("max-width", "100%", "important");
        img.style.setProperty("max-height", stageH + "px", "important");
        img.style.setProperty("min-height", "0", "important");
        img.style.setProperty("object-fit", "contain", "important");
        img.style.setProperty("object-position", "center bottom", "important");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("margin", "0 auto", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
        img.style.setProperty("background", "transparent", "important");
      });
  }

  function markCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (/-s\//.test(p) && /\.html?/i.test(p)) {
        document.documentElement.classList.add("category");
        document.documentElement.setAttribute("data-mc-category-plp", "1");
        if (document.body) document.body.classList.add("category");
      }
    } catch (eCat) {}
  }

  function run() {
    injectCriticalCss();
    markCategoryPlp();
    hideHeroAndLogo();
    applyPlpThumbs();
  }

  run();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  }
  global.addEventListener("load", run);
  global.addEventListener("resize", applyPlpThumbs);
  [50, 150, 400, 800, 1500, 3000, 6000].forEach(function (ms) {
    global.setTimeout(run, ms);
  });

  if (typeof MutationObserver !== "undefined" && document.body) {
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        run();
      });
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  global.mcSiteFixRun = run;
})(typeof window !== "undefined" ? window : this);
