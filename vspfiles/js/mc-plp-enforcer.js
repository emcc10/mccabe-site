/**
 * PLP category layout — matches template critical CSS (280px mat / 220px stage).
 * MC_PLP_ENFORCER_20260523
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
  var PAD = 14;
  var PAD_M = 12;

  var WRAP_SEL =
    "#content_area .v-product-grid a.v-product__img," +
    "#content_area .v-product-grid .v-product__img";

  var HERO_SEL =
    "#if_homepage,#slideshow-container,#slideshow-container .mc-hero-video," +
    ".mc-hero-video,video.mc-hero-video-el,.mc-hero-video-el";

  var FINAL_CSS =
    "/* MC PLP THUMBNAIL CLEANUP 20260518 */" +
    "html[data-mc-category-plp='1'] #content_area>table>tbody>tr>td.colors_lines_light," +
    "html[data-mc-category-plp='1'] #content_area>table>tr>td.colors_lines_light," +
    "html.category #content_area>table>tbody>tr>td.colors_lines_light{display:none!important;height:0!important;" +
    "padding:0!important;margin:0!important;border:0!important;background:transparent!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product{background:transparent!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img," +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product__img," +
    "html.category #content_area .v-product-grid a.v-product__img{" +
    "display:flex!important;align-items:flex-end!important;justify-content:center!important;" +
    "width:100%!important;height:" +
    TILE +
    "px!important;min-height:" +
    TILE +
    "px!important;max-height:" +
    TILE +
    "px!important;margin:0!important;padding:" +
    PAD +
    "px!important;overflow:hidden!important;box-sizing:border-box!important;" +
    "background:" +
    MAT +
    "!important;background-color:" +
    MAT +
    "!important;border:0!important;box-shadow:none!important;line-height:0!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img>img," +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid .v-product__img img," +
    "html.category #content_area .v-product-grid a.v-product__img>img{" +
    "height:" +
    STAGE +
    "px!important;max-height:" +
    STAGE +
    "px!important;width:auto!important;max-width:100%!important;min-height:0!important;" +
    "object-fit:contain!important;object-position:center bottom!important;" +
    "display:block!important;margin:0 auto!important;background:transparent!important;" +
    "background-color:transparent!important;border:0!important;box-shadow:none!important}" +
    "@media(max-width:991px){html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img," +
    "html.category #content_area .v-product-grid a.v-product__img{height:" +
    TILE_M +
    "px!important;min-height:" +
    TILE_M +
    "px!important;max-height:" +
    TILE_M +
    "px!important;padding:" +
    PAD_M +
    "px!important}" +
    "html[data-mc-category-plp='1'] #content_area .v-product-grid a.v-product__img>img," +
    "html.category #content_area .v-product-grid a.v-product__img>img{height:" +
    STAGE_M +
    "px!important;max-height:" +
    STAGE_M +
    "px!important}}" +
    "html[data-mc-category-plp='1'] #if_homepage,html[data-mc-category-plp='1'] #slideshow-container," +
    "html[data-mc-category-plp='1'] video.mc-hero-video-el,html.category #slideshow-container," +
    "html.category video.mc-hero-video-el{display:none!important;height:0!important;min-height:0!important;" +
    "opacity:0!important;overflow:hidden!important;background:transparent!important}";

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

  /** Volusion listing HTML: remove divider <tr> after breadcrumbs (colors_lines_light). */
  function removeListingDividerRow() {
    if (!isCategoryPlp()) return;
    document.querySelectorAll("#content_area > table").forEach(function (table) {
      if (table.getAttribute("data-mc-divider-removed")) return;
      var i;
      for (i = 0; i < table.rows.length; i++) {
        var tr = table.rows[i];
        if (tr.cells.length !== 1) continue;
        var td = tr.cells[0];
        if (!td.classList.contains("colors_lines_light")) continue;
        var img = td.querySelector("img");
        if (img && /clear1x1\.gif/i.test(img.getAttribute("src") || "")) {
          tr.parentNode.removeChild(tr);
          table.setAttribute("data-mc-divider-removed", "1");
          break;
        }
      }
    });
  }

  function styleThumb(wrap, tile, stage, pad) {
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
    wrap.style.setProperty("margin", "0", "important");

    var img = wrap.querySelector("img");
    if (!img) return;
    try {
      img.removeAttribute("style");
      img.removeAttribute("border");
    } catch (eAttr) {}

    img.style.setProperty("height", stage + "px", "important");
    img.style.setProperty("max-height", stage + "px", "important");
    img.style.setProperty("width", "auto", "important");
    img.style.setProperty("max-width", "100%", "important");
    img.style.setProperty("min-height", "0", "important");
    img.style.setProperty("object-fit", "contain", "important");
    img.style.setProperty("object-position", "center bottom", "important");
    img.style.setProperty("display", "block", "important");
    img.style.setProperty("margin", "0 auto", "important");
    img.style.setProperty("background", "transparent", "important");
    img.style.setProperty("background-color", "transparent", "important");
    img.style.setProperty("border", "0", "important");
    img.style.setProperty("box-shadow", "none", "important");
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
    var tile = mobile ? TILE_M : TILE;
    var stage = mobile ? STAGE_M : STAGE;
    var pad = mobile ? PAD_M : PAD;

    document.querySelectorAll(WRAP_SEL).forEach(function (wrap) {
      styleThumb(wrap, tile, stage, pad);
    });
  }

  function run() {
    markCategory();
    removeListingDividerRow();
    injectFinalStyle();
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
