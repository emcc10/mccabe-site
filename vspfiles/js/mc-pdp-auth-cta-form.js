/**
 * PDP auth entry — once-loader for baked double-inject pages.
 * Alexandria / Barron / SS sofas: baked HTML strip+reinjects this file twice and
 * sticky CDN enforcer + MutationObserver thrash freeze the main thread.
 * This stub is cheap to load twice; impl loads once; MOs are neutered on SS PDPs
 * so layout can finish without the observer death-spiral.
 * MC_PDP_AUTH_ONCE_20260727014alex2
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
        "body.mc-product-page #if_homepage,body.productdetails #if_homepage," +
        "body.mc-product-page aside.vol-list-grid,body.productdetails aside.vol-list-grid," +
        "body.mc-product-page .vol-list-grid.text-right,body.productdetails .vol-list-grid.text-right{" +
        "display:none!important;height:0!important;min-height:0!important;max-height:0!important;" +
        "margin:0!important;padding:0!important;overflow:hidden!important}" +
        "body.mc-product-page header.header,body.productdetails header.header{min-height:0!important}" +
        "body.mc-product-page .container.container--content{padding-top:0!important;margin-top:0!important}" +
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

  /* MC_CHECKOUT_MAIN_PROMO_20260802: main-site coupon box via cache-busted stub */
  try {
    var pathPromo = String((global.location && global.location.pathname) || "");
    var searchPromo = String((global.location && global.location.search) || "");
    if (
      /\/one-page-checkout\.asp/i.test(pathPromo) &&
      !/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(searchPromo) &&
      !global.__MC_CHECKOUT_MAIN_PROMO_LOADING__ &&
      !(global.document && global.document.querySelector('script[src*="mc-checkout-main-promo.js"]'))
    ) {
      global.__MC_CHECKOUT_MAIN_PROMO_LOADING__ = true;
      var promoScript = global.document.createElement("script");
      promoScript.id = "mc-checkout-main-promo-js";
      promoScript.src =
        "/v/vspfiles/js/mc-checkout-main-promo.js?v=20260802promo1&mcrd=" + Date.now();
      promoScript.async = false;
      (global.document.head || global.document.documentElement).appendChild(promoScript);
    }
  } catch (ePromoBoot) {}

  /* MC_ALT_VIEW_FLASH6_20260802: CF still HITs baked plp-enforcer?v=20260725fix3
     which re-injects alt-view-row.js on a timer (Peter Rabbit flash). Trap that
     upgrade fingerprint, hide the rail until flash6 marks ready, and load a
     uniquely named owner. */
  try {
    var pathAlt = String((global.location && global.location.pathname) || "");
    if (/product-p\/|productdetails|ProductDetails/i.test(pathAlt)) {
      global.__MC_TMH_ALT_VIEW_ROW_20260728altfix2__ = true;
      global.__MC_TMH_ALT_VIEW_ROW_20260728altfix1__ = true;
      global.__MC_TMH_ALT_VIEW_ROW_20260727fixflash1__ = true;
      global.__MC_TMH_ALT_VIEW_ROW_20260725fix2__ = true;
      global.__MC_TMH_ALT_VIEW_ROW_20260725fix3__ = true;
      try {
        /* Old CF plp upgradeAltViewRow returns early when attribute === WANT. */
        global.document.documentElement.setAttribute(
          "data-mc-plp-altrow-upgrade",
          "20260725fix3"
        );
      } catch (ePlpTrap) {}
      if (!global.document.getElementById("mc-alt-flash6-early-css")) {
        var altCss = global.document.createElement("style");
        altCss.id = "mc-alt-flash6-early-css";
        altCss.textContent =
          "#altviews,.altviews{display:none!important;visibility:hidden!important;height:0!important;" +
          "overflow:hidden!important}" +
          "#mc-pdp-alt-view-row-host:not([data-mc-alt-ready=\"1\"]),#mc-pdp-alt-view-row:not([data-mc-alt-ready=\"1\"]){" +
          "opacity:0!important;visibility:hidden!important;pointer-events:none!important}" +
          "#mc-pdp-alt-view-row-host,#mc-pdp-alt-view-row,#mc-pdp-alt-view-row a,#mc-pdp-alt-view-row img{" +
          "transition:none!important;animation:none!important}";
        (global.document.head || global.document.documentElement).appendChild(altCss);
      }
      function stripCompetingAltViewScripts() {
        try {
          global.document
            .querySelectorAll(
              'script[src*="mc-pdp-alt-view-row.js"], script[src*="mc-pdp-alt-view-row-20260802flash4.js"], script[src*="mc-pdp-alt-view-row-20260802flash5.js"]'
            )
            .forEach(function (old) {
              var src = String(old.getAttribute("src") || "");
              if (/mc-pdp-alt-view-row-20260802flash6\.js/i.test(src)) return;
              try {
                old.remove();
              } catch (eRm) {}
            });
        } catch (eStripAlt) {}
      }
      stripCompetingAltViewScripts();
      try {
        if ((Number(global.__MC_ALT_VIEW_ROW_VER__ || 0) || 0) < 20260805) {
          global.__MC_ALT_VIEW_ROW_LOCK__ = false;
          global.__MC_ALT_VIEW_ROW_OWNED__ = false;
          global.__MC_ALT_VIEW_ROW_GEN__ =
            (Number(global.__MC_ALT_VIEW_ROW_GEN__ || 0) || 0) + 1;
        }
      } catch (eUnlock) {}
      if (
        !global.__MC_ALT_VIEW_FLASH6_LOADING__ &&
        !(
          global.document &&
          global.document.querySelector('script[src*="mc-pdp-alt-view-row-20260802flash6.js"]')
        )
      ) {
        global.__MC_ALT_VIEW_FLASH6_LOADING__ = true;
        var altScript = global.document.createElement("script");
        altScript.id = "mc-pdp-alt-view-row-flash6-js";
        altScript.src =
          "/v/vspfiles/js/mc-pdp-alt-view-row-20260802flash6.js?v=1&mcrd=" + Date.now();
        altScript.async = false;
        (global.document.head || global.document.documentElement).appendChild(altScript);
      }
      if (!global.__MC_ALT_VIEW_FLASH6_MO__ && global.MutationObserver && global.document.documentElement) {
        global.__MC_ALT_VIEW_FLASH6_MO__ = true;
        try {
          var altMo = new global.MutationObserver(function () {
            stripCompetingAltViewScripts();
            try {
              global.document.documentElement.setAttribute(
                "data-mc-plp-altrow-upgrade",
                "20260725fix3"
              );
            } catch (eReTrap) {}
          });
          altMo.observe(global.document.documentElement, { childList: true, subtree: true });
        } catch (eAltMo) {}
        [200, 600, 1200, 2500, 5000].forEach(function (ms) {
          global.setTimeout(stripCompetingAltViewScripts, ms);
        });
      }
    }
  } catch (eAltFlash6) {}

  try {
    if (global.document && global.document.querySelector('script[src*="mc-pdp-auth-cta-form-impl.js"]')) {
      fixAlexandriaHero();
      return;
    }
  } catch (eHas) {}

  var IMPL = "/v/vspfiles/js/mc-pdp-auth-cta-form-impl.js?v=20260802flash6&mcrd=flash6";
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