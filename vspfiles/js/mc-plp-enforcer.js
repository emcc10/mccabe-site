/**
 * PLP gray mats + site-wide hero/logo — beats baked template inline CSS (~line 16308).
 * MC_PLP_ENFORCER_20260519
 */
(function (global) {
  "use strict";
  if (global.__MC_PLP_ENFORCER__) return;
  global.__MC_PLP_ENFORCER__ = true;

  var MAT = "#f2f2f2";
  var TILE = 280;
  var STAGE = 220;
  var TILE_M = 220;
  var STAGE_M = 172;

  var FINAL_CSS =
    "html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html body:not(.productdetails) #content_area .v-product-grid a.v-product__img," +
    "html.category body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.category body:not(.productdetails) #content_area .v-product-grid a.v-product__img," +
    "html.is-category-or-listing-page #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.is-category-or-listing-page .v-product-grid a.v-product__img{" +
    "display:flex!important;align-items:flex-end!important;justify-content:center!important;" +
    "width:100%!important;height:" +
    TILE +
    "px!important;min-height:" +
    TILE +
    "px!important;max-height:" +
    TILE +
    "px!important;margin:0!important;padding:14px!important;overflow:hidden!important;" +
    "box-sizing:border-box!important;background:" +
    MAT +
    "!important;line-height:0!important}" +
    "html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html body:not(.productdetails) #content_area .v-product-grid a.v-product__img>img," +
    "html.category body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category body:not(.productdetails) #content_area .v-product-grid a.v-product__img>img," +
    "html.category .v-product-grid .v-product .v-product__img img," +
    "html.category .v-product-grid .v-product a.v-product__img>img," +
    "html.is-category-or-listing-page .v-product-grid a.v-product__img>img{" +
    "width:100%!important;height:" +
    STAGE +
    "px!important;max-width:100%!important;max-height:" +
    STAGE +
    "px!important;min-height:0!important;object-fit:contain!important;" +
    "object-position:center bottom!important;margin:0 auto!important;border:0!important;border-width:0!important;" +
    "display:block!important;box-sizing:border-box!important;background:transparent!important}" +
    "@media(max-width:991px){html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.category body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img{height:" +
    TILE_M +
    "px!important;min-height:" +
    TILE_M +
    "px!important;max-height:" +
    TILE_M +
    "px!important;padding:12px!important}" +
    "html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category .v-product-grid .v-product .v-product__img img{height:" +
    STAGE_M +
    "px!important;max-height:" +
    STAGE_M +
    "px!important;object-fit:contain!important;object-position:center bottom!important}}" +
    "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video,.mc-hero-video{" +
    "display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;" +
    "max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;" +
    "opacity:0!important;pointer-events:none!important;background:transparent!important;border:0!important}" +
    "html.mc-allow-home-hero body.is-home #if_homepage,html.mc-allow-home-hero body.is-home #slideshow-container{" +
    "display:block!important;height:auto!important;min-height:0!important;max-height:none!important;" +
    "opacity:1!important;visibility:visible!important}" +
    "#display_homepage_title,#display_homepage_title *{display:none!important;visibility:hidden!important;" +
    "height:0!important;width:0!important;overflow:hidden!important;opacity:0!important;" +
    "pointer-events:none!important;font-size:0!important}";

  function isHome() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
    } catch (e) {}
    return false;
  }

  function injectFinalStyle() {
    var id = "mc-plp-enforcer-final";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
    }
    el.textContent = isHome()
      ? FINAL_CSS.replace(
          /#if_homepage,#slideshow-container[\s\S]*?visibility:visible!important\}/,
          ""
        )
      : FINAL_CSS;
    var root = document.body || document.documentElement;
    if (root && el.parentNode !== root) {
      root.appendChild(el);
    } else if (root && el !== root.lastElementChild) {
      root.appendChild(el);
    }
  }

  function applyInline() {
    var mobile = global.innerWidth <= 991;
    var tile = mobile ? TILE_M : TILE;
    var stage = mobile ? STAGE_M : STAGE;
    var pad = mobile ? 12 : 14;

    document
      .querySelectorAll(
        "#content_area .v-product-grid a.v-product__img, .v-product-grid a.v-product__img"
      )
      .forEach(function (wrap) {
        if (!wrap.closest(".v-product-grid") || wrap.closest("#v65-product-related")) return;
        wrap.classList.add("mc-plp-thumb-mat");
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("align-items", "flex-end", "important");
        wrap.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("background", MAT, "important");
        wrap.style.setProperty("height", tile + "px", "important");
        wrap.style.setProperty("min-height", tile + "px", "important");
        wrap.style.setProperty("max-height", tile + "px", "important");
        wrap.style.setProperty("padding", pad + "px", "important");
        wrap.style.setProperty("overflow", "hidden", "important");
        wrap.style.setProperty("box-sizing", "border-box", "important");
        wrap.style.setProperty("width", "100%", "important");
        var img = wrap.querySelector("img");
        if (!img) return;
        img.style.setProperty("border", "0", "important");
        img.style.setProperty("border-width", "0", "important");
        img.style.setProperty("outline", "0", "important");
        img.style.setProperty("object-fit", "contain", "important");
        img.style.setProperty("object-position", "center bottom", "important");
        img.style.setProperty("height", stage + "px", "important");
        img.style.setProperty("max-height", stage + "px", "important");
        img.style.setProperty("width", "100%", "important");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("margin", "0 auto", "important");
      });

    if (!isHome()) {
      global.document.documentElement.classList.remove("mc-allow-home-hero");
      if (global.document.body) global.document.body.classList.remove("is-home");
      document
        .querySelectorAll("#if_homepage,#slideshow-container,.mc-hero-video")
        .forEach(function (n) {
          n.style.setProperty("display", "none", "important");
          n.style.setProperty("height", "0", "important");
          n.style.setProperty("min-height", "0", "important");
          n.style.setProperty("opacity", "0", "important");
          n.style.setProperty("overflow", "hidden", "important");
          n.style.setProperty("background", "transparent", "important");
        });
    }

    var logo = document.getElementById("display_homepage_title");
    if (logo) {
      logo.style.setProperty("display", "none", "important");
      logo.style.setProperty("height", "0", "important");
      logo.style.setProperty("opacity", "0", "important");
    }
  }

  function run() {
    injectFinalStyle();
    applyInline();
  }

  run();
  document.addEventListener("DOMContentLoaded", run);
  global.addEventListener("load", run);
  global.addEventListener("resize", applyInline);
  global.setInterval(run, 400);
  [0, 50, 150, 400, 1000, 2500, 5000].forEach(function (t) {
    global.setTimeout(run, t);
  });
  global.mcPlpEnforcerRun = run;
})(window);
