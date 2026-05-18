/**
 * PLP uniform thumbs (no mat) + hide homepage hero on category pages.
 * MC_PLP_ENFORCER_20260521
 */
(function (global) {
  "use strict";
  if (global.__MC_PLP_ENFORCER__) return;
  global.__MC_PLP_ENFORCER__ = true;

  var TILE = 280;
  var STAGE = 220;
  var TILE_M = 220;
  var STAGE_M = 172;
  var IMG_MAX_W = "92%";

  var WRAP_SEL =
    "#content_area ul.v-product-grid > li.v-product > a.v-product__img," +
    "#content_area ul.v-product-grid > li.v-product .v-product__img," +
    "#content_area .v-product-grid a.v-product__img," +
    ".v-product-grid a.v-product__img";

  var HERO_SEL =
    "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video," +
    ".mc-hero-video,video.mc-hero-video-el,.mc-hero-video-el";

  var FINAL_CSS =
    "html[data-mc-category-plp='1'] #if_homepage,html[data-mc-category-plp='1'] #slideshow-container," +
    "html[data-mc-category-plp='1'] #slideshow-container .mc-hero-video,html[data-mc-category-plp='1'] .mc-hero-video," +
    "html[data-mc-category-plp='1'] video.mc-hero-video-el,html.category #if_homepage,html.category #slideshow-container," +
    "html.category #slideshow-container .mc-hero-video,html.category video.mc-hero-video-el," +
    "html body:not(.is-home) #if_homepage,html body:not(.is-home) #slideshow-container," +
    "html body:not(.is-home) #slideshow-container .mc-hero-video,html body:not(.is-home) video.mc-hero-video-el{" +
    "display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;" +
    "max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;" +
    "opacity:0!important;pointer-events:none!important;background:transparent!important;border:0!important}" +
    "html[data-mc-category-plp='1'] #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.category #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.category #content_area ul.v-product-grid>li.v-product .v-product__img," +
    "html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html body:not(.productdetails) #content_area .v-product-grid a.v-product__img{" +
    "display:flex!important;align-items:flex-end!important;justify-content:center!important;" +
    "width:100%!important;height:" +
    TILE +
    "px!important;min-height:" +
    TILE +
    "px!important;max-height:" +
    TILE +
    "px!important;margin:0!important;padding:0 0 8px!important;overflow:hidden!important;" +
    "box-sizing:border-box!important;background:transparent!important;background-color:transparent!important;" +
    "line-height:0!important}" +
    "html[data-mc-category-plp='1'] #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category #content_area ul.v-product-grid>li.v-product .v-product__img img," +
    "html body:not(.productdetails) #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html body:not(.productdetails) #content_area .v-product-grid a.v-product__img>img{" +
    "width:auto!important;max-width:" +
    IMG_MAX_W +
    "!important;height:" +
    STAGE +
    "px!important;max-height:" +
    STAGE +
    "px!important;min-height:0!important;object-fit:contain!important;" +
    "object-position:center bottom!important;margin:0 auto!important;border:0!important;border-width:0!important;" +
    "outline:0!important;display:block!important;box-sizing:border-box!important;" +
    "background:transparent!important;background-color:transparent!important}" +
    "@media(max-width:991px){html[data-mc-category-plp='1'] #content_area ul.v-product-grid>li.v-product>a.v-product__img," +
    "html.category #content_area ul.v-product-grid>li.v-product>a.v-product__img{height:" +
    TILE_M +
    "px!important;min-height:" +
    TILE_M +
    "px!important;max-height:" +
    TILE_M +
    "px!important}" +
    "html[data-mc-category-plp='1'] #content_area ul.v-product-grid>li.v-product>a.v-product__img>img," +
    "html.category #content_area ul.v-product-grid>li.v-product>a.v-product__img>img{height:" +
    STAGE_M +
    "px!important;max-height:" +
    STAGE_M +
    "px!important}}" +
    "#display_homepage_title,#display_homepage_title *{display:none!important;visibility:hidden!important;" +
    "height:0!important;width:0!important;overflow:hidden!important;opacity:0!important;" +
    "pointer-events:none!important;font-size:0!important}";

  function isHome() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      if (/-s\//.test(p) && /\.html?/i.test(p)) return false;
      if (p === "/" || p === "/default.asp" || p === "/default.aspx") return true;
      if (/\/index\.html?$/i.test(p)) return true;
      if (global.mcPathIsHomepage && global.mcPathIsHomepage()) return true;
    } catch (e) {}
    return false;
  }

  function isCategoryPlp() {
    try {
      var p = String(global.location.pathname || "").toLowerCase();
      return /-s\//.test(p) && /\.html?/i.test(p);
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
    if (root && el.parentNode !== root) {
      root.appendChild(el);
    } else if (root && el !== root.lastElementChild) {
      root.appendChild(el);
    }
  }

  function styleWrap(wrap, tile, stage) {
    if (!wrap || !wrap.closest || !wrap.closest(".v-product-grid")) return;
    if (wrap.closest("#v65-product-related")) return;
    if (wrap.tagName && wrap.tagName.toLowerCase() !== "a") {
      var innerA = wrap.querySelector("a.v-product__img");
      if (innerA) wrap = innerA;
    }
    wrap.classList.add("mc-plp-thumb-mat");
    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("align-items", "flex-end", "important");
    wrap.style.setProperty("justify-content", "center", "important");
    wrap.style.setProperty("background", "transparent", "important");
    wrap.style.setProperty("background-color", "transparent", "important");
    wrap.style.setProperty("height", tile + "px", "important");
    wrap.style.setProperty("min-height", tile + "px", "important");
    wrap.style.setProperty("max-height", tile + "px", "important");
    wrap.style.setProperty("padding", "0 0 8px", "important");
    wrap.style.setProperty("overflow", "hidden", "important");
    wrap.style.setProperty("box-sizing", "border-box", "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("margin", "0", "important");
    var img = wrap.querySelector("img");
    if (!img) return;
    try {
      img.removeAttribute("style");
      img.removeAttribute("border");
    } catch (eAttr) {}
    img.style.setProperty("border", "0", "important");
    img.style.setProperty("border-width", "0", "important");
    img.style.setProperty("outline", "0", "important");
    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center bottom", "important");
    img.style.setProperty("height", stage + "px", "important");
    img.style.setProperty("max-height", stage + "px", "important");
    img.style.setProperty("width", "auto", "important");
    img.style.setProperty("max-width", IMG_MAX_W, "important");
    img.style.setProperty("min-height", "0", "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("margin", "0 auto", "important");
    img.style.setProperty("background", "transparent", "important");
    img.style.setProperty("background-color", "transparent", "important");
  }

  function hideHero() {
    if (isHome() && !isCategoryPlp()) return;
    global.document.documentElement.classList.remove("mc-allow-home-hero");
    if (global.document.body) global.document.body.classList.remove("is-home");
    document.querySelectorAll(HERO_SEL).forEach(function (n) {
      n.style.setProperty("display", "none", "important");
      n.style.setProperty("visibility", "hidden", "important");
      n.style.setProperty("height", "0", "important");
      n.style.setProperty("min-height", "0", "important");
      n.style.setProperty("max-height", "0", "important");
      n.style.setProperty("margin", "0", "important");
      n.style.setProperty("padding", "0", "important");
      n.style.setProperty("opacity", "0", "important");
      n.style.setProperty("overflow", "hidden", "important");
      n.style.setProperty("background", "transparent", "important");
      n.style.setProperty("border", "0", "important");
    });
    var sc = document.getElementById("slideshow-container");
    if (sc) {
      sc.style.setProperty("min-height", "0", "important");
      sc.style.setProperty("max-height", "0", "important");
    }
  }

  function applyInline() {
    markCategory();
    var mobile = global.innerWidth <= 991;
    var tile = mobile ? TILE_M : TILE;
    var stage = mobile ? STAGE_M : STAGE;

    document.querySelectorAll(WRAP_SEL).forEach(function (wrap) {
      styleWrap(wrap, tile, stage);
    });

    hideHero();

    var logo = document.getElementById("display_homepage_title");
    if (logo) {
      logo.style.setProperty("display", "none", "important");
      logo.style.setProperty("height", "0", "important");
      logo.style.setProperty("opacity", "0", "important");
    }
  }

  function run() {
    markCategory();
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
    if (document.documentElement) {
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  global.mcPlpEnforcerRun = run;
})(window);
