/**
 * PDP auth entry — once-loader for baked double-inject pages.
 * Alexandria / Barron / SS sofas: baked HTML strip+reinjects this file twice and
 * sticky CDN enforcer + MutationObserver thrash freeze the main thread.
 * This stub is cheap to load twice; impl loads once; MOs are neutered on SS PDPs
 * so layout can finish without the observer death-spiral.
 * MC_PDP_AUTH_ONCE_20260727013alex1
 * mcEnsurePdpPriceStack — provided by mc-pdp-auth-cta-form-impl.js
 */
(function (global) {
  "use strict";

  function isSteveSilverPdp() {
    try {
      var p = String((global.location && global.location.pathname) || "").toLowerCase();
      if (/\/product-p\/ss-/.test(p)) return true;
      var pc = global.document && global.document.querySelector(
        '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]'
      );
      return /^SS-/.test(String((pc && pc.value) || "").toUpperCase());
    } catch (eSs) {}
    return false;
  }

  try {
    var prevPlp = parseInt(String(global.__MC_PLP_ENFORCER_VER__ || "").replace(/\D/g, ""), 10);
    if (!(prevPlp >= 20269999999)) {
      global.__MC_PLP_ENFORCER_VER__ = "20269999999alex1";
    }
    global.mcPlpEnforcerRun = function () {};
    global.mcStripPriceZeroCents = function () {};
  } catch (eLatch) {}

  /* SS PDPs: MutationObserver thrash in auth freezes Alexandria/Barron. */
  if (isSteveSilverPdp() && !global.__MC_SS_MO_NEUTER__) {
    try {
      global.__MC_SS_MO_NEUTER__ = true;
      global.MutationObserver = function () {
        this.observe = function () {};
        this.disconnect = function () {};
        this.takeRecords = function () {
          return [];
        };
      };
    } catch (eMo) {}
  }

  /* Collapse reserved empty chrome that shows as a giant white gap when hero lags. */
  try {
    if (isSteveSilverPdp() && global.document && !global.document.getElementById("mc-ss-pdp-gap-kill")) {
      var st = global.document.createElement("style");
      st.id = "mc-ss-pdp-gap-kill";
      st.textContent =
        "body.mc-product-page #slideshow-container,body.productdetails #slideshow-container," +
        "body.mc-product-page #if_homepage,body.productdetails #if_homepage{" +
        "display:none!important;height:0!important;min-height:0!important;max-height:0!important;" +
        "margin:0!important;padding:0!important;overflow:hidden!important}" +
        "body.mc-product-page header.header,body.productdetails header.header{min-height:0!important}" +
        "body.mc-product-page #product_photo,body.productdetails #product_photo{" +
        "max-width:100%!important;height:auto!important;object-fit:contain!important}";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
  } catch (eCss) {}

  function fixAlexandriaHero() {
    try {
      var onAlex =
        /ss-alex/i.test(String(global.location.pathname || "")) ||
        /SS-ALEX/i.test(
          String(
            (
              global.document.querySelector(
                '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]'
              ) || {}
            ).value || ""
          )
        );
      if (!onAlex) return;
      var img = global.document.getElementById("product_photo");
      if (!img) return;
      var src = String(img.getAttribute("src") || img.src || "");
      var broken = !img.naturalWidth || /\/SS-ALEX[^"'?\s]*-2T?\.(jpg|jpeg|png|webp)/i.test(src);
      if (!broken && !/\/SS-ALEX[^"'?\s]*-2T?\./i.test(src)) return;
      var fixed = src
        .replace(/\/SS-ALEX([^/"']*?)-2T\.(jpg|jpeg|png|webp)/i, "/SS-ALEX$1-1.$2")
        .replace(/\/SS-ALEX([^/"']*?)-2\.(jpg|jpeg|png|webp)/i, "/SS-ALEX$1-1.$2");
      if (!/SS-ALEX/i.test(fixed) || fixed === src) {
        /* Build from product code when src is empty/odd. */
        var pc = String(
          (
            global.document.querySelector(
              '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]'
            ) || {}
          ).value || ""
        ).toUpperCase();
        if (/^SS-ALEX/.test(pc)) {
          fixed = "/v/vspfiles/photos/" + pc + "-1.jpg";
        }
      }
      if (fixed && fixed !== src) {
        img.setAttribute("src", fixed);
        img.src = fixed;
        img.removeAttribute("srcset");
      }
      var link = img.closest && img.closest("a");
      if (link) {
        var href = String(link.getAttribute("href") || "");
        if (/SS-ALEX[^"'?\s]*-2/i.test(href) || !href) {
          link.setAttribute(
            "href",
            href
              ? href
                  .replace(/\/SS-ALEX([^/"']*?)-2T\.(jpg|jpeg|png|webp)/i, "/SS-ALEX$1-1.$2")
                  .replace(/\/SS-ALEX([^/"']*?)-2\.(jpg|jpeg|png|webp)/i, "/SS-ALEX$1-1.$2")
              : fixed
          );
        }
      }
    } catch (eHero) {}
  }

  if (global.__MC_PDP_AUTH_ONCE_LOADER__) {
    fixAlexandriaHero();
    return;
  }
  global.__MC_PDP_AUTH_ONCE_LOADER__ = true;

  try {
    if (global.document && global.document.querySelector('script[src*="mc-pdp-auth-cta-form-impl.js"]')) {
      fixAlexandriaHero();
      return;
    }
  } catch (eHas) {}

  var IMPL = "/v/vspfiles/js/mc-pdp-auth-cta-form-impl.js?v=20260725alex1&mcrd=alex1";
  try {
    var s = global.document.createElement("script");
    s.id = "mc-pdp-auth-cta-form-impl-js";
    s.src = IMPL;
    s.async = false;
    s.onload = function () {
      fixAlexandriaHero();
      [0, 200, 800, 1600].forEach(function (ms) {
        global.setTimeout(fixAlexandriaHero, ms);
      });
    };
    (global.document.head || global.document.documentElement).appendChild(s);
  } catch (eBoot) {}

  fixAlexandriaHero();
  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", fixAlexandriaHero);
  }
  [0, 300, 1000, 2500, 5000, 9000].forEach(function (ms) {
    global.setTimeout(fixAlexandriaHero, ms);
  });
})(window);
