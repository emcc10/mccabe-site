/**
 * PDP Sign In / Create Account — modal only, no /login.asp redirect, no room planner on gate clicks.
 * Post-login: close modal first, refresh member/planner pricing in background (works without template rebake).
 * MC_PDP_AUTH_CTA_20260624 — price stack repair MC_PDP_PRICE_STACK_20260522 (no template rebake)
 */
(function (global) {
  "use strict";

  // MC_DEPLOY_FINGERPRINT_20260725bbatc3 — restore bean bag ATC/qty purchase stack
  var MC_DEPLOY_FINGERPRINT = "20260725bbatc3";
  var VERSION = "20260725bbatc3";
  /* Prefer numeric deploy rank so old labels like style1/restore15 cannot
     lexicographically beat a newer fix* VERSION and keep this IIFE from booting. */
  var DEPLOY_RANK = 20260725020;
  try {
    var prevRank = Number(global.__MC_PDP_AUTH_CTA_DEPLOY_RANK__ || 0) || 0;
    if (prevRank >= DEPLOY_RANK) return;
    global.__MC_PDP_AUTH_CTA_DEPLOY_RANK__ = DEPLOY_RANK;
    global.__MC_PDP_AUTH_CTA_MAX_VER__ = VERSION;
  } catch (eMax) {}
  /* Baked Volusion pages still inject ancient mc-pdp-auth-cta-fix.js (?v=sarmob1).
     Remove those tags so only this generation owns PDP layout. */
  try {
    global.document.querySelectorAll('script[src*="mc-pdp-auth-cta-fix.js"]').forEach(function (old) {
      var src = String(old.getAttribute("src") || "");
      if (src.indexOf(VERSION) !== -1) return;
      try { old.remove(); } catch (eRmFix) {}
    });
  } catch (eStripFix) {}

  /* Same guard as mc-sectional-pdp-emergency.js — only load on sectional configurator PDPs */
  (function () {
    if (global.__MC_SECTIONAL_INSERT_BEFORE_PATCH__) return;
    if (global.__MC_SECTIONAL_EMERGENCY_LOADING__ || global.__MC_SECTIONAL_EMERGENCY_LOADED__) return;
    if (global.document && global.document.querySelector('script[src*="mc-sectional-pdp-emergency.js"]')) return;
    try {
      if (typeof global.window.isSectionalProductPage === "function") {
        if (!global.window.isSectionalProductPage()) return;
      } else {
        var pLoad = String(global.location.pathname || "").toLowerCase();
        if (pLoad.indexOf("room-planner") !== -1 || pLoad.indexOf("-sc-") === -1) return;
      }
    } catch (eSecLoad) {
      return;
    }
    global.__MC_SECTIONAL_EMERGENCY_LOADING__ = true;
    try {
      var s = global.document.createElement("script");
      s.src = "/v/vspfiles/js/mc-sectional-pdp-emergency.js?v=20260603e&mcrd=" + Date.now();
      s.async = false;
      s.onload = function () {
        global.__MC_SECTIONAL_EMERGENCY_LOADED__ = true;
      };
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eEmer) {}
  })();

  // MC_PDP_AUTH_DEPLOY_VERIFY_20260626sarrepair15
  global.__MC_DEPLOY_FP__ = MC_DEPLOY_FINGERPRINT;
  global.__MC_PDP_AUTH_ACTIVE_GEN__ = (global.__MC_PDP_AUTH_ACTIVE_GEN__ || 0) + 1;
  /* MC_SS_FRAME_SCHED_20260722manual4 */

  try {
    markGameRoomBarPdpPage();
    markCloseoutPdpPage();
    applySteveSilverBarSetFrame();
    alignSaranoniInfoToHeroTop();
    [0, 150, 400, 900, 1600, 2800, 4500, 7000].forEach(function (ms) {
      global.setTimeout(function () {
        try {
          markGameRoomBarPdpPage();
          markCloseoutPdpPage();
          applySteveSilverBarSetFrame();
          alignSaranoniInfoToHeroTop();
          if (typeof hideSaranoniStrayVariantLabels === "function") hideSaranoniStrayVariantLabels();
          ensureSaranoniPdpAccordion();
          try {
            if (typeof isSaranoniPdpPage === "function" && isSaranoniPdpPage()) {
              ensureSaranoniVariantsBelowPrice();
            }
          } catch (eSarOrdTick) {}
          if (typeof isHumidorOrSaunaPdpPage === "function" && isHumidorOrSaunaPdpPage()) {
            ensureSteveSilverHeroImageSize();
          } else if (typeof applyPdpMainImageCap === "function") {
            applyPdpMainImageCap();
          }
        } catch (eTick) {}
      }, ms);
    });
  } catch (eBootSs) {}

  var SCRIPT_GEN = global.__MC_PDP_AUTH_ACTIVE_GEN__;
  try {
    if (global.__MC_PDP_LAYOUT_MO__) {
      global.__MC_PDP_LAYOUT_MO__.disconnect();
      global.__MC_PDP_LAYOUT_MO__ = null;
    }
  } catch (eCancelMo) {}

  function isStalePdpAuthRun() {
    return global.__MC_PDP_AUTH_ACTIVE_GEN__ !== SCRIPT_GEN;
  }

  (function mcAtcEarlyImageConvert() {
    function go() {
      if (!global.document) return;
      global.document
        .querySelectorAll('#v65-product-parent input[name="btnaddtocart"], input[name="btnaddtocart"]')
        .forEach(function (btn) {
          if ((btn.type || "").toLowerCase() !== "image") return;
          try {
            btn.type = "submit";
          } catch (eTyp) {}
          btn.removeAttribute("src");
          if (!btn.value) btn.value = "ADD TO CART";
        });
    }
    go();
    if (global.document && global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", go);
    }
    global.addEventListener("load", go);
  })();
  var PDP_CHROME_BORDER = "#e0e0e0";
  var PDP_CONFIGURED_COLOR_SWATCHS = {
    "SAR-CHNK-KNT-LG": [
      {
        optionId: "1012",
        label: "Moonbeam",
        swatchImage: "SAR-CHNK-KNT-LG-1012-S.jpg",
        mainImage: "SAR-CHNK-KNT-LG-1012-T.jpg",
      },
    ],
  };
  // When a configured-color swatch is chosen we "lock" that selection so that
  // MutationObserver-driven re-renders (and Volusion's async option-image logic)
  // cannot wipe the active swatch or blank the hero image.
  var configuredColorActiveEntry = null;
  var configuredColorActiveSrc = "";
  var configuredColorDefaultSrc = "";
  var configuredColorLastAppliedOptionId = "";
  var configuredColorEnforceUntil = 0;
  var configuredColorEnforceTimer = null;
  var PDP_HERO_ANTIFLICKER_SEL =
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-brand-logo,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-brand-logo," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-title-right,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-title-right," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) h1[itemprop='name'],body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) h1[itemprop='name']," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-price-stack-host,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-price-stack-host," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #beanbag-swatch-wrapper,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #beanbag-swatch-wrapper," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-features,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-features," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-purchase-stack," +
    "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) .mc-unified-purchase-controls,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) .mc-unified-purchase-controls";
  /* Set immediately so console/deploy checks work even if later init throws */
  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;

  function normalizePhotoUrl(url) {
    return String(url || "")
      .replace(/\?.*$/, "")
      .split("#")[0];
  }

  function setProductPhotoSrcIfChanged(img, url) {
    if (!img || !url) return false;
    var target = normalizePhotoUrl(url);
    var cur = normalizePhotoUrl(img.getAttribute("src") || img.src || "");
    if (cur === target) return false;
    img.setAttribute("src", url);
    img.src = url;
    img.removeAttribute("srcset");
    return true;
  }

  function setLinkHrefIfChanged(link, url) {
    if (!link || !url) return false;
    var target = normalizePhotoUrl(url);
    var cur = normalizePhotoUrl(link.getAttribute("href") || "");
    if (cur === target) return false;
    link.setAttribute("href", url);
    return true;
  }

  global.mcNormalizePhotoUrl = normalizePhotoUrl;
  global.mcSetProductPhotoSrcIfChanged = setProductPhotoSrcIfChanged;
  global.mcSetLinkHrefIfChanged = setLinkHrefIfChanged;

  (function injectPdpHeroAntiFlickerEarly() {
    try {
      if (!global.document || global.document.getElementById("mc-pdp-hero-antiflicker-css")) return;
      var path = String(global.location.pathname || "").toLowerCase();
      if (!/(?:-p\/|product-p\/)/.test(path)) return;
      var tmhPc = String(global.global_Current_ProductCode || "").toUpperCase();
      if (!tmhPc) {
        var tmhPcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
        tmhPc = String((tmhPcEl && tmhPcEl.value) || "").toUpperCase();
      }
      if (/^TMH-/.test(tmhPc) || /\/product-p\/tmh-|mahjong/.test(path)) return;
      var body = global.document.body;
      if (body) body.classList.add("mc-pdp-hero-pending");
      var st = global.document.createElement("style");
      st.id = "mc-pdp-hero-antiflicker-css";
      st.textContent =
        PDP_HERO_ANTIFLICKER_SEL + "{visibility:hidden!important}" +
        "body.productdetails td.mc-pdp-media-td img[src*='/manufacturers/'],body.mc-product-page td.mc-pdp-media-td img[src*='/manufacturers/']," +
        "body.productdetails #product_photo_td img[src*='/manufacturers/'],body.mc-product-page #product_photo_td img[src*='/manufacturers/']{" +
        "display:none!important;height:0!important;width:0!important;margin:0!important;padding:0!important;overflow:hidden!important}";
      (global.document.head || global.document.documentElement).appendChild(st);
      if (!global.__MC_PDP_HERO_READY_FALLBACK__) {
        global.__MC_PDP_HERO_READY_FALLBACK__ = true;
        global.setTimeout(function () {
          if (global.__MC_PDP_HERO_READY_LOCKED__) return;
          try {
            if (shouldDeferToUnifiedPdpLayout() || isFixedSectionalUnifiedPdp()) {
              prepareDeferredUnifiedPdpHero();
              ensureUnifiedPdpLayout();
              if (typeof global.mcNormalizePdpLayout === "function") {
                global.mcNormalizePdpLayout();
              }
            }
          } catch (eAfFb) {}
          if (!global.__MC_PDP_HERO_READY_LOCKED__) {
            if (isFixedSectionalUnifiedPdp() && !isUnifiedPdpReady()) {
              retryDeferredUnifiedNormalize();
            } else {
              markPdpHeroReady();
            }
          }
        }, 2200);
      }
    } catch (eAf) {}
  })();

  (function injectMahjongPdpAntiFlickerEarly() {
    try {
      var d = global.document;
      if (!d || d.getElementById("mc-mahjong-pdp-antiflicker-css")) return;
      var path = String(global.location.pathname || "").toLowerCase();
      if (!/(?:-p\/|product-p\/)/.test(path)) return;
      var pc = "";
      try {
        pc = String(global.global_Current_ProductCode || "").toUpperCase();
        if (!pc) {
          var pcEl = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
          pc = String((pcEl && pcEl.value) || "").toUpperCase();
        }
      } catch (ePc) {}
      if (!/^TMH-/.test(pc) && !/\/product-p\/tmh-|mahjong/.test(path)) return;
      if (d.documentElement) {
        d.documentElement.classList.add("mc-mahjong-pdp-init");
      }
      if (d.body) {
        d.body.classList.add("mc-mahjong-house-pdp", "mc-mahjong-pdp-init");
      }
      var st = d.createElement("style");
      st.id = "mc-mahjong-pdp-antiflicker-css";
      st.textContent =
        "html:has(#v65-product-parent input[name=\"ProductCode\"][value^=\"TMH-\"]):not(.mc-mahjong-pdp-ready) #ProductDetail_ProductDetails_div2," +
        "html:has(#v65-product-parent input[name=\"ProductCode\"][value^=\"TMH-\"]):not(.mc-mahjong-pdp-ready) #Header_ProductDetail_ProductDetails," +
        "html:has(#v65-product-parent input[name=\"ProductCode\"][value^=\"TMH-\"]):not(.mc-mahjong-pdp-ready) td#Header_ProductDetail_ProductDetails," +
        "html:has(#v65-product-parent input[name=\"ProductCode\"][value^=\"TMH-\"]):not(.mc-mahjong-pdp-ready) #v65-product-parent > tbody > tr > td:first-child table.colors_descriptionbox," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #ProductDetail_ProductDetails_div2," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #Header_ProductDetail_ProductDetails," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) td#Header_ProductDetail_ProductDetails," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #v65-product-parent > tbody > tr > td:first-child table.colors_descriptionbox," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #v65-product-parent td.mc-unified-pdp-media table.colors_descriptionbox," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #v65-product-parent td.mc-pdp-media-td table.colors_descriptionbox," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #v65-product-parent > tbody > tr > td:first-child #ProductDetail_ProductDetails_div," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) td.mc-unified-pdp-info > #mc-pdp-description-below-features," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) td.mc-pdp-options-td > #mc-pdp-description-below-features," +
        "html.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #mc-pdp-accordion," +
        "html body.mc-mahjong-pdp-init:not(.mc-mahjong-pdp-ready) #mc-pdp-accordion{" +
        "display:none!important}" +
        "html.mc-mahjong-pdp-init #mc-pdp-accordion .mc-acc-row[data-open='0']>.mc-acc-panel," +
        "html body.mc-mahjong-pdp-init #mc-pdp-accordion .mc-acc-row[data-open='0']>.mc-acc-panel{" +
        "display:none!important}";
      (d.head || d.documentElement).appendChild(st);
      function hideTmhNativeLeftColumnUi() {
        try {
          ["#ProductDetail_ProductDetails_div2", "#Header_ProductDetail_ProductDetails"].forEach(function (sel) {
            var el = d.querySelector(sel);
            if (el && el.style) el.style.setProperty("display", "none", "important");
          });
          var firstTd = d.querySelector("#v65-product-parent > tbody > tr > td:first-child");
          if (firstTd) {
            firstTd.querySelectorAll("table.colors_descriptionbox").forEach(function (box) {
              if (box && box.style) box.style.setProperty("display", "none", "important");
            });
          }
        } catch (eHide) {}
      }
      hideTmhNativeLeftColumnUi();
      if (d.readyState === "loading") {
        d.addEventListener("DOMContentLoaded", hideTmhNativeLeftColumnUi);
      }
    } catch (eTmhAf) {}
  })();

  function markPdpHeroReady() {
    try {
      var body = global.document.body;
      if (!body) return;
      body.classList.remove("mc-pdp-hero-pending");
      body.classList.add("mc-pdp-hero-ready");
      global.__MC_PDP_HERO_READY_LOCKED__ = true;
    } catch (eReady) {}
  }

  function scheduleMarkPdpHeroReady() {
    if (global.__MC_PDP_HERO_READY_LOCKED__) return;
    if (global.__MC_PDP_HERO_READY_TIMER__) {
      global.clearTimeout(global.__MC_PDP_HERO_READY_TIMER__);
    }
    global.__MC_PDP_HERO_READY_TIMER__ = global.setTimeout(function () {
      global.__MC_PDP_HERO_READY_TIMER__ = null;
      if (global.__MC_PDP_HERO_READY_LOCKED__) return;
      if (!isPdpPurchaseLayoutReady()) {
        scheduleMarkPdpHeroReady();
        return;
      }
      function reveal() {
        try {
          if (!global.__MC_PDP_HERO_READY_LOCKED__) {
            syncPdpHeroTopAlign();
          }
        } catch (eAlign) {}
        markPdpHeroReady();
      }
      if (typeof global.requestAnimationFrame === "function") {
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(reveal);
        });
      } else {
        reveal();
      }
    }, 400);
  }

  function isPdpPurchaseLayoutReady() {
    var root = global.document.getElementById("v65-product-parent");
    if (!root) return true;
    if (
      !root.querySelector(
        'input[name="btnaddtocart"], button[name="btnaddtocart"], input[id*="btnaddtocart"]'
      )
    ) {
      return true;
    }
    if (isBeanBagPdpPage()) {
      return !!(
        global.document.getElementById("mc-pdp-price-atc-row") ||
        global.document.getElementById("mc-pdp-purchase-stack") ||
        global.document.querySelector(".mc-unified-purchase-controls")
      );
    }
    if (shouldDeferToUnifiedPdpLayout() || isFixedSectionalUnifiedPdp()) {
      return !!(
        global.document.querySelector(
          ".mc-unified-purchase-controls input[name='btnaddtocart'], .mc-unified-purchase-controls button[name='btnaddtocart']"
        ) || global.document.querySelector(".mc-unified-purchase-controls")
      );
    }
    return !!(
      global.document.getElementById("mc-pdp-purchase-stack") ||
      global.document.querySelector(".mc-unified-purchase-controls")
    );
  }

  function applyPdpTitleTypography() {
    var wrap = global.document.getElementById("mc-pdp-title-right");
    if (!wrap) return;
    try {
      if (!isSaranoniPdpPage()) {
        wrap.style.setProperty("padding-left", "1.1em", "important");
      } else {
        wrap.style.setProperty("padding-left", "0", "important");
      }
      wrap.style.setProperty("padding-right", "0", "important");
      wrap.style.setProperty("margin-left", "0", "important");
    } catch (eWrap) {}
    global.document
      .querySelectorAll(
        "#mc-pdp-title-right h1, #mc-pdp-title-right [itemprop='name'], #mc-pdp-title-right .productnamecolorLARGE, #mc-pdp-title-right .productnamecolor"
      )
      .forEach(function (el) {
        try {
          el.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
          el.style.setProperty("font-size", "15px", "important");
          el.style.setProperty("font-weight", "400", "important");
          el.style.setProperty("line-height", "1.2", "important");
          el.style.setProperty("letter-spacing", "0.16em", "important");
          el.style.setProperty("text-transform", "uppercase", "important");
          el.style.setProperty("color", "#777", "important");
          el.style.setProperty("margin-left", "0", "important");
          el.style.setProperty("padding-left", "0", "important");
          el.style.setProperty("text-align", "left", "important");
        } catch (eTy) {}
      });
  }

  function applyPdpPriceTypography() {
    global.document
      .querySelectorAll(
        "#mc-pdp-price-stack-host .product_list_price, #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt, #mc-pdp-price-stack-host [itemprop='price']"
      )
      .forEach(function (el) {
        try {
          el.style.setProperty("font-size", "20px", "important");
          el.style.setProperty("line-height", "1.55", "important");
          el.style.setProperty("letter-spacing", "0.02em", "important");
          el.style.setProperty("color", "#444", "important");
        } catch (ePr) {}
      });
  }

  function isPdpDescriptionTypographyEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (
      !el.closest(
        "#ProductDetail_ProductDetails_div2, #mc-pdp-description-below-features, .colors_descriptionbox, #content_area span[itemprop='description']"
      )
    ) {
      return false;
    }
    if (el.closest("#beanbag-swatch-wrapper, .beanbag-swatches, .beanbag-swatch")) return false;
    if (el.closest("#mc-pdp-features")) return false;
    var tag = (el.tagName || "").toUpperCase();
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "IMG" || tag === "TABLE" || tag === "TBODY" || tag === "TR" || tag === "TD") {
      return false;
    }
    return true;
  }

  function pruneDescriptionDuplicateFeatures() {
    var feat = global.document.getElementById("mc-pdp-features");
    if (!feat || !feat.querySelector(".mc-pdp-features__list li")) return;
    var liSel =
      "#ProductDetail_ProductDetails_div2 li, #ProductDetail_ProductDetails_div2 span[itemprop='description'] > li";
    var ulSel =
      "#ProductDetail_ProductDetails_div2 ul, #ProductDetail_ProductDetails_div2 span[itemprop='description'] ul";
    if (isBeanBagPdpPage()) {
      liSel +=
        ", #mc-pdp-description-below-features li, #ProductDetail_ProductDetails_div li";
      ulSel +=
        ", #mc-pdp-description-below-features ul, #ProductDetail_ProductDetails_div ul";
    }
    global.document
      .querySelectorAll(liSel)
      .forEach(function (li) {
        if (li.closest("#beanbag-swatch-wrapper, #mc-pdp-features, script, style")) return;
        try {
          li.style.setProperty("display", "none", "important");
        } catch (eHide) {}
      });
    global.document
      .querySelectorAll(ulSel)
      .forEach(function (ul) {
        if (ul.closest("#beanbag-swatch-wrapper, #mc-pdp-features")) return;
        var vis = ul.querySelector("li:not([style*='display: none'])");
        if (!vis) {
          try {
            ul.style.setProperty("display", "none", "important");
          } catch (eUl) {}
        }
      });
  }

  function findPdpMediaTd() {
    return (
      global.document.querySelector("#v65-product-parent td.mc-pdp-media-td") ||
      global.document.getElementById("product_photo_td") ||
      global.document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2) > td:first-child")
    );
  }

  function mountPdpDescriptionUnderMedia() {
    /* Never put product description under the hero. All PDPs use the
       FEATURES + PRODUCT DETAILS accordion in the info column. */
    if (!isProductPdp()) return;
    try {
      var stray = global.document.getElementById("mc-pdp-description-under-media");
      if (stray) {
        stray.style.setProperty("display", "none", "important");
        stray.setAttribute("aria-hidden", "true");
      }
      global.document
        .querySelectorAll(
          "td.mc-unified-pdp-media .mc-unified-pdp-description--media, td.mc-pdp-media-td .mc-unified-pdp-description--media"
        )
        .forEach(function (node) {
          try {
            node.style.setProperty("display", "none", "important");
            node.setAttribute("aria-hidden", "true");
          } catch (eHide) {}
        });
      if (typeof finalizeUnifiedPdpAccordion === "function") finalizeUnifiedPdpAccordion();
    } catch (eUnder) {}
  }

  function fixTmhMatPhotoUrls(root) {
    root = root || global.document;
    function swap2Tto1(el, attr) {
      if (!el || !el.getAttribute) return;
      var val = el.getAttribute(attr) || "";
      if (!/\/TMH-(?:MAT|TRV)-[A-Z0-9-]+-2T\./i.test(val)) return;
      var next = val.replace(/-2T\.(jpg|jpeg|png|webp)/i, "-1.$1");
      if (next === val) return;
      el.setAttribute(attr, next);
      if (attr === "src" && "src" in el) el.src = next;
    }
    swap2Tto1(global.document.getElementById("product_photo"), "src");
    global.document.querySelectorAll("#product_photo_zoom_url, #product_photo_zoom_url2").forEach(function (link) {
      swap2Tto1(link, "href");
    });
    root.querySelectorAll('img[src*="/vspfiles/photos/TMH-"][src*="-2T."]').forEach(function (img) {
      swap2Tto1(img, "src");
    });
  }

  function ensureSteveSilverHeroPhotoSrc() {
    if (!isProductPdp()) return false;
    var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var pc = String(
      (global.global_Current_ProductCode || "") ||
        (pcEl && pcEl.value) ||
        ""
    )
      .trim()
      .toUpperCase();
    if (!/^SS-/.test(pc)) return false;
    var img = global.document.getElementById("product_photo");
    if (!img) return false;
    if (img.__mcSsUserSelectedAlt) return true;
    var full = "/v/vspfiles/photos/" + pc + "-1.jpg";
    var cur = String(img.getAttribute("src") || img.src || "");
    var normalizedCur = cur.replace(/\?.*$/, "").split("#")[0];
    var normalizedFull = full.replace(/\?.*$/, "").split("#")[0];
    var needsSwap =
      /-2T\.|-2\.jpg/i.test(cur) ||
      (normalizedCur.indexOf(pc) !== -1 && normalizedCur.indexOf("-1.") === -1);
    if (needsSwap || normalizedCur !== normalizedFull) {
      try {
        img.setAttribute("src", full);
        img.src = full;
        img.removeAttribute("srcset");
      } catch (eSwap) {}
    }
    global.document
      .querySelectorAll("a#product_photo_zoom_url, a#product_photo_zoom_url2")
      .forEach(function (link) {
        var href = String(link.getAttribute("href") || "");
        if (!href || /-2T\.|-2\.jpg/i.test(href)) {
          try {
            link.setAttribute("href", full);
          } catch (eHref) {}
        }
      });
    return true;
  }

  function isHumidorOrSaunaPdpPage() {
    if (!isProductPdp()) return false;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-humidor-pdp") ||
          global.document.body.classList.contains("mc-sauna-pdp"))
      ) {
        return true;
      }
      var path = String((global.location && global.location.pathname) || "").toLowerCase();
      if (/humidor|sauna|fridgador/.test(path)) return true;
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || global.global_Current_ProductCode || "")
        .trim()
        .toUpperCase();
      if (/HUMIDOR|SAUNA|FRIDGADOR|CE-HUM|KL-HUM|KL-CAB/.test(pc)) return true;
      var title = String(
        (global.document.querySelector("h1, .productnamecolorLARGE, #productname") || {}).textContent || ""
      ).toLowerCase();
      if (/humidor|sauna|fridgador/.test(title)) return true;
    } catch (eHum) {}
    return false;
  }

  function ensureSteveSilverHeroImageSize() {
    if (!isProductPdp()) return;
    ensureSteveSilverHeroPhotoSrc();
    var isSs =
      isSteveSilverPdpPage() ||
      (function () {
        var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
        var pc = String(
          (global.global_Current_ProductCode || "") ||
            (pcEl && pcEl.value) ||
            ""
        )
          .trim()
          .toUpperCase();
        return /^SS-/.test(pc);
      })();
    var isHumidorSauna = isHumidorOrSaunaPdpPage();
    if (!isSs && !isHumidorSauna) return;
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-steve-silver-altview-pdp", "mc-pdp-unified-ready");
        if (isHumidorSauna) {
          global.document.body.classList.add("mc-humidor-pdp");
        }
      }
    } catch (eBody) {}
    var isDesktop =
      global.matchMedia && global.matchMedia("(min-width: 992px)").matches;
    var maxW = isDesktop ? "650px" : "min(650px, 100%)";
    var img = global.document.getElementById("product_photo");
    var mediaCell = global.document.querySelector(
      "td.mc-unified-pdp-media, td.mc-pdp-media-td, #product_photo_td"
    );
    if (!mediaCell && img && img.closest) {
      mediaCell = img.closest("td");
    }
    if (mediaCell) {
      try {
        mediaCell.style.setProperty("display", "flex", "important");
        mediaCell.style.setProperty("flex-direction", "column", "important");
        mediaCell.style.setProperty("align-items", "flex-start", "important");
        mediaCell.style.setProperty("grid-template-columns", "none", "important");
        mediaCell.style.setProperty("grid-template-rows", "none", "important");
        mediaCell.style.setProperty("max-width", isDesktop ? "650px" : "100%", "important");
        mediaCell.style.setProperty("width", isDesktop ? "650px" : "100%", "important");
        if (isDesktop) {
          mediaCell.style.setProperty("flex", "0 0 650px", "important");
        }
      } catch (eCell) {}
    }
    if (img) {
      try {
        img.style.setProperty("width", isDesktop ? "650px" : "100%", "important");
        img.style.setProperty("max-width", maxW, "important");
        img.style.setProperty("min-width", "0", "important");
        img.style.setProperty("height", "auto", "important");
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("margin-left", "0", "important");
        img.style.setProperty("margin-right", isDesktop ? "auto" : "auto", "important");
        img.style.setProperty("object-fit", "contain", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
      } catch (eImg) {}
    }
    global.document
      .querySelectorAll("a#product_photo_zoom_url, a#product_photo_zoom_url2")
      .forEach(function (link) {
        try {
          link.style.setProperty("display", "block", "important");
          link.style.setProperty("width", isDesktop ? "650px" : "100%", "important");
          link.style.setProperty("max-width", maxW, "important");
          link.style.setProperty("grid-column", "auto", "important");
          link.style.setProperty("grid-row", "auto", "important");
          link.style.setProperty("margin-left", "0", "important");
          link.style.setProperty("box-sizing", "border-box", "important");
        } catch (eLink) {}
      });
    if (mediaCell) {
      mediaCell.querySelectorAll("table").forEach(function (tbl) {
        if (!tbl.querySelector("img#product_photo")) return;
        try {
          tbl.style.setProperty("width", "100%", "important");
          tbl.style.setProperty("max-width", isDesktop ? "650px" : "100%", "important");
          tbl.style.setProperty("grid-column", "auto", "important");
          tbl.style.setProperty("grid-row", "auto", "important");
          tbl.style.setProperty("margin-left", "0", "important");
        } catch (eTbl) {}
      });
    }
  }

  function applyPdpMainImageCap() {
    if (!isProductPdp()) return;
    var isSs = isSteveSilverPdpPage();
    var isHumidorSauna = isHumidorOrSaunaPdpPage();
    if (!isSs && !isHumidorSauna && global.__MC_PDP_MAIN_IMAGE_CAP_VER__ === VERSION) return;
    if (!isSs && !isHumidorSauna) global.__MC_PDP_MAIN_IMAGE_CAP_VER__ = VERSION;
    fixTmhMatPhotoUrls(global.document);
    if (isSs || isHumidorSauna) {
      ensureSteveSilverHeroImageSize();
      return;
    }
    var img = global.document.getElementById("product_photo");
    var maxW = "650px";
    if (img) {
      try {
        img.style.setProperty("max-width", maxW, "important");
        img.style.setProperty("width", "100%", "important");
        img.style.setProperty("height", "auto", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
      } catch (eImg) {}
    }
    global.document.querySelectorAll("#product_photo_zoom_url, a#product_photo_zoom_url2").forEach(function (link) {
      try {
        link.style.setProperty("max-width", maxW, "important");
        link.style.setProperty("width", "100%", "important");
        link.style.setProperty("display", "block", "important");
        link.style.setProperty("box-sizing", "border-box", "important");
      } catch (eLink) {}
    });
  }

  function applyPdpDescriptionTypography(el) {
    if (!isPdpDescriptionTypographyEl(el)) return;
    try {
      el.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
      el.style.setProperty("font-size", "14px", "important");
      el.style.setProperty("font-weight", "400", "important");
      el.style.setProperty("line-height", "1.55", "important");
      el.style.setProperty("letter-spacing", "0.02em", "important");
      el.style.setProperty("text-transform", "none", "important");
      el.style.setProperty("color", "#444", "important");
    } catch (eTypo) {}
  }

  function applyPdpDescriptionStyle() {
    var roots = global.document.querySelectorAll(
      "#ProductDetail_ProductDetails_div2, #mc-pdp-description-below-features, #ProductDetail_ProductDetails_div2 .colors_descriptionbox, #ProductDetail_ProductDetails_div2 span[itemprop='description'], #content_area span[itemprop='description']"
    );
    roots.forEach(function (root) {
      try {
        root.style.setProperty("border", "none", "important");
        root.style.setProperty("border-width", "0", "important");
        root.style.setProperty("background", "transparent", "important");
        root.style.setProperty("background-color", "transparent", "important");
      } catch (eRoot) {}
      applyPdpDescriptionTypography(root);
      root.querySelectorAll("li, p, span, font, strong, b, em, div, ul, ol").forEach(function (el) {
        applyPdpDescriptionTypography(el);
      });
    });
    global.document.querySelectorAll("#ProductDetail_ProductDetails_div2 ul, #ProductDetail_ProductDetails_div2 ol, #mc-pdp-description-below-features ul, #mc-pdp-description-below-features ol, #content_area span[itemprop='description'] ul").forEach(function (list) {
      if (!isPdpDescriptionTypographyEl(list)) return;
      try {
        list.style.setProperty("list-style", "disc", "important");
        list.style.setProperty("padding-left", "1.1em", "important");
        list.style.setProperty("margin", "0", "important");
      } catch (eList) {}
    });
    global.document.querySelectorAll("#ProductDetail_ProductDetails_div2 li, #mc-pdp-description-below-features li, #content_area span[itemprop='description'] > li").forEach(function (li) {
      if (!isPdpDescriptionTypographyEl(li)) return;
      try {
        li.style.setProperty("margin", "0 0 4px 0", "important");
      } catch (eLi) {}
    });
  }

  function hideVolusionQuantityRows() {
    var root = global.document.getElementById("v65-product-parent") || global.document;
    root
      .querySelectorAll(
        '[itemprop="offers"] tr, [itemprop="offers"] td, .colors_pricebox tr, .colors_pricebox td, .v65-productdetail-cartqty'
      )
      .forEach(function (el) {
        if (el.closest("#mc-pdp-qty-row") || el.closest("#mc-pdp-purchase-stack")) return;
        if (
          el.querySelector(
            "#mc-pdp-qty-row, #mc-pdp-purchase-stack, input[name='btnaddtocart'], .mc-atc-button-wrap, input[name^='QTY.']"
          )
        ) {
          return;
        }
        var txt = String(el.textContent || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (txt === "quantity:" || txt === "quantity" || txt === "qty:" || txt === "qty") {
          try {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("visibility", "hidden", "important");
            el.style.setProperty("height", "0", "important");
            el.style.setProperty("margin", "0", "important");
            el.style.setProperty("padding", "0", "important");
            el.style.setProperty("overflow", "hidden", "important");
            el.setAttribute("aria-hidden", "true");
          } catch (eH) {}
        }
      });
  }

  var PRICE_ZERO_CENT_SELECTOR =
    ".product_list_price,.product_sale_price,.product_saleprice,.product_productprice,.product_price," +
    ".v-product__price,.mc-member-grid-price,.mc-pdp-stack-retail-amt,.mc-pdp-top-price-value,.mtl-top-price__amount," +
    "#priceWithOptions,#priceWithOptionsNoTax,.colors_productprice,.pricecolor,.mc-member-price-caption," +
    ".mc-pdp-member-line__amount,.v65-product-price,.mc-member-grid-price__amount,.mc-saranoni-size-thumb__label";

  function stripPriceZeroCentsInTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var v = node.nodeValue;
    if (!v || (v.indexOf(".00") === -1 && v.indexOf(".99") === -1)) return;
    var nv = v.replace(/(\$\d[\d,]*)\.(?:00|99)(?!\d)/g, "$1");
    if (nv !== v) node.nodeValue = nv;
  }

  function stripPriceZeroCents(root) {
    root = root || global.document.body;
    if (!root || !root.querySelectorAll) return;
    try {
      root.querySelectorAll(
        PRICE_ZERO_CENT_SELECTOR + ",#mc-bb-size-section,.mc-bb-size-section,select option"
      ).forEach(function (el) {
        if (el.tagName === "OPTION") {
          var ot = String(el.textContent || "");
          var ont = ot.replace(/(\$\d[\d,]*)\.(?:00|99)(?!\d)/g, "$1");
          if (ont !== ot) el.textContent = ont;
          return;
        }
        var walker = global.document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        var n;
        while ((n = walker.nextNode())) stripPriceZeroCentsInTextNode(n);
      });
    } catch (eStrip) {}
  }

  global.mcStripPriceZeroCents = stripPriceZeroCents;

  function authDelay(ms) {
    return new Promise(function (resolve) {
      global.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function isSectionalPdpPage() {
    try {
      if (typeof global.window.isSectionalProductPage === "function" && global.window.isSectionalProductPage()) {
        return true;
      }
    } catch (eSec) {}
    return false;
  }

  /** Steve Silver / fixed sectionals (-SECT, not MTL -SC- configurators) use unified PDP layout. */
  function isFixedSectionalUnifiedPdp() {
    try {
      var pc = String(
        (global.document.querySelector('input[name="ProductCode"], input[name="productcode"]') || {}).value || ""
      )
        .trim()
        .toUpperCase();
      if (!pc) return false;
      if (/-SC-/i.test(pc) || /ROOM-PLANNER|CONFIGURATOR/i.test(pc)) return false;
      return /-SECT/i.test(pc);
    } catch (eFix) {}
    return false;
  }

  function isMtlSectionalConfiguratorPdp() {
    return isSectionalPdpPage() && !isFixedSectionalUnifiedPdp();
  }

  /** Standard furniture PDPs (e.g. Steve Silver Gatlin -SECT) use mc-unified-pdp-layout.js, not legacy mount. */
  function shouldDeferToUnifiedPdpLayout() {
    if (!isProductPdp()) return false;
    if (isFixedSectionalUnifiedPdp()) return true;
    if (isSectionalPdpPage()) return false;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp"))
      ) {
        return false;
      }
    } catch (eDefer) {}
    return true;
  }

  /** One accordion PDP shell for every non-sectional product (same layout everywhere). */
  function isUnifiedAccordionPdp() {
    if (!isProductPdp()) return false;
    if (isSectionalPdpPage() && !isFixedSectionalUnifiedPdp()) return false;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp"))
      ) {
        return false;
      }
    } catch (eAcc) {}
    return true;
  }

  /** @deprecated use isUnifiedAccordionPdp */
  function isGenericUnifiedFurnitureAccordionPdp() {
    return isUnifiedAccordionPdp();
  }

  function isPalliserPdpPage() {
    try {
      if (typeof global.mcIsPalliserProduct === "function" && global.mcIsPalliserProduct()) {
        return true;
      }
    } catch (ePal) {}
    return false;
  }

  function isCanonicalPricingEl(node) {
    if (!node) return false;
    if (node.classList && node.classList.contains("mc-pdp-member-pricing--canonical")) return true;
    if (node.closest && node.closest(".mc-pdp-member-pricing--canonical")) return true;
    var box =
      node.closest &&
      node.closest("#v65-product-parent .colors_pricebox, #content_area .colors_pricebox");
    if (box && box.querySelector(".mc-pdp-member-pricing--canonical")) {
      if (
        node.classList &&
        (node.classList.contains("mc-pdp-retail-row") ||
          node.classList.contains("mc-pdp-member-line") ||
          node.classList.contains("mc-pdp-member-pricing"))
      ) {
        return true;
      }
    }
    return false;
  }

  function loginReturnTo() {
    return encodeURIComponent(
      (global.location.pathname || "/") + (global.location.search || "")
    );
  }

  function normalizeLoginFields(form) {
    if (!form) return;
    var emailEl = global.document.getElementById("mc-login-email");
    if (emailEl) emailEl.setAttribute("name", "email");
    var passwordEl = global.document.getElementById("mc-login-password");
    if (passwordEl) passwordEl.setAttribute("name", "password");
  }

  function getAuthFrame() {
    var frame = global.document.getElementById("mc-member-auth-frame");
    if (frame) return frame;
    frame = global.document.createElement("iframe");
    frame.id = "mc-member-auth-frame";
    frame.name = "mc-member-auth-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    frame.style.cssText =
      "position:absolute;left:-9999px;width:1px;height:1px;border:0";
    try {
      global.document.body.appendChild(frame);
    } catch (e) {}
    return frame;
  }

  function readAuthFrameSnapshot() {
    var frame = global.document.getElementById("mc-member-auth-frame");
    if (!frame) return { html: "", url: "" };
    try {
      var win = frame.contentWindow;
      var doc = frame.contentDocument || (win && win.document);
      var url = win && win.location ? String(win.location.href || "") : "";
      var html = doc && doc.documentElement ? doc.documentElement.innerHTML : "";
      return { html: html, url: url };
    } catch (eFrame) {
      return { html: "", url: "" };
    }
  }

  function domIndicatesLoggedIn() {
    try {
      if (
        global.document.body &&
        global.document.body.classList.contains("mc-member-logged-in")
      ) {
        return true;
      }
      if (
        global.document.querySelector(
          'a[href*="logout.asp"], a[href*="logoff.asp"]'
        )
      ) {
        return true;
      }
    } catch (eDom) {}
    return false;
  }

  function volusionAuthSuccess(html, url) {
    var check =
      global.volusionMyAccountHtmlIndicatesLoggedIn ||
      (typeof volusionMyAccountHtmlIndicatesLoggedIn === "function"
        ? volusionMyAccountHtmlIndicatesLoggedIn
        : null);
    if (typeof check === "function" && check(html)) return true;
    var u = String(url || "").toLowerCase();
    if (/productdetails\.asp/i.test(u)) return true;
    if (
      /\/\w+-p\//.test(u) &&
      u.indexOf("login.asp") === -1 &&
      u.indexOf("customer_login") === -1
    ) {
      return true;
    }
    return domIndicatesLoggedIn();
  }

  function loginResponseFailed(html, respUrl) {
    var raw = String(html || "");
    var stripped = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ");
    var lc = stripped.toLowerCase();
    var url = String(respUrl || "").toLowerCase();
    if (
      /the email address or password[^<]*invalid|invalid (?:email|login|password)|login failed|not recognized|could not log you in/i.test(
        lc
      )
    ) {
      return true;
    }
    if (
      typeof global.volusionMyAccountHtmlIndicatesLoggedIn === "function" &&
      global.volusionMyAccountHtmlIndicatesLoggedIn(raw)
    ) {
      return false;
    }
    if (/href\s*=\s*["'][^"']*logout\.asp[^"']*["']/i.test(stripped)) {
      return false;
    }
    if (url.indexOf("/customer_login.asp") !== -1) return true;
    if (
      url.indexOf("/login.asp") !== -1 &&
      /<input[^>]+name\s*=\s*["']password["']/i.test(stripped)
    ) {
      return true;
    }
    return false;
  }

  function postHiddenVolusionForm(actionUrl, fields) {
    return new Promise(function (resolve, reject) {
      var frame = getAuthFrame();
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        try {
          frame.onload = null;
        } catch (eT) {}
        reject(new Error("timeout"));
      }, 22000);
      frame.onload = function () {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        try {
          frame.onload = null;
        } catch (eL) {}
        global.setTimeout(function () {
          resolve(readAuthFrameSnapshot());
        }, 280);
      };
      var f = global.document.createElement("form");
      f.method = "POST";
      f.action = actionUrl;
      f.target = frame.name;
      f.style.cssText = "position:absolute;left:-9999px;visibility:hidden";
      Object.keys(fields || {}).forEach(function (key) {
        var inp = global.document.createElement("input");
        inp.type = "hidden";
        inp.name = key;
        inp.value = fields[key] == null ? "" : String(fields[key]);
        f.appendChild(inp);
      });
      global.document.body.appendChild(f);
      try {
        f.submit();
      } catch (eSub) {
        settled = true;
        global.clearTimeout(timer);
        reject(eSub);
        return;
      }
      global.setTimeout(function () {
        try {
          f.remove();
        } catch (eRm) {}
      }, 600);
    });
  }

  function fetchVolusionAuth(url, body) {
    return global.fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,application/xhtml+xml",
      },
      body: body,
      redirect: "follow",
    });
  }

  async function authSucceeded() {
    if (domIndicatesLoggedIn()) return true;
    try {
      var ctrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = null;
      if (ctrl) {
        timer = global.setTimeout(function () {
          try {
            ctrl.abort();
          } catch (eA) {}
        }, 4500);
      }
      var resp = await global.fetch(
        "/myaccount.asp?mcAuthCheck=" + Date.now(),
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: ctrl ? ctrl.signal : undefined,
        }
      );
      var html = await resp.text();
      if (timer) global.clearTimeout(timer);
      var check = global.volusionMyAccountHtmlIndicatesLoggedIn;
      if (typeof check === "function") return !!check(html);
    } catch (e2) {}
    return false;
  }

  async function waitForAuthSuccess(maxMs, intervalMs) {
    var timeoutMs = Math.max(1000, Number(maxMs) || 0);
    var stepMs = Math.max(200, Number(intervalMs) || 0);
    var started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        if (await authSucceeded()) return true;
      } catch (ePoll) {}
      await authDelay(stepMs);
    }
    return false;
  }

  async function postVolusionLoginTwoStep(form) {
    normalizeLoginFields(form);
    var emailEl = global.document.getElementById("mc-login-email");
    var passwordEl = global.document.getElementById("mc-login-password");
    var email = emailEl ? String(emailEl.value || "").trim() : "";
    var password = passwordEl ? String(passwordEl.value || "") : "";
    if (!email || !password) return false;

    var returnTo = loginReturnTo();
    var step1 = "/login.asp?ReturnTo=" + returnTo;
    var step2 = "/login.asp?ReturnTo=" + returnTo;

    try {
      await postHiddenVolusionForm(step1, {
        CustomerNewOld: "old",
        email: email,
        "imageField2.x": "1",
        "imageField2.y": "1",
      });
      await authDelay(400);
      var afterStep2 = await postHiddenVolusionForm(step2, {
        CustomerNewOld: "old",
        email: email,
        password: password,
        "imageField2.x": "1",
        "imageField2.y": "1",
      });
      if (
        volusionAuthSuccess(
          afterStep2 && afterStep2.html,
          afterStep2 && afterStep2.url
        )
      ) {
        return true;
      }
      if (
        loginResponseFailed(
          afterStep2 && afterStep2.html,
          afterStep2 && afterStep2.url
        )
      ) {
        return false;
      }
    } catch (eLoginSteps) {
      try {
        var body1 =
          "CustomerNewOld=old&email=" +
          encodeURIComponent(email) +
          "&imageField2.x=1&imageField2.y=1";
        await fetchVolusionAuth(step1, body1);
        await authDelay(300);
        var body2 =
          "CustomerNewOld=old&email=" +
          encodeURIComponent(email) +
          "&password=" +
          encodeURIComponent(password) +
          "&imageField2.x=1&imageField2.y=1";
        var r2 = await fetchVolusionAuth(step2, body2);
        var html2 = await r2.text();
        if (volusionAuthSuccess(html2, r2.url)) return true;
        if (loginResponseFailed(html2, r2.url)) return false;
      } catch (eFetch) {
        return false;
      }
    }
    if (await authSucceeded()) return true;
    return waitForAuthSuccess(10000, 400);
  }

  function closeLoginModalOnly() {
    if (typeof global.mcCloseLoginModalOnly === "function") {
      global.mcCloseLoginModalOnly();
      return;
    }
    var m = global.document.getElementById("mc-login-modal");
    if (!m) return;
    m.classList.remove("mc-login-modal--open");
    m.setAttribute("aria-hidden", "true");
    try {
      m.style.removeProperty("display");
      m.style.removeProperty("visibility");
      m.style.removeProperty("opacity");
      m.style.removeProperty("pointer-events");
      m.style.removeProperty("z-index");
      global.document.body.style.overflow = "";
    } catch (e2) {}
  }

  function refreshMemberPricingAfterAuth() {
    if (typeof global.mcRefreshMemberPricingAfterAuth === "function") {
      return global.mcRefreshMemberPricingAfterAuth();
    }
    return Promise.resolve()
      .then(function () {
        try {
          if (typeof global.mcRememberRecentMemberAuth === "function") {
            global.mcRememberRecentMemberAuth();
          }
        } catch (eRem) {}
        try {
          global.__mcMemberPricing.promise = null;
        } catch (ePr) {}
        try {
          global.document.body.classList.add("mc-member-logged-in");
        } catch (eCls) {}
        if (typeof global.detectMemberPricingState === "function") {
          return global.detectMemberPricingState();
        }
      })
      .then(function () {
        try {
          if (typeof global.refreshPlannerPriceForMemberState === "function") {
            global.refreshPlannerPriceForMemberState();
          }
        } catch (eRpf) {}
        try {
          if (typeof global.renderMemberPricingCaption === "function") {
            global.renderMemberPricingCaption(global.document);
          }
        } catch (eCap) {}
        try {
          if (typeof global.forceProductFixes === "function") {
            global.forceProductFixes();
          }
        } catch (eFx) {}
        try {
          if (typeof global.mcRenderRetailMemberOnPdp === "function") {
            return global.mcRenderRetailMemberOnPdp();
          }
        } catch (ePdp) {}
      })
      .then(function () {
        try {
          mcEnsurePdpPriceStack();
        } catch (eStack) {}
      });
  }

  function mcFinishLoginModalAndRefreshPdp() {
    closeLoginModalOnly();
    try {
      global.document.body.style.overflow = "";
    } catch (eOv) {}
    global.setTimeout(function () {
      var p = refreshMemberPricingAfterAuth();
      if (p && typeof p.catch === "function") {
        p.catch(function () {
          try {
            if (typeof global.detectMemberPricingState === "function") {
              global.__mcMemberPricing.promise = null;
              global.detectMemberPricingState();
            }
          } catch (eRetry) {}
        });
      }
    }, 0);
  }

  global.mcFinishLoginModalAndRefreshPdp = mcFinishLoginModalAndRefreshPdp;

  function templateSubmitHasFinish() {
    var fn = global.mcSubmitAuthForm;
    if (!fn) return false;
    try {
      return String(fn).indexOf("mcFinishLoginModalAndRefreshPdp") !== -1;
    } catch (e) {}
    return false;
  }

  function installAuthSubmitOverride() {
    if (templateSubmitHasFinish()) return;
    if (
      global.mcSubmitAuthForm &&
      global.mcSubmitAuthForm.__mcAuthCtaOverrideVer === VERSION
    ) {
      return;
    }
    var prev = global.mcSubmitAuthForm;

    global.mcSubmitAuthForm = async function (form, mode) {
      if (mode !== "login") {
        if (prev) return prev.call(this, form, mode);
        return false;
      }
      try {
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(mode, "", "");
        }
        if (typeof global.mcToggleAuthPending === "function") {
          global.mcToggleAuthPending(form, true);
        }
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(mode, "Signing in.", "success");
        }
      } catch (eUi) {}

      var ok = await postVolusionLoginTwoStep(form);

      try {
        if (typeof global.mcToggleAuthPending === "function") {
          global.mcToggleAuthPending(form, false);
        }
      } catch (eUi2) {}

      if (ok) {
        try {
          if (typeof global.mcLoginModalRememberRecentAuth === "function") {
            global.mcLoginModalRememberRecentAuth();
          }
        } catch (eRem) {}
        try {
          if (typeof global.mcSetAuthStatus === "function") {
            global.mcSetAuthStatus(mode, "Signed in.", "success");
          }
        } catch (eStat) {}
        mcFinishLoginModalAndRefreshPdp();
        return true;
      }

      try {
        if (typeof global.mcLoginModalClearRecentAuth === "function") {
          global.mcLoginModalClearRecentAuth();
        }
        if (typeof global.mcSetAuthStatus === "function") {
          global.mcSetAuthStatus(
            mode,
            'Sign-in failed. Check your email and password, or use "Open in a new tab" below.',
            "error"
          );
        }
      } catch (eFail) {}
      return false;
    };
    global.mcSubmitAuthForm.__mcAuthCtaOverrideVer = VERSION;
  }

  [0, 50, 200, 600, 1500, 4000, 9000].forEach(function (ms) {
    global.setTimeout(installAuthSubmitOverride, ms);
  });

  function handleAuthCtaClick(e) {
    if (!e || !e.target || !e.target.closest) return false;

    var loginEl = e.target.closest(
      "[data-mc-open-login], .mc-member-grid-price__login, .mc-configuration-rh__signin-cta, #mcPlannerLoginGate a[href*='login.asp'], #mcPlannerLoginGate a[href*='Login.asp']"
    );
    if (loginEl) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      try {
        e.stopImmediatePropagation();
      } catch (eImm) {}
      if (typeof global.mcOpenLoginModal === "function") {
        global.mcOpenLoginModal();
      } else {
        global.__MC_PDP_PENDING_LOGIN_MODAL__ = true;
      }
      return true;
    }

    var signupEl = e.target.closest(
      "[data-mc-open-signup], #mcPlannerLoginGate a[href*='register.asp'], #mcPlannerLoginGate a[href*='AccountSettings.asp']"
    );
    if (signupEl) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      try {
        e.stopImmediatePropagation();
      } catch (eImm2) {}
      if (typeof global.mcOpenSignupModal === "function") {
        global.mcOpenSignupModal();
      } else {
        global.__MC_PDP_PENDING_SIGNUP_MODAL__ = true;
      }
      return true;
    }

    return false;
  }

  global.mcHandleLoginCtaClick = handleAuthCtaClick;

  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;
  global.mcPdpAuthCtaRefresh = function () {
    try {
      runPatch();
    } catch (eRef) {}
  };

  function isProductPdp() {
    try {
      var b = global.document.body;
      if (b && b.classList.contains("productdetails")) return true;
      if (global.document.getElementById("v65-product-parent")) return true;
      var p = String(global.location.pathname || "").toLowerCase();
      if (/\.htm(?:\?|$)/i.test(p) && global.document.querySelector(".colors_pricebox")) return true;
    } catch (e) {}
    return false;
  }

  function parseMoney(text) {
    if (typeof global.parseMcCurrency === "function") {
      return Number(global.parseMcCurrency(text == null ? "" : String(text))) || 0;
    }
    var m = String(text == null ? "" : text).match(/\$[\d,]+(?:\.\d+)?/);
    if (!m) return 0;
    return parseFloat(m[0].replace(/[$,]/g, "")) || 0;
  }

  function fmtMoney(n) {
    n = Number(n || 0);
    if (!(n > 0)) return "";
    if (typeof global.mcFmtMoney === "function") return global.mcFmtMoney(n);
    var cents = Math.round(n * 100) % 100;
    return (
      "$" +
      n.toLocaleString(undefined, {
        minimumFractionDigits: cents === 0 ? 0 : 2,
        maximumFractionDigits: cents === 0 ? 0 : 2,
      })
    );
  }

  function readRetailAmountForSale() {
    var el =
      global.document.querySelector(".mc-pdp-retail-row .product_list_price") ||
      global.document.querySelector(".mc-pdp-retail-row font.product_list_price") ||
      global.document.querySelector("#v65-product-parent .product_list_price") ||
      global.document.querySelector("#content_area .product_list_price");
    return el ? parseMoney(el.textContent || "") : 0;
  }

  function readSaleFromVisibleNodes() {
    var nodes = global.document.querySelectorAll(
      "#v65-product-parent .colors_pricebox .product_sale_price, #v65-product-parent .colors_pricebox .product_saleprice, " +
        "#v65-product-parent .colors_pricebox font.product_sale_price, #v65-product-parent .mtl-product-price-block .product_sale_price, " +
        "#v65-product-parent .mtl-product-price-block .product_saleprice"
    );
    var i;
    for (i = 0; i < nodes.length; i++) {
      var amt = parseMoney(nodes[i].textContent || "");
      if (amt > 0) return amt;
    }
    return 0;
  }

  function readSaleFromPriceBox() {
    var box =
      global.document.querySelector("#v65-product-parent .colors_pricebox") ||
      global.document.querySelector("#content_area .colors_pricebox");
    if (!box) return 0;
    var text = box.textContent || "";
    var amounts = [];
    var re = /\$[\d,]+(?:\.\d{2})?/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var v = parseMoney(m[0]);
      if (v > 0) amounts.push(v);
    }
    if (amounts.length < 2) return 0;
    amounts.sort(function (a, b) {
      return b - a;
    });
    var retail = amounts[0];
    var sale = amounts[amounts.length - 1];
    if (sale > 0 && sale < retail) return sale;
    if (amounts.length >= 2 && amounts[1] < retail) return amounts[1];
    return 0;
  }

  function resolvePdpSaleAmount() {
    if (global.__mcPdpSaleAmtCached > 0) return global.__mcPdpSaleAmtCached;
    var amt = readSaleFromVisibleNodes();
    if (!(amt > 0)) amt = readSaleFromPriceBox();
    if (!(amt > 0)) {
      var inputs = global.document.querySelectorAll(
        "#v65-product-parent input, #v65-product-parent textarea, #content_area input, #content_area textarea"
      );
      var i;
      for (i = 0; i < inputs.length; i++) {
        var nm = ((inputs[i].name || "") + " " + (inputs[i].id || ""))
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        if (nm.indexOf("saleprice") === -1) continue;
        amt = parseMoney(inputs[i].value || inputs[i].getAttribute("value") || "");
        if (amt > 0) break;
      }
    }
    if (!(amt > 0) && typeof global.getVolusionAddToCartSeatPrice === "function") {
      amt = Number(global.getVolusionAddToCartSeatPrice(global.document)) || 0;
    }
    if (!(amt > 0) && typeof global.tryReadHowToGetSalePrice === "function") {
      amt = Number(global.tryReadHowToGetSalePrice(readRetailAmountForSale(), true)) || 0;
    }
    if (!(amt > 0)) {
      try {
        if (typeof global.HowToGetSalePrice === "function") {
          amt = Number(global.HowToGetSalePrice(readRetailAmountForSale())) || 0;
        } else if (Number(global.SalePrice) > 0) {
          amt = Number(global.SalePrice);
        }
      } catch (eW) {}
    }
    if (!(amt > 0)) {
      try {
        if (global.__mcMemberPricing && global.__mcMemberPricing.memberSeatPrice > 0) {
          amt = Number(global.__mcMemberPricing.memberSeatPrice) || 0;
        } else if (Number(global.__MC_MEMBER_SEAT_PRICE) > 0) {
          amt = Number(global.__MC_MEMBER_SEAT_PRICE);
        }
      } catch (eMp) {}
    }
    if (!(amt > 0) && typeof global.mcReadCurrentVisibleMemberUnitPrice === "function") {
      amt = Number(global.mcReadCurrentVisibleMemberUnitPrice()) || 0;
    }
    if (!(amt > 0)) {
      var html = "";
      try {
        html = global.document.documentElement.innerHTML || "";
      } catch (eH) {}
      var patterns = [
        /\bSalePrice\s*[=:]\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
        /\bwindow\.SalePrice\s*=\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
        /["']SalePrice["']\s*:\s*['"]?(\d[\d,]*(?:\.\d+)?)/gi,
      ];
      var pi;
      for (pi = 0; pi < patterns.length; pi++) {
        var r = patterns[pi];
        var m;
        r.lastIndex = 0;
        while ((m = r.exec(html)) !== null) {
          var p = parseMoney(m[1]);
          if (p > 0 && p < 50000000) {
            amt = p;
            break;
          }
        }
        if (amt > 0) break;
      }
    }
    if (amt > 0) global.__mcPdpSaleAmtCached = amt;
    return amt;
  }

  function hasMcPdpStackMarkers() {
    return !!global.document.querySelector(
      ".mc-pdp-member-pricing, .mc-pdp-retail-row, #v65-product-parent .mc-pdp-member-line, #content_area .mc-pdp-member-line"
    );
  }

  function ensurePdpStackCriticalCss() {
    var el = global.document.getElementById("mc-pdp-stack-critical-css");
    if (!el) {
      el = global.document.createElement("style");
      el.id = "mc-pdp-stack-critical-css";
      (global.document.head || global.document.documentElement).appendChild(el);
    }
    el.textContent =
      "body.productdetails #mc-pdp-price-stack-host,body.mc-product-page #mc-pdp-price-stack-host,body.mc-pdp-price-stack #mc-pdp-price-stack-host{" +
      "display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:6px!important;width:100%!important;max-width:100%!important;margin:0 0 12px!important;padding:0!important;position:static!important;clear:both!important}" +
      "body.productdetails #mc-pdp-price-stack-host .mc-pdp-retail-row,body.productdetails #mc-pdp-price-stack-host .mc-pdp-member-pricing,body.mc-pdp-price-stack #mc-pdp-price-stack-host .mc-pdp-retail-row,body.mc-pdp-price-stack #mc-pdp-price-stack-host .mc-pdp-member-pricing{" +
      "display:flex!important;flex-direction:column!important;position:static!important;float:none!important;margin:0 0 4px!important;width:100%!important;visibility:visible!important;opacity:1!important;height:auto!important;max-height:none!important}" +
      "body.productdetails #mc-pdp-price-stack-host .product_list_price,body.productdetails #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt,body.productdetails #mc-pdp-price-stack-host .mc-pdp-member-line__amount,body.productdetails #mc-pdp-price-stack-host .mc-pdp-member-line__label,body.mc-pdp-price-stack #mc-pdp-price-stack-host .product_list_price,body.mc-pdp-price-stack #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt{" +
      "display:block!important;visibility:visible!important;opacity:1!important;font-size:14px!important;color:#444!important;line-height:1.55!important;letter-spacing:0.02em!important}" +
      "body.productdetails #mc-pdp-price-stack-host .product_list_price,body.mc-product-page #mc-pdp-price-stack-host .product_list_price,body.mc-pdp-price-stack #mc-pdp-price-stack-host .product_list_price," +
      "body.productdetails #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt,body.mc-product-page #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt,body.mc-pdp-price-stack #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt{" +
      "font-size:16px!important;font-weight:400!important;line-height:1.55!important;letter-spacing:0.02em!important;text-transform:none!important;color:#444!important}" +
      "body.productdetails #mtl-product-summary .mtl-summary-row:has(#mtl-sum-price),body.mc-pdp-price-stack #mtl-product-summary .mtl-summary-row:has(#mtl-sum-price){" +
      "display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;opacity:0!important}" +
      "body.productdetails .mc-member-price-caption,body.mc-pdp-price-stack .mc-member-price-caption{" +
      "display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;opacity:0!important}" +
      "body.productdetails #v65-product-parent .colors_pricebox .mc-pdp-retail-row,body.productdetails #v65-product-parent .colors_pricebox .mc-pdp-member-pricing,body.productdetails #v65-product-parent .colors_pricebox>.mc-pdp-member-line{" +
      "display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;opacity:0!important}" +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .colors_pricebox .product_saleprice,body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .colors_pricebox .product_sale_price,body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .colors_pricebox .product_productprice{" +
      "display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;opacity:0!important}" +
      "html body.mc-saranoni-pdp-init #v65-product-parent .colors_pricebox .product_list_price,html body.mc-saranoni-pdp-init #v65-product-parent .colors_pricebox .product_productprice,html body.mc-saranoni-pdp-init #v65-product-parent .colors_pricebox .product_sale_price,html body.mc-saranoni-pdp-init #v65-product-parent .colors_pricebox font.product_sale_price,html body.mc-saranoni-pdp-init #v65-product-parent .colors_pricebox .product_saleprice{" +
      "display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}";
  }

  function placePriceStackHost(host) {
    if (!host) return;
    /* Closeout needs placement even after mc-pdp-unified-ready (host is often missing). */
    if (isUnifiedPdpReady() && !isCloseoutPdpPage() && !isSteveSilverPdpPage()) return;
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage() && !isCloseoutPdpPage() && !isSteveSilverPdpPage()) return;
    if (isSoftGoodsPdpPage() || isCloseoutPdpPage() || isSteveSilverPdpPage()) {
      var sgCol = findPdpHeroColumnTd();
      if (!sgCol) return;
      var titleEl = global.document.getElementById("mc-pdp-title-right");
      var logoEl = global.document.getElementById("mc-pdp-brand-logo");
      var afterEl =
        titleEl && sgCol.contains(titleEl)
          ? titleEl
          : logoEl && sgCol.contains(logoEl)
            ? logoEl
            : null;
      if (afterEl) {
        if (host.parentNode !== sgCol || host.previousElementSibling !== afterEl) {
          try {
            if (afterEl.nextSibling) {
              sgCol.insertBefore(host, afterEl.nextSibling);
            } else {
              sgCol.appendChild(host);
            }
          } catch (eSgPrice) {}
        }
      } else if (host.parentNode !== sgCol) {
        try {
          sgCol.appendChild(host);
        } catch (eSgPrice2) {}
      }
      try {
        host.style.setProperty("display", "flex", "important");
        host.style.setProperty("visibility", "visible", "important");
        host.style.setProperty("opacity", "1", "important");
        host.style.setProperty("height", "auto", "important");
        host.style.setProperty("max-height", "none", "important");
      } catch (eVis) {}
      return;
    }
    /* Price goes ABOVE the Klarna/Affirm (Stripe BNPL) messaging section */
    var bnpl = global.document.getElementById("messaging-element");
    var bnplBox = bnpl && bnpl.closest ? bnpl.closest(".colors_pricebox") : null;
    var bnplAnchor = bnplBox || bnpl;
    if (bnplAnchor && bnplAnchor.parentNode) {
      if (host.nextElementSibling !== bnplAnchor || host.parentNode !== bnplAnchor.parentNode) {
        try {
          bnplAnchor.parentNode.insertBefore(host, bnplAnchor);
        } catch (eBnpl) {}
      }
      ensureHeroColumnOrder();
      return;
    }
    var sum = global.document.getElementById("mtl-product-summary");
    var atc = global.document.querySelector(
      '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"]'
    );
    var atcTr = atc && atc.closest ? atc.closest("tr") : null;
    if (sum && sum.parentNode) {
      if (host.parentNode !== sum.parentNode || host.previousSibling !== sum) {
        try {
          sum.parentNode.insertBefore(host, sum.nextSibling);
        } catch (eAfterSum) {}
      }
      return;
    }
    if (atcTr && atcTr.parentNode) {
      try {
        atcTr.parentNode.insertBefore(host, atcTr);
      } catch (eAtc) {}
      return;
    }
    var parent =
      global.document.querySelector("#v65-product-parent") ||
      global.document.getElementById("content_area");
    if (parent && host.parentNode !== parent) {
      try {
        parent.appendChild(host);
      } catch (eFallback) {}
    }
    ensureHeroColumnOrder();
  }

  /** Manufacturer logo + hero typography + ATC chrome (SFTP bundle — no template rebake). */
  var MC_PDP_LOGO_SKIP =
    "#mc-pdp-brand-logo,#altviews,.altviews,#mcLeatherPicker,#mcLeatherSwatchStrip," +
    ".mtl-leather-modal,.wm-modal,.v-products-list,.v-product,.v65-productDisplay," +
    "#v65-product-history-details,#v65-product-history-header,table[id*='v65-product-history' i]," +
    ".relatedproducts,.related-products,.related_products,.cross-sell,.cross_sell,.upsell,.up-sell," +
    ".v65-productCategoryMore,.mc-more-items,.mc-related-rail,.mc-collection-rail";

  function isManufacturerLogoCandidate(img) {
    if (!img || !img.getAttribute) return false;
    if (img.id === "product_photo" || img.id === "main-image") return false;
    if (/^alternate_product_photo/i.test(img.id || "")) return false;
    var src = (img.getAttribute("src") || "").toLowerCase();
    if (!src || /clear1x1|spacer|pixel\.gif|1x1\.gif/.test(src)) return false;
    if (/swatch|leather|cover|configurator|sectional|thumbnail|altview/.test(src)) return false;
    if (img.closest && img.closest(MC_PDP_LOGO_SKIP)) return false;
    /* Explicit manufacturer logos are valid even before naturalWidth loads. */
    var isMfgPath = /manufacturers\//i.test(src) || /vCSS_img_mfg_logo/i.test(img.className || "");
    var w = img.naturalWidth || img.width || 0;
    var h = img.naturalHeight || img.height || 0;
    if (!isMfgPath && w <= 1 && h <= 1) return false;
    if (w > 520 || (h > 180 && w > 320)) return false;
    return true;
  }

  function findManufacturerLogoImg() {
    var root = global.document.getElementById("v65-product-parent") || global.document.getElementById("content_area");
    if (root) {
      var mfgEl = root.querySelector("img.vCSS_img_mfg_logo, .vCSS_img_mfg_logo");
      if (mfgEl && isManufacturerLogoCandidate(mfgEl)) return mfgEl;
    }
    var mediaTd = global.document.querySelector("td.mc-pdp-media-td, #product_photo_td");
    if (mediaTd) {
      if (isMahjongHousePdpPage()) {
        var mahjongLogo = mediaTd.querySelector('img[src*="mahjong" i], img.vCSS_img_mfg_logo');
        if (mahjongLogo && isManufacturerLogoCandidate(mahjongLogo)) return mahjongLogo;
      }
      var mediaImgs = mediaTd.querySelectorAll("img");
      var j;
      for (j = 0; j < mediaImgs.length; j++) {
        if (isManufacturerLogoCandidate(mediaImgs[j])) return mediaImgs[j];
      }
    }
    var imgs = global.document.querySelectorAll("#v65-product-parent img, #content_area img");
    var i;
    for (i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!isManufacturerLogoCandidate(img)) continue;
      if (/manufacturers\//i.test(img.getAttribute("src") || "")) return img;
    }
    for (i = 0; i < imgs.length; i++) {
      img = imgs[i];
      if (!isManufacturerLogoCandidate(img)) continue;
      var lc = (
        (img.getAttribute("src") || "") + " " + (img.getAttribute("alt") || "")
      ).toLowerCase();
      if (/swatch|leather|cover|configurator|sectional|paragon|recliner|sofa|loveseat|chaise|seating|chair/.test(lc)) {
        continue;
      }
      if (/palliser|saranoni|manufacturers\//i.test(lc)) return img;
      if (/(logo|brand|vendor|manufacturer)/.test(lc)) return img;
    }
    return null;
  }

  function isPdpLayoutMounted() {
    return !!(
      global.document.body &&
      global.document.body.dataset.mcPdpLayoutMounted === "1" &&
      global.document.body.dataset.mcPdpLayoutVer === VERSION
    );
  }

  function isUnifiedPdpReady() {
    return !!(
      global.document.body &&
      (global.document.body.classList.contains("mc-pdp-unified-ready") ||
        global.__MC_UNIFIED_PDP_STABLE__)
    );
  }

  function markPdpLayoutMounted() {
    try {
      if (global.document.body) {
        global.document.body.dataset.mcPdpLayoutMounted = "1";
        global.document.body.dataset.mcPdpLayoutVer = VERSION;
      }
      global.document.documentElement.dataset.mcPdpNormalized = "1";
    } catch (eMk) {}
  }

  function insertNodeAfter(parent, ref, node) {
    if (!parent || !node) return;
    try {
      if (ref && ref.parentNode === parent) {
        if (ref.nextSibling) parent.insertBefore(node, ref.nextSibling);
        else parent.appendChild(node);
      } else {
        parent.appendChild(node);
      }
    } catch (eIns) {}
  }

  function findProductTitleSourceEl() {
    var mediaTd = findPdpMediaTd();
    var root = global.document.getElementById("v65-product-parent");
    if (!root) return null;
    var selectorList = [
      'h1[itemprop="name"]',
      "h1.vp-product-title",
      "h1.productnamecolorLARGE",
      "h1.productnamecolor",
      "h1",
      '[itemprop="name"]',
    ];
    var si;
    for (si = 0; si < selectorList.length; si++) {
      var nodes = root.querySelectorAll(selectorList[si]);
      var ni;
      for (ni = 0; ni < nodes.length; ni++) {
        var el = nodes[ni];
        if (!el) continue;
        if (mediaTd && mediaTd.contains(el)) continue;
        if (
          el.closest &&
          el.closest("#mc-pdp-accordion, #mc-inline-config, #mc-pdp-top-price-panel, #mc-pdp-brand-logo")
        ) {
          continue;
        }
        var txt = String(el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!txt || txt.length < 3 || txt.length > 220) continue;
        if (/Retail Price|Member Price|Klarna|Select a Leather|Product Summary/i.test(txt)) continue;
        return el;
      }
    }
    return null;
  }

  function ensurePdpTitleInOptionsColumn() {
    /* Soft-goods + SS/closeout/bedroom: always re-home the breadcrumb H1 into the
       info column so the product name stays below the brand logo (never above hero). */
    if (
      isPdpLayoutMounted() &&
      !isMahjongHousePdpPage() &&
      !isSaranoniPdpPage() &&
      !isSoftGoodsPdpPage() &&
      !isSteveSilverPdpPage() &&
      !isCloseoutPdpPage()
    ) {
      return;
    }
    var col = findPdpHeroColumnTd();
    if (!col) return;
    var titleWrap = global.document.getElementById("mc-pdp-title-right");
    var titleEl = findProductTitleSourceEl();
    if (!titleWrap) {
      titleWrap = global.document.createElement("div");
      titleWrap.id = "mc-pdp-title-right";
      titleWrap.className = "mc-pdp-title-right";
    }
    if (titleEl && !titleWrap.contains(titleEl)) {
      titleWrap.appendChild(titleEl);
    }
    if (!titleWrap.querySelector("h1, [itemprop='name'], .productnamecolor")) return;
    if (titleWrap.parentNode !== col) {
      try {
        col.appendChild(titleWrap);
      } catch (eT) {}
    }
  }

  function applySoftGoodsAltviewsLayout(alt) {
    if (!alt) return;
    try {
      alt.classList.add("mc-unified-altviews");
      alt.style.setProperty("display", "flex", "important");
      alt.style.setProperty("flex-direction", "row", "important");
      alt.style.setProperty("flex-wrap", "wrap", "important");
      alt.style.setProperty("align-items", "flex-start", "important");
      alt.style.setProperty("justify-content", "flex-start", "important");
      alt.style.setProperty("gap", "8px", "important");
      alt.style.setProperty("width", "100%", "important");
      alt.style.setProperty("max-width", "650px", "important");
      alt.style.setProperty("margin", "10px 0 0 0", "important");
      alt.style.setProperty("padding", "0", "important");
      alt.style.setProperty("float", "none", "important");
      alt.style.setProperty("clear", "both", "important");
      alt.style.setProperty("font-size", "0", "important");
      alt.style.setProperty("line-height", "0", "important");
    } catch (eAltLayout) {}
    alt.querySelectorAll("br").forEach(function (br) {
      try {
        br.style.setProperty("display", "none", "important");
      } catch (eBr) {}
    });
    alt.querySelectorAll("a").forEach(function (a) {
      try {
        a.style.setProperty("display", "inline-block", "important");
        a.style.setProperty("width", "72px", "important");
        a.style.setProperty("max-width", "72px", "important");
        a.style.setProperty("margin", "0", "important");
        a.style.setProperty("vertical-align", "top", "important");
        a.style.setProperty("font-size", "initial", "important");
        a.style.setProperty("line-height", "normal", "important");
      } catch (eA) {}
    });
  }

  function sanitizeBeanBagAltviews() {
    if (!isBeanBagPdpPage()) return;
    var alt =
      global.document.getElementById("altviews") ||
      global.document.querySelector("#content_area .altviews, #v65-product-parent .altviews");
    if (!alt) return;
    hideAlternativeViewsLabel(alt);
    applySoftGoodsAltviewsLayout(alt);
  }

  function hideAlternativeViewsLabel(alt) {
    if (!alt) return;
    try {
      Array.prototype.forEach.call(alt.childNodes, function (node) {
        if (node.nodeType !== 3) return;
        if (/alternative\s*views/i.test(String(node.textContent || ""))) {
          node.textContent = "";
        }
      });
    } catch (eLbl) {}
    alt.querySelectorAll("br").forEach(function (br) {
      try {
        br.style.setProperty("display", "none", "important");
      } catch (eBr) {}
    });
  }

  function ensureBeanBagMediaStack(main, alt) {
    if (!main || !alt) return;
    var mediaTd = findPdpMediaTd();
    if (!mediaTd) return;

    var zoomParent = alt.parentElement;
    if (
      zoomParent &&
      (zoomParent.id === "product_photo_zoom_url" || zoomParent.id === "product_photo_zoom_url2")
    ) {
      try {
        var zoomHolder = zoomParent.parentNode;
        if (zoomHolder) zoomHolder.insertBefore(alt, zoomParent.nextSibling);
      } catch (eZoom) {}
    }

    var stack = null;
    try {
      stack = mediaTd.querySelector(":scope > .mc-bean-bag-media-stack");
    } catch (eScope) {
      stack = mediaTd.querySelector(".mc-bean-bag-media-stack");
    }
    if (!stack) {
      stack = global.document.createElement("div");
      stack.className = "mc-bean-bag-media-stack";
      var anchor = null;
      var ki;
      var kids = mediaTd.children;
      for (ki = 0; ki < kids.length; ki++) {
        var ch = kids[ki];
        if (ch.id === "mc-pdp-description-under-media") continue;
        if (ch.tagName === "TABLE") {
          anchor = ch;
          break;
        }
      }
      if (!anchor) {
        for (ki = 0; ki < kids.length; ki++) {
          var chAlt = kids[ki];
          if (chAlt.id === "mc-pdp-description-under-media") continue;
          if (chAlt.id === "altviews" || chAlt.classList.contains("altviews")) {
            anchor = chAlt;
            break;
          }
        }
      }
      try {
        if (anchor) mediaTd.insertBefore(stack, anchor);
        else mediaTd.insertBefore(stack, mediaTd.firstChild);
      } catch (eIns) {
        mediaTd.appendChild(stack);
      }

      var moveList = [];
      Array.prototype.forEach.call(mediaTd.children, function (node) {
        if (node === stack) return;
        if (node.id === "mc-pdp-description-under-media") return;
        moveList.push(node);
      });
      moveList.forEach(function (node) {
        try {
          stack.appendChild(node);
        } catch (eMove) {}
      });
    }

    if (!stack.contains(alt)) {
      try {
        stack.appendChild(alt);
      } catch (eAlt) {}
    }

    var mainBlock = stack.querySelector("table");
    if (mainBlock) {
      try {
        mainBlock.style.setProperty("order", "1", "important");
      } catch (eTblOrd) {}
      try {
        stack.insertBefore(alt, mainBlock.nextSibling);
      } catch (eOrd) {
        stack.appendChild(alt);
      }
    }
    try {
      alt.style.setProperty("order", "2", "important");
      alt.style.setProperty("position", "static", "important");
      alt.style.setProperty("top", "auto", "important");
      alt.style.setProperty("left", "auto", "important");
      alt.style.setProperty("margin-top", "10px", "important");
      alt.style.setProperty("width", "100%", "important");
      alt.style.setProperty("max-width", "600px", "important");
    } catch (eAltOrd) {}
    /* Volusion's empty zoom-icon span is being rendered as a stray glyph on
       the Bean Bag "Larger Photo" link.  Keep the link and its text. */
    try {
      stack.querySelectorAll("#product_photo_zoom_url2 .btn-icon-zoom").forEach(function (icon) {
        if (icon.parentNode) icon.parentNode.removeChild(icon);
      });
    } catch (eZoomGlyph) {}
  }

  function moveAltViewsUnderMainImage() {
    if (isSteveSilverPdpPage()) return;
    var alt =
      global.document.getElementById("altviews") ||
      global.document.querySelector("#content_area .altviews, #v65-product-parent .altviews");
    if (!alt) return;
    var main =
      global.document.getElementById("product_photo") ||
      global.document.querySelector("img#main-image, #v65-product-parent img#product_photo");
    if (!main || !main.parentNode) return;

    if (isBeanBagPdpPage()) {
      ensureBeanBagMediaStack(main, alt);
      hideAlternativeViewsLabel(alt);
      applySoftGoodsAltviewsLayout(alt);
      return;
    }

    if (isSaranoniPdpPage()) {
      hideSaranoniHeroAltviews();
      relocateVariantSwatchesFromMediaColumn();
      if (main.nextElementSibling !== alt) {
        try {
          main.parentNode.insertBefore(alt, main.nextSibling);
        } catch (eSarAlt) {}
      }
      applySoftGoodsAltviewsLayout(alt);
      return;
    }

    if (main.nextElementSibling !== alt) {
      try {
        main.parentNode.insertBefore(alt, main.nextSibling);
      } catch (eAlt) {}
    }
  }

  function syncPdpHeroTopAlign() {
    if (isSoftGoodsPdpPage()) return;
    if (global.matchMedia && global.matchMedia("(max-width: 991px)").matches) return;
    function apply() {
      var photo =
        global.document.getElementById("product_photo") ||
        global.document.querySelector("img#main-image, #v65-product-parent img#product_photo");
      if (!photo) return;
      var logo = global.document.getElementById("mc-pdp-brand-logo");
      var title = global.document.getElementById("mc-pdp-title-right");
      var target = logo && logo.querySelector("img") ? logo : title;
      if (!target) return;
      var delta = Math.round(photo.getBoundingClientRect().top - target.getBoundingClientRect().top);
      if (Math.abs(delta) <= 1) {
        try {
          target.style.removeProperty("margin-top");
        } catch (eRm) {}
        return;
      }
      try {
        target.style.setProperty("margin-top", Math.max(0, delta) + "px", "important");
      } catch (eMt) {}
    }
    apply();
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(apply);
    }
  }

  function styleBrandLogoWrap(wrap, logo) {
    if (!wrap) return;
    try {
      wrap.style.setProperty("display", "block", "important");
      wrap.style.setProperty("visibility", "visible", "important");
      wrap.style.setProperty("opacity", "1", "important");
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("max-width", "435px", "important");
      wrap.style.setProperty("text-align", "center", "important");
      wrap.style.setProperty("margin", "0 0 12px 0", "important");
      wrap.style.setProperty("padding", "0", "important");
    } catch (eWrap) {}
    if (!logo) logo = wrap.querySelector("img");
    if (!logo) return;
    try {
      logo.style.setProperty("display", "block", "important");
      logo.style.setProperty("visibility", "visible", "important");
      logo.style.setProperty("opacity", "1", "important");
      logo.style.setProperty("margin", "0 auto", "important");
      logo.style.setProperty("width", "auto", "important");
      logo.style.setProperty("max-width", "230px", "important");
      logo.style.setProperty("max-height", "72px", "important");
      logo.style.setProperty("height", "auto", "important");
      logo.style.setProperty("object-fit", "contain", "important");
    } catch (eLogo) {}
  }

  function collapseEmptyMediaLogoCells() {
    try {
      /* Furniture-only. Soft goods / bean bags keep their own media frames. */
      if (isBeanBagPdpPage() || isSoftGoodsPdpPage()) return;
      var hero = global.document.getElementById("product_photo");
      if (!hero) return;
      var media = hero.closest("td.mc-unified-pdp-media, td.mc-pdp-media-td, td.vol-product__top--left, #product_photo_td");
      if (!media) return;
      var row = hero.closest("tr");
      if (!row || !media.contains(row)) return;
      /* Never operate on the main product row (media + info). */
      if (row.querySelector("td.vol-product__top--right, td.mc-unified-pdp-info, td.mc-pdp-options-td, #mc-pdp-title-right, #mc-pdp-accordion")) return;
      Array.prototype.slice.call(row.children).forEach(function (td) {
        if (!td || td.tagName !== "TD") return;
        if (td.contains(hero)) return;
        if (td.querySelector("#product_photo, #mc-pdp-alt-view-row, .mc-pdp-alt-view-row")) return;
        var txt = ((td.textContent || "") + "").replace(/\u00a0/g, " ").trim();
        var hasUsefulImg = td.querySelector("img:not(.vCSS_img_mfg_logo)");
        var hasMfgOnly = td.querySelector("img.vCSS_img_mfg_logo, img[src*='/manufacturers/']");
        if (hasUsefulImg) return;
        if (!txt && (!hasMfgOnly || (hasMfgOnly && hasMfgOnly.style && hasMfgOnly.style.display === "none"))) {
          try { td.parentNode && td.parentNode.removeChild(td); } catch (eRm) {}
          return;
        }
        if (!txt || hasMfgOnly) {
          try {
            td.style.setProperty("display", "none", "important");
            td.style.setProperty("width", "0", "important");
            td.style.setProperty("max-width", "0", "important");
            td.style.setProperty("padding", "0", "important");
            td.style.setProperty("margin", "0", "important");
            td.setAttribute("aria-hidden", "true");
          } catch (eHideTd) {}
        }
      });
      var heroTd = hero.closest("td");
      if (heroTd) {
        try {
          heroTd.style.setProperty("display", "block", "important");
          heroTd.style.setProperty("width", "100%", "important");
          heroTd.style.setProperty("max-width", "650px", "important");
          heroTd.setAttribute("align", "center");
        } catch (eTd) {}
      }
      var table = hero.closest("table");
      if (table && (table.closest("td.mc-unified-pdp-media, td.mc-pdp-media-td, #product_photo_td") || table.querySelector("#product_photo"))) {
        try {
          table.style.setProperty("width", "100%", "important");
          table.style.setProperty("max-width", "650px", "important");
        } catch (eTbl) {}
      }
    } catch (eCollapse) {}
  }

  function restoreMediaHeroAfterLogoMove() {
    var hero = global.document.getElementById("product_photo");
    if (!hero) return;
    try {
      collapseEmptyMediaLogoCells();
    } catch (eCol) {}
    try {
      hero.style.setProperty("display", "block", "important");
      hero.style.setProperty("width", "100%", "important");
      hero.style.setProperty("max-width", "650px", "important");
      hero.style.setProperty("height", "auto", "important");
      hero.style.setProperty("max-height", "none", "important");
      hero.style.setProperty("margin-left", "auto", "important");
      hero.style.setProperty("margin-right", "auto", "important");
    } catch (eHero) {}
    try {
      global.document
        .querySelectorAll("td.mc-unified-pdp-media img.vCSS_img_mfg_logo, td.mc-pdp-media-td img.vCSS_img_mfg_logo, #product_photo_td img.vCSS_img_mfg_logo")
        .forEach(function (img) {
          if (img.closest && img.closest("#mc-pdp-brand-logo")) return;
          try {
            img.style.setProperty("display", "none", "important");
          } catch (eHide) {}
        });
    } catch (eHideMfg) {}
  }

  function placeBrandLogoBelowTitle() {
    if (isSaranoniPdpPage()) {
      ensureSaranoniBrandLogo();
      return;
    }
    if (isMahjongHousePdpPage()) {
      ensureMahjongHouseBrandLogo();
      return;
    }
    if (isCordaroysBrandPdpPage()) {
      try { ensureBeanBagBrandLogo(); } catch (eBbLogo) {}
      return;
    }
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    var logoInWrap = wrap && wrap.querySelector("img");
    var mediaLogo = global.document.querySelector(
      "td.mc-unified-pdp-media img.vCSS_img_mfg_logo, td.mc-pdp-media-td img.vCSS_img_mfg_logo, #product_photo_td img.vCSS_img_mfg_logo, td.mc-unified-pdp-media img[src*='/manufacturers/'], td.mc-pdp-media-td img[src*='/manufacturers/']"
    );
    /* Keep retrying furniture PDPs until the mfg logo leaves the media column. */
    if (logoInWrap && (!mediaLogo || wrap.contains(mediaLogo))) {
      styleBrandLogoWrap(wrap, logoInWrap);
      restoreMediaHeroAfterLogoMove();
      return;
    }
    var logo = findManufacturerLogoImg() || mediaLogo;
    if (!logo) return;
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo";
    }
    if (logo.parentNode !== wrap) wrap.appendChild(logo);
    var col = findPdpHeroColumnTd();
    var titleEl = global.document.getElementById("mc-pdp-title-right");
    if (col && titleEl && titleEl.parentNode === col) {
      try {
        col.insertBefore(wrap, titleEl);
      } catch (eBeforeTitle) {}
    } else if (col && !col.contains(wrap)) {
      try {
        col.insertBefore(wrap, col.firstChild);
      } catch (eCol) {}
    }
    styleBrandLogoWrap(wrap, logo);
    restoreMediaHeroAfterLogoMove();
  }

  var SARANONI_BRAND_LOGO_SRC = "/v/vspfiles/photos/manufacturers/saranoni%20blankets.jpg";
  /* Restored from the known-good July 11 Bean Bag implementation. */
  var CORDAROYS_BRAND_LOGO_SRC = "/v/vspfiles/photos/manufacturers/mc-brand-cordaroys.png";
  var MAHJONG_HOUSE_BRAND_LOGO_SRC = "/v/vspfiles/photos/manufacturers/the%20mahjong%20house.png";
  var MAHJONG_HOUSE_BRAND_LOGO_SRC_FALLBACK =
    "/v/vspfiles/photos/manufacturers/the%20mahjong%20house.jpg";

  function ensureSaranoniBrandLogo() {
    if (!isSaranoniPdpPage()) return;
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (wrap && wrap.querySelector("img")) {
      positionSaranoniBrandLogo(wrap);
      try {
        wrap.style.setProperty("display", "block", "important");
        wrap.style.setProperty("visibility", "visible", "important");
        wrap.style.setProperty("opacity", "1", "important");
        var existing = wrap.querySelector("img");
        if (existing) {
          existing.style.setProperty("display", "block", "important");
          existing.style.setProperty("visibility", "visible", "important");
          existing.style.setProperty("opacity", "1", "important");
          existing.style.setProperty("max-height", "72px", "important");
          existing.style.setProperty("width", "auto", "important");
          existing.style.setProperty("margin", "0 auto", "important");
        }
      } catch (eLogoShow) {}
      return;
    }
    var logo = findManufacturerLogoImg();
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo";
    }
    if (logo) {
      wrap.appendChild(logo);
    } else {
      var img = global.document.createElement("img");
      img.className = "vCSS_img_mfg_logo";
      img.alt = "Saranoni";
      img.setAttribute("src", SARANONI_BRAND_LOGO_SRC);
      wrap.appendChild(img);
    }
    positionSaranoniBrandLogo(wrap);
    try {
      wrap.style.setProperty("display", "block", "important");
      wrap.style.setProperty("visibility", "visible", "important");
      wrap.style.setProperty("opacity", "1", "important");
    } catch (eLogoWrap) {}
  }

  function ensureBeanBagBrandLogo() {
    if (!isCordaroysBrandPdpPage()) return;
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo mc-pdp-brand-logo--cordaroys";
    } else {
      wrap.classList.add("mc-pdp-brand-logo--cordaroys");
    }
    var img = wrap.querySelector("img");
    var src = String((img && img.getAttribute("src")) || "");
    if (!img || src.indexOf(CORDAROYS_BRAND_LOGO_SRC) === -1) {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
      img = global.document.createElement("img");
      img.className = "vCSS_img_mfg_logo";
      img.alt = "Cordaroy's";
      img.setAttribute("src", CORDAROYS_BRAND_LOGO_SRC);
      wrap.appendChild(img);
    }
    try {
      img.style.setProperty("max-height", "42px", "important");
      img.style.setProperty("width", "auto", "important");
      img.style.setProperty("display", "block", "important");
    } catch (eCordaroysSize) {}
    positionSaranoniBrandLogo(wrap);
  }
  function positionSaranoniBrandLogo(wrap) {
    if (!wrap) return;
    var col = findPdpHeroColumnTd();
    var titleEl = global.document.getElementById("mc-pdp-title-right");
    if (col && titleEl && titleEl.parentNode === col && wrap.parentNode !== col) {
      try {
        col.insertBefore(wrap, titleEl);
      } catch (eIns) {}
    } else if (col && titleEl && titleEl.parentNode === col && wrap.nextElementSibling !== titleEl) {
      try {
        col.insertBefore(wrap, titleEl);
      } catch (eRe) {}
    } else if (col && !col.contains(wrap)) {
      try {
        col.appendChild(wrap);
      } catch (eCol) {}
    }
    try {
      ensureSaranoniVariantsBelowPrice();
    } catch (eLogoOrd) {}
  }

  function bindMahjongHouseBrandLogoFallback(img) {
    if (!img || img.dataset.mcMahjongLogoFallback === "1") return;
    img.dataset.mcMahjongLogoFallback = "1";
    img.addEventListener("error", function onMahjongLogoError() {
      var src = String(img.getAttribute("src") || "");
      if (/the%20mahjong%20house\.png/i.test(src)) {
        img.setAttribute("src", MAHJONG_HOUSE_BRAND_LOGO_SRC_FALLBACK);
      }
    });
  }

  function ensureMahjongHouseBrandLogo() {
    if (!isMahjongHousePdpPage()) return;
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo mc-pdp-brand-logo--mahjong-house";
    }
    wrap.classList.add("mc-pdp-brand-logo--mahjong-house");

    var current = wrap.querySelector("img");
    var currentHay = current ? String((current.getAttribute("src") || "") + " " + (current.getAttribute("alt") || "")).toLowerCase() : "";
    if (current && /saranoni/.test(currentHay)) {
      current = null;
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    }
    if (current && /mahjong|the%20mahjong%20house/.test(currentHay)) {
      current.alt = "The Mahjong House";
      if (!/the%20mahjong%20house/i.test(String(current.getAttribute("src") || ""))) {
        current.setAttribute("src", MAHJONG_HOUSE_BRAND_LOGO_SRC);
      }
      bindMahjongHouseBrandLogoFallback(current);
      positionSaranoniBrandLogo(wrap);
      hideMahjongHeroManufacturerLogo();
      return;
    }

    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    var logo = findManufacturerLogoImg();
    var logoHay = logo ? String((logo.getAttribute("src") || "") + " " + (logo.getAttribute("alt") || "")).toLowerCase() : "";
    if (logo && /mahjong|the%20mahjong%20house/.test(logoHay)) {
      logo.alt = "The Mahjong House";
      wrap.appendChild(logo);
    } else if (logo && !/saranoni/.test(logoHay)) {
      logo.alt = "The Mahjong House";
      wrap.appendChild(logo);
    } else {
      var img = global.document.createElement("img");
      img.className = "vCSS_img_mfg_logo";
      img.alt = "The Mahjong House";
      img.setAttribute("src", MAHJONG_HOUSE_BRAND_LOGO_SRC);
      bindMahjongHouseBrandLogoFallback(img);
      wrap.appendChild(img);
    }
    positionSaranoniBrandLogo(wrap);
    hideMahjongHeroManufacturerLogo();
  }

  function hideMahjongHeroManufacturerLogo() {
    if (!isMahjongHousePdpPage()) return;
    var brandWrap = global.document.getElementById("mc-pdp-brand-logo");
    global.document
      .querySelectorAll(
        "td.mc-pdp-media-td img[src*='/manufacturers/'], td.mc-unified-pdp-media img[src*='/manufacturers/'], #product_photo_td img[src*='/manufacturers/']"
      )
      .forEach(function (img) {
        if (img.id === "product_photo") return;
        if (brandWrap && brandWrap.contains(img)) return;
        try {
          img.style.setProperty("display", "none", "important");
        } catch (eHideMfg) {}
      });
  }

  function ensureMahjongHousePdpCss() {
    if (!isMahjongHousePdpPage()) return;
    var st = global.document.getElementById("mc-mahjong-house-pdp-css");
    if (!st) {
      st = global.document.createElement("style");
      st.id = "mc-mahjong-house-pdp-css";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
    st.textContent =
      "html body.mc-mahjong-house-pdp #mc-pdp-brand-logo{display:block!important;margin:0 auto 10px!important;padding:0!important;text-align:center!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-brand-logo img{display:block!important;width:auto!important;max-width:230px!important;max-height:82px!important;height:auto!important;margin:0 auto!important;object-fit:contain!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-title-right{display:block!important;width:100%!important;max-width:100%!important;margin:0 0 10px!important;padding:0!important;text-align:center!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-title-right h1,html body.mc-mahjong-house-pdp #mc-pdp-title-right [itemprop='name'],html body.mc-mahjong-house-pdp #mc-pdp-title-right .productnamecolorLARGE{display:block!important;margin:0!important;padding:0!important;text-align:center!important}" +
      "html body.mc-mahjong-house-pdp #mc-mahjong-price-host{display:block!important;width:100%!important;margin:0 0 14px!important;text-align:center!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-accordion,html body.mc-mahjong-house-pdp .mc-pdp-accordion{width:100%!important;max-width:100%!important;box-sizing:border-box!important;overflow:visible!important;padding-right:0!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-accordion *,html body.mc-mahjong-house-pdp .mc-pdp-accordion *{box-sizing:border-box!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:normal!important}" +
      "html body.mc-mahjong-house-pdp .mc-acc-panel,html body.mc-mahjong-house-pdp .mc-acc-content{width:100%!important;max-width:100%!important;overflow:visible!important;padding-right:0!important}" +
      "html body.mc-mahjong-house-pdp #mc-pdp-accordion #mc-pdp-description-below-features,html body.mc-mahjong-house-pdp #mc-pdp-accordion #mc-acc-saranoni-product-details-host,html body.mc-mahjong-house-pdp #mc-pdp-accordion #ProductDetail_ProductDetails_div,html body.mc-mahjong-house-pdp #mc-pdp-accordion #product_description{display:block!important;visibility:visible!important;opacity:1!important;height:auto!important;max-height:none!important;overflow:visible!important}" +
      "@media (min-width:992px){html body.mc-mahjong-house-pdp #content_area tr.mc-pdp-main-row,html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-pdp-main-row,html body.mc-mahjong-house-pdp #content_area tr.mc-unified-pdp-row,html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-unified-pdp-row{column-gap:24px!important;gap:24px!important;justify-content:center!important}html body.mc-mahjong-house-pdp td.mc-pdp-media-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-media{max-width:620px!important;padding-right:0!important}html body.mc-mahjong-house-pdp td.mc-pdp-options-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-info{width:440px!important;max-width:440px!important;min-width:420px!important;padding-left:0!important}html body.mc-mahjong-house-pdp td.mc-pdp-media-td img#product_photo,html body.mc-mahjong-house-pdp td.mc-unified-pdp-media img#product_photo{max-width:min(620px,100%)!important;margin-right:0!important}html body.mc-mahjong-house-pdp #mc-pdp-title-right,html body.mc-mahjong-house-pdp #mc-pdp-title-right h1,html body.mc-mahjong-house-pdp #mc-pdp-title-right [itemprop='name'],html body.mc-mahjong-house-pdp #mc-mahjong-price-host{text-align:left!important}}" +
      "@media (max-width:991px){html body.mc-mahjong-house-pdp #content_area,html body.mc-mahjong-house-pdp #v65-product-parent{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;box-sizing:border-box!important}html body.mc-mahjong-house-pdp #v65-product-parent>tbody,html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-pdp-main-row,html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-unified-pdp-row{display:flex!important;flex-direction:column!important;width:100%!important;max-width:100%!important}html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-pdp-main-row>td,html body.mc-mahjong-house-pdp #v65-product-parent tr.mc-unified-pdp-row>td,html body.mc-mahjong-house-pdp td.mc-pdp-media-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-media,html body.mc-mahjong-house-pdp td.mc-pdp-options-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-info{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important;float:none!important}html body.mc-mahjong-house-pdp td.mc-pdp-media-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-media{order:1!important}html body.mc-mahjong-house-pdp td.mc-pdp-options-td,html body.mc-mahjong-house-pdp td.mc-unified-pdp-info{order:2!important}html body.mc-mahjong-house-pdp #v65-product-parent .vCSS_breadcrumb_td:not(:has(h1)):not(:has(#mc-pdp-title-right)){display:none!important}html body.mc-mahjong-house-pdp #product_photo,html body.mc-mahjong-house-pdp a#product_photo_zoom_url{width:100%!important;max-width:650px!important;height:auto!important;margin-left:auto!important;margin-right:auto!important}html body.mc-mahjong-house-pdp #mc-mahjong-purchase-stack{width:100%!important;max-width:100%!important;box-sizing:border-box!important}}";
  }

  function findMahjongDescriptionSource() {
    var candidates = [
      global.document.getElementById("ProductDetail_ProductDetails_div"),
      global.document.querySelector(
        "#product_description[itemprop='description'], span[itemprop='description'], #product_description"
      ),
      global.document.getElementById("ProductDetail_ProductDetails_div2"),
    ];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!node || node.closest("#mc-pdp-accordion")) continue;
      var txt = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (txt.length > 10) return node;
    }
    return null;
  }

  /* Official themahjonghouse.com copy (MC_TMH_PRODUCT_DESCRIPTIONS) into Product Details. */
  function getMahjongProductCode() {
    try {
      var input = global.document.querySelector(
        'input[name="ProductCode"], input[name="productcode"]'
      );
      return String(
        (global.global_Current_ProductCode || "") || (input && input.value) || ""
      ).toUpperCase();
    } catch (eCode) {
      return "";
    }
  }

  function getMahjongOfficialDescriptionHtml(code) {
    var map = global.MC_TMH_PRODUCT_DESCRIPTIONS;
    if (!map || !code) return "";
    var html = String(map[code] || map[String(code).toUpperCase()] || "").trim();
    if (!html) return "";
    var shell = global.document.createElement("div");
    shell.innerHTML = html;
    shell.querySelectorAll("p, li").forEach(function (node) {
      var text = normalizeFeatureText(node.textContent || "");
      if (
        /^(?:material|dimensions?|weight|size|measurements?|contents?|includes?|set includes|tile (?:size|count)|number of tiles|racks?|mat(?:s)?|bag|case|care instructions?)\s*:/i.test(
          text
        )
      ) {
        try {
          node.remove();
        } catch (eRemoveFeature) {}
      }
    });
    return String(shell.innerHTML || "").trim();
  }

  function getMahjongOfficialFeaturesHtml(code) {
    var map = global.MC_TMH_PRODUCT_DESCRIPTIONS;
    if (!map || !code) return "";
    var html = String(map[code] || map[String(code).toUpperCase()] || "").trim();
    if (!html) return "";
    var shell = global.document.createElement("div");
    shell.innerHTML = html;
    var items = [];
    shell.querySelectorAll("p, li").forEach(function (node) {
      var text = normalizeFeatureText(node.textContent || "");
      if (
        /^(?:material|dimensions?|weight|size|measurements?|contents?|includes?|set includes|tile (?:size|count)|number of tiles|racks?|mat(?:s)?|bag|case|care instructions?)\s*:/i.test(
          text
        )
      ) {
        items.push("<li>" + escapeHtmlText(text) + "</li>");
      }
    });
    return buildFeaturesListHtml(items);
  }

  function ensureMahjongOfficialDescriptionsLoaded(done) {
    if (global.MC_TMH_PRODUCT_DESCRIPTIONS) {
      if (typeof done === "function") done(true);
      return;
    }
    if (global.document.getElementById("mc-tmh-product-descriptions-js")) {
      if (typeof done === "function") {
        var tries = 0;
        var iv = global.setInterval(function () {
          tries += 1;
          if (global.MC_TMH_PRODUCT_DESCRIPTIONS || tries > 40) {
            global.clearInterval(iv);
            done(!!global.MC_TMH_PRODUCT_DESCRIPTIONS);
          }
        }, 50);
      }
      return;
    }
    try {
      var s = global.document.createElement("script");
      s.id = "mc-tmh-product-descriptions-js";
      s.src =
        "/v/vspfiles/js/mc-tmh-product-descriptions.js?v=20260720tmhdesc1&mcrd=" +
        Date.now();
      s.async = true;
      s.onload = function () {
        if (typeof done === "function") done(!!global.MC_TMH_PRODUCT_DESCRIPTIONS);
      };
      s.onerror = function () {
        if (typeof done === "function") done(false);
      };
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eLoad) {
      if (typeof done === "function") done(false);
    }
  }

  /* MC_TMH_PREFER_VOLUSION_DESC_20260721 — the Product Details accordion
     should show Volusion's own ProductDescription field when admin has one
     entered; the static mc-tmh-product-descriptions.js file exists only to
     backfill products whose Volusion field is empty, not to silently
     override edits made in admin. */
  function mahjongNativeDescriptionHasContent() {
    var details =
      global.document.getElementById("ProductDetail_ProductDetails_div") ||
      global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (!details) return false;
    var text = String(details.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 20;
  }

  function applyMahjongOfficialDescriptions() {
    if (!isMahjongHousePdpPage()) return false;
    if (mahjongNativeDescriptionHasContent()) return false;
    var code = getMahjongProductCode();
    var html = getMahjongOfficialDescriptionHtml(code);
    if (!html) return false;
    var token = code + ":" + html.length;
    if (global.__MC_TMH_DESC_APPLIED__ === token) return true;

    var written = false;
    function writeNode(node) {
      if (!node) return;
      try {
        node.innerHTML = html;
        written = true;
      } catch (eWrite) {}
    }

    writeNode(global.document.getElementById("product_description"));
    global.document
      .querySelectorAll(
        "#ProductDetail_ProductDetails_div span[itemprop='description'], #ProductDetail_ProductDetails_div2 span[itemprop='description'], #mc-pdp-description-below-features #product_description, #mc-pdp-description-below-features span[itemprop='description'], #mc-acc-saranoni-product-details-host #product_description, #mc-acc-saranoni-product-details-host span[itemprop='description']"
      )
      .forEach(writeNode);

    if (!written) {
      var details =
        global.document.getElementById("ProductDetail_ProductDetails_div") ||
        global.document.getElementById("ProductDetail_ProductDetails_div2");
      if (details) {
        try {
          details.innerHTML =
            '<span id="product_description" itemprop="description">' +
            html +
            "</span>";
          written = true;
        } catch (eDetails) {}
      }
    }

    if (written) {
      global.__MC_TMH_DESC_APPLIED__ = token;
      try {
        global.document.documentElement.setAttribute(
          "data-mc-tmh-desc",
          "official-20260720"
        );
      } catch (eAttr) {}
    }
    return written;
  }

  function ensureMahjongDescriptionVisible() {
    if (!isMahjongHousePdpPage()) return;
    var nodes = global.document.querySelectorAll(
      "#mc-pdp-accordion #mc-pdp-description-below-features, #mc-pdp-accordion #mc-acc-saranoni-product-details-host, #mc-pdp-accordion #ProductDetail_ProductDetails_div, #mc-pdp-accordion #product_description, #mc-pdp-accordion .mc-pdp-description-below-features__inner"
    );
    Array.prototype.forEach.call(nodes, function (node) {
      if (!node) return;
      try {
        node.style.setProperty("display", "block", "important");
        node.style.setProperty("visibility", "visible", "important");
        node.style.setProperty("opacity", "1", "important");
        node.style.setProperty("height", "auto", "important");
        node.style.setProperty("max-height", "none", "important");
        node.style.setProperty("overflow", "visible", "important");
      } catch (eVis) {}
    });
  }

  function ensureMahjongAccordionClosed() {
    if (!isMahjongHousePdpPage()) return;
    global.document.querySelectorAll("#mc-pdp-accordion .mc-acc-row").forEach(function (row) {
      row.dataset.open = "0";
      var header = row.querySelector(".mc-acc-header");
      var panel = row.querySelector(".mc-acc-panel");
      if (header) {
        header.setAttribute("aria-expanded", "false");
        try {
          header.style.setProperty("display", "flex", "important");
          header.style.setProperty("align-items", "center", "important");
          header.style.setProperty("justify-content", "space-between", "important");
          header.style.setProperty("width", "100%", "important");
        } catch (eHdr) {}
      }
      if (panel) panel.setAttribute("aria-hidden", "true");
    });
  }

  function markMahjongPdpReady() {
    if (!isMahjongHousePdpPage()) return;
    if (global.__MC_MAHJONG_PDP_READY__) return;
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (!acc) return;
    var detailsHost = global.document.getElementById("mc-acc-saranoni-product-details-host");
    var descInAcc = acc.querySelector("#mc-pdp-description-below-features, #ProductDetail_ProductDetails_div, #product_description");
    var descText = String(
      (detailsHost && detailsHost.textContent) || (descInAcc && descInAcc.textContent) || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    if (descText.length < 20) return;
    ensureMahjongAccordionClosed();
    ensureMahjongDescriptionVisible();
    global.__MC_MAHJONG_PDP_READY__ = true;
    global.__MC_PDP_MO_PAUSE__ = true;
    global.__MC_UNIFIED_PDP_STABLE__ = true;
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-pdp-unified-ready");
        global.document.body.dataset.mcPdpLayoutMounted = "1";
      }
    } catch (eStable) {}
    function revealMahjongPdp() {
      try {
        if (global.document.documentElement) {
          global.document.documentElement.classList.add("mc-mahjong-pdp-ready");
          global.document.documentElement.classList.remove("mc-mahjong-pdp-init");
        }
        if (global.document.body) {
          global.document.body.classList.add("mc-mahjong-pdp-ready");
          global.document.body.classList.remove("mc-mahjong-pdp-init");
        }
        if (acc && acc.style) {
          acc.style.removeProperty("visibility");
          acc.style.setProperty("display", "block", "important");
        }
      } catch (eReady) {}
      markPdpHeroReady();
    }
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(revealMahjongPdp);
      });
    } else {
      revealMahjongPdp();
    }
  }

  function ensureMahjongPricePurchaseAndRelated(infoColumn) {
    if (!isMahjongHousePdpPage() || !infoColumn) return;
    var root = global.document.getElementById("v65-product-parent") || global.document;

    var priceHost = global.document.getElementById("mc-mahjong-price-host");
    if (!priceHost) {
      var nativePrice = Array.prototype.find.call(
        root.querySelectorAll(".product_productprice, .product_sale_price, .product_saleprice, #priceWithOptions"),
        function (node) {
          return !node.closest("#v65-product-related, #related_products_content");
        }
      );
      var amount = nativePrice
        ? String(nativePrice.textContent || "").replace(/\s+/g, " ").trim().replace(/^:\s*/, "").replace(/\.00\b/, "")
        : "";
      if (amount) {
        priceHost = global.document.createElement("div");
        priceHost.id = "mc-mahjong-price-host";
        priceHost.className = "mc-mahjong-price-host";
        priceHost.textContent = amount;
      }
    }
    if (priceHost) {
      var title = global.document.getElementById("mc-pdp-title-right");
      if (priceHost.parentNode !== infoColumn) {
        try {
          if (title && title.parentNode === infoColumn) {
            infoColumn.insertBefore(priceHost, title.nextElementSibling);
          } else {
            infoColumn.insertBefore(priceHost, infoColumn.firstChild);
          }
        } catch (ePriceMount) {}
      }
      try {
        if (title && title.parentNode === infoColumn && title.nextElementSibling !== priceHost) {
          infoColumn.insertBefore(priceHost, title.nextElementSibling);
        }
      } catch (ePriceOrder) {}
      priceHost.style.setProperty("display", "block", "important");
      priceHost.style.setProperty("width", "100%", "important");
      priceHost.style.setProperty("margin", "0 0 14px", "important");
      priceHost.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
      priceHost.style.setProperty("font-size", "16px", "important");
      priceHost.style.setProperty("line-height", "1.4", "important");
      priceHost.style.setProperty("color", "#444", "important");
    }

    function placeMahjongDesktopTitleAbovePurchase() {
      /* MC_MAHJONG_TITLE_ORDER_MOBILE_20260716 (re-applied — was lost when this
         file was re-synced to the live baseline): the desktop-only matchMedia
         gate meant mobile never got the title-above-purchase repositioning,
         leaving the product name under the ATC button there. The logic itself
         is viewport-independent; run it everywhere. */
      try {
        var desktopTitle = global.document.getElementById("mc-pdp-title-right");
        if (!desktopTitle || desktopTitle.parentNode !== infoColumn) return;
        var desktopLogo = global.document.getElementById("mc-pdp-brand-logo");
        var titleAnchor =
          desktopLogo && desktopLogo.parentNode === infoColumn
            ? desktopLogo.nextElementSibling
            : infoColumn.firstElementChild;
        if (titleAnchor !== desktopTitle) infoColumn.insertBefore(desktopTitle, titleAnchor);
      } catch (eDesktopTitleOrder) {}
    }

    function placeMahjongPriceBelowTitle() {
      try {
        var currentTitle = global.document.getElementById("mc-pdp-title-right");
        if (
          priceHost &&
          currentTitle &&
          currentTitle.parentNode === infoColumn &&
          currentTitle.nextElementSibling !== priceHost
        ) {
          infoColumn.insertBefore(priceHost, currentTitle.nextElementSibling);
        }
      } catch (ePriceLateOrder) {}
    }
    placeMahjongDesktopTitleAbovePurchase();
    placeMahjongPriceBelowTitle();

    var atc = root.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
    if (atc) {
      var atcWrap = atc.closest(".mc-atc-button-wrap") || wrapAtcButton(atc);
      var qty = root.querySelector('input.v65-productdetail-cartqty, input[name^="QTY."], input[name="QTY"], input[name="quantity"]');
      var stack = global.document.getElementById("mc-mahjong-purchase-stack");
      if (!stack) {
        stack = global.document.createElement("div");
        stack.id = "mc-mahjong-purchase-stack";
        stack.className = "mc-mahjong-purchase-stack";
      }
      var qtyRow = global.document.getElementById("mc-mahjong-qty-row");
      if (!qtyRow) {
        qtyRow = global.document.createElement("div");
        qtyRow.id = "mc-mahjong-qty-row";
        qtyRow.className = "mc-mahjong-qty-row";
      }
      var nativeQtyWrap = qty && qty.closest ? qty.closest(".vol-cartqty__wrap") : null;
      if (qty && !qtyRow.contains(qty)) {
        try { qtyRow.appendChild(qty); } catch (eQtyMove) {}
      }
      if (nativeQtyWrap && nativeQtyWrap !== qtyRow) {
        try { nativeQtyWrap.style.setProperty("display", "none", "important"); } catch (eHideNativeQty) {}
      }
      if (qty && qtyRow.parentNode !== stack) stack.appendChild(qtyRow);
      if (atcWrap && atcWrap.parentNode !== stack) stack.appendChild(atcWrap);
      var accordion = global.document.getElementById("mc-pdp-accordion");
      if (stack.parentNode !== infoColumn) {
        try {
          if (accordion && accordion.parentNode === infoColumn && accordion.nextSibling) {
            infoColumn.insertBefore(stack, accordion.nextSibling);
          } else {
            infoColumn.appendChild(stack);
          }
        } catch (eStackMount) {}
      }
      stack.style.setProperty("display", "flex", "important");
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("align-items", "stretch", "important");
      stack.style.setProperty("gap", "12px", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "100%", "important");
      stack.style.setProperty("margin", "18px 0 0", "important");
      stack.style.setProperty("box-sizing", "border-box", "important");
      qtyRow.style.setProperty("display", "flex", "important");
      qtyRow.style.setProperty("justify-content", "center", "important");
      qtyRow.style.setProperty("width", "100%", "important");
      if (qty) {
        qty.style.setProperty("display", "block", "important");
        qty.style.setProperty("width", "58px", "important");
        qty.style.setProperty("height", "38px", "important");
        qty.style.setProperty("margin", "0", "important");
        qty.style.setProperty("text-align", "center", "important");
      }
      if (atcWrap) {
        atcWrap.style.setProperty("display", "flex", "important");
        atcWrap.style.setProperty("width", "100%", "important");
        atcWrap.style.setProperty("max-width", "100%", "important");
      }
      atc.style.setProperty("width", "100%", "important");
      atc.style.setProperty("max-width", "100%", "important");
      atc.style.setProperty("min-height", "48px", "important");
      atc.style.setProperty("box-sizing", "border-box", "important");
    }

    function hideMahjongNativePurchaseBox() {
      infoColumn.querySelectorAll("table.colors_pricebox").forEach(function (nativeBox) {
        try {
          var managed =
            nativeBox.contains(priceHost) ||
            nativeBox.contains(global.document.getElementById("mc-mahjong-purchase-stack")) ||
            nativeBox.contains(global.document.getElementById("mc-pdp-accordion"));
          if (!managed && /(?:\$\s*\d|quantity)/i.test(String(nativeBox.textContent || ""))) {
            if (nativeBox.style.getPropertyValue("display") !== "none") {
              nativeBox.style.setProperty("display", "none", "important");
              nativeBox.style.setProperty("visibility", "hidden", "important");
              nativeBox.style.setProperty("height", "0", "important");
              nativeBox.style.setProperty("margin", "0", "important");
              nativeBox.style.setProperty("padding", "0", "important");
              nativeBox.style.setProperty("overflow", "hidden", "important");
            }
          }
        } catch (eNativeBox) {}
      });
    }
    hideMahjongNativePurchaseBox();

    function revealMahjongRelated() {
      var related = global.document.getElementById("related_products_content");
      if (!related) return;
      try {
        related.style.setProperty("display", "table-cell", "important");
        related.style.setProperty("visibility", "visible", "important");
        related.style.setProperty("opacity", "1", "important");
        related.style.setProperty("height", "auto", "important");
        related.style.setProperty("width", "100%", "important");
        var relatedRoot = global.document.getElementById("v65-product-related");
        if (relatedRoot) {
          relatedRoot.style.setProperty("display", "table", "important");
          relatedRoot.style.setProperty("visibility", "visible", "important");
          relatedRoot.style.setProperty("width", "100%", "important");
        }
      } catch (eRelated) {}
    }
    revealMahjongRelated();
    var related = global.document.getElementById("related_products_content");
    if (related && !related.dataset.mcMahjongRelatedRevealBound) {
      related.dataset.mcMahjongRelatedRevealBound = "1";
      [0, 250, 900].forEach(function (delay) {
        global.setTimeout(revealMahjongRelated, delay);
      });
      try {
        var purchaseObserver = new global.MutationObserver(function () {
          placeMahjongDesktopTitleAbovePurchase();
          placeMahjongPriceBelowTitle();
          hideMahjongNativePurchaseBox();
        });
        purchaseObserver.observe(infoColumn, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style"]
        });
        var relatedObserver = new global.MutationObserver(function () {
          if (related.style.getPropertyValue("display") === "none") revealMahjongRelated();
        });
        relatedObserver.observe(related, { attributes: true, attributeFilter: ["style"] });
      } catch (eMahjongLateOverride) {}
    }
  }

  function ensureMahjongHousePdpCorrections() {
    if (!isMahjongHousePdpPage()) return;
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-mahjong-house-pdp", "mc-mahjong-pdp-init");
        global.document.body.classList.remove("mc-saranoni-pdp", "mc-saranoni-pdp-init", "mc-saranoni-pdp-ready");
      }
      if (global.document.documentElement && !global.document.documentElement.classList.contains("mc-mahjong-pdp-init")) {
        global.document.documentElement.classList.add("mc-mahjong-pdp-init");
      }
      ensureMahjongHousePdpCss();
      ensurePdpTitleInOptionsColumn();
      ensureMahjongHouseBrandLogo();
      ensureMahjongOfficialDescriptionsLoaded(function () {
        try {
          applyMahjongOfficialDescriptions();
          mountPdpFeaturesBlock();
          ensureSaranoniPdpAccordion();
          ensureMahjongDescriptionVisible();
        } catch (eDescLoad) {}
      });
      applyMahjongOfficialDescriptions();
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      applyMahjongOfficialDescriptions();
      hideNativeVolusionTabPanels();
      ensureSaranoniPdpAccordion();
      applyMahjongOfficialDescriptions();
      var tmhCol = resolveSaranoniInfoColumn();
      if (tmhCol) {
        applyMahjongHouseInfoColumnOrder(tmhCol);
        try {
          tmhCol.style.setProperty("padding-left", "0", "important");
          tmhCol.style.setProperty("padding-right", "0", "important");
          tmhCol.style.setProperty("text-align", "left", "important");
          tmhCol.style.setProperty("box-sizing", "border-box", "important");
        } catch (eTmhCol) {}
        ensureMahjongPricePurchaseAndRelated(tmhCol);
        applyMahjongHouseInfoColumnOrder(tmhCol);
      }
      hideMahjongHeroManufacturerLogo();
      syncPdpDescriptionViewMore();
      markMahjongPdpReady();
    } catch (eTmh) {}
  }
  var placeBrandLogoAboveTitle = placeBrandLogoBelowTitle;

  function disableQuantityHiders() {
    try {
      var st = global.document.getElementById("mc-hide-all-quantity-final");
      if (st && st.parentNode) st.parentNode.removeChild(st);
    } catch (eRm) {}
  }

  function removeDuplicateQtyUi() {
    var root = global.document.getElementById("v65-product-parent") || global.document;
    ["mc-surgical-qty-row", "mc-final-qty-row", "mc-simple-final-qty-row"].forEach(function (id) {
      var el = global.document.getElementById(id);
      if (!el) return;
      try {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("height", "0", "important");
        el.style.setProperty("margin", "0", "important");
        el.style.setProperty("padding", "0", "important");
        el.setAttribute("aria-hidden", "true");
      } catch (eHide) {}
    });
    root.querySelectorAll(".v65-productdetail-cartqty").forEach(function (wrap) {
      if (wrap.closest("#mc-pdp-qty-row")) return;
      if (wrap.id === "mc-pdp-qty-row") return;
      try {
        wrap.style.setProperty("display", "none", "important");
      } catch (eWrap) {}
    });
    root.querySelectorAll(".vol-cartqty__wrap").forEach(function (wrap) {
      if (wrap.closest("#mc-pdp-qty-row")) return;
      var qtyInput = wrap.querySelector(
        'input[name^="QTY."], input[name="QTY"], input[name="quantity"]'
      );
      if (qtyInput && qtyInput.closest("#mc-pdp-qty-row")) {
        try {
          wrap.style.setProperty("display", "none", "important");
        } catch (eVolHide) {}
        return;
      }
      wrap.querySelectorAll("label").forEach(function (lab) {
        try {
          lab.style.setProperty("display", "none", "important");
        } catch (eLab) {}
      });
    });
    root.querySelectorAll("label").forEach(function (lab) {
      if (lab.closest("#mc-pdp-qty-row")) return;
      if (lab.classList && lab.classList.contains("mc-pdp-qty-row__label")) return;
      var txt = String(lab.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (txt === "quantity" || txt === "quantity:" || txt === "qty" || txt === "qty:") {
        try {
          lab.style.setProperty("display", "none", "important");
        } catch (eQtyLab) {}
      }
    });
    hideVolusionQuantityRows();
  }

  var MC_CART_ICON_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mc-cart-icon" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';

  function injectAtcButtonWrap(root) {
    root = root || global.document.getElementById("v65-product-parent") || global.document;
    var btn = root.querySelector(
      'input[name="btnaddtocart"], input[id*="btnaddtocart"], button[name="btnaddtocart"]'
    );
    if (!btn) return null;
    if (btn.tagName === "INPUT" && (btn.type || "").toLowerCase() === "image") {
      try {
        btn.type = "submit";
      } catch (eImg) {}
      btn.removeAttribute("src");
      if (!btn.value) btn.value = "ADD TO CART";
    }
    var existingWrap = btn.closest(".mc-atc-button-wrap");
    if (existingWrap) return existingWrap;
    var parent = btn.parentNode;
    if (!parent) return null;
    var wrapper = global.document.createElement("div");
    wrapper.className = "mc-atc-button-wrap";
    parent.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);
    var iconWrap = global.document.createElement("span");
    iconWrap.innerHTML = MC_CART_ICON_SVG;
    iconWrap.classList.add("mc-cart-icon-wrapper");
    wrapper.appendChild(iconWrap);
    return wrapper;
  }

  function resolveAtcPurchaseTarget(root) {
    root = root || global.document.getElementById("v65-product-parent") || global.document;
    injectAtcButtonWrap(root);
    var atcWrap = root.querySelector(".mc-atc-button-wrap");
    if (atcWrap) {
      var cartBlock = atcWrap.closest(".v65-product-addtocart");
      return {
        wrap: atcWrap,
        cartBlock: cartBlock,
        stackNode: cartBlock || atcWrap,
      };
    }
    var btn = root.querySelector(
      'input[name="btnaddtocart"], button[name="btnaddtocart"], input[id*="btnaddtocart"]'
    );
    if (!btn) return null;
    var cartBlock2 = btn.closest(".v65-product-addtocart");
    return {
      wrap: null,
      cartBlock: cartBlock2,
      stackNode: cartBlock2 || btn.parentElement || btn,
    };
  }

  function findPurchaseStackAnchor() {
    if (isSaranoniPdpPage()) {
      var sarCol = resolveSaranoniInfoColumn();
      if (sarCol) {
        var sarAcc = global.document.getElementById("mc-pdp-accordion");
        if (sarAcc && sarCol.contains(sarAcc)) {
          return { parent: sarCol, after: sarAcc };
        }
        var sarSize = global.document.getElementById("mc-saranoni-size-thumbs");
        if (sarSize && sarCol.contains(sarSize)) {
          return { parent: sarCol, after: sarSize };
        }
        var sarColor = global.document.getElementById("mc-configured-color-swatch-wrapper");
        if (sarColor && sarCol.contains(sarColor)) {
          return { parent: sarCol, after: sarColor };
        }
        var sarOpt = global.document.getElementById("mc-pdp-option-block");
        if (sarOpt && sarCol.contains(sarOpt)) {
          return { parent: sarCol, after: sarOpt };
        }
        var sarBnpl = global.document.getElementById("messaging-element");
        if (sarBnpl && sarCol.contains(sarBnpl)) {
          return { parent: sarCol, after: sarBnpl };
        }
        var sarPrice = global.document.getElementById("mc-pdp-price-stack-host");
        if (sarPrice && sarCol.contains(sarPrice)) {
          return { parent: sarCol, after: sarPrice };
        }
        return { parent: sarCol, after: null };
      }
    }
    /* Bean bag Features live inside #mc-pdp-accordion. Never anchor ATC to
       #mc-pdp-features or its .mc-acc-panel — that hides Add to Cart. */
    if (isBeanBagPdpPage()) {
      var bbCol = findPdpHeroColumnTd();
      if (bbCol) {
        var bbAcc = global.document.getElementById("mc-pdp-accordion");
        if (bbAcc && bbCol.contains(bbAcc)) {
          return { parent: bbCol, after: bbAcc };
        }
        var bbCover = global.document.getElementById("beanbag-swatch-wrapper");
        if (bbCover && bbCol.contains(bbCover)) {
          return { parent: bbCol, after: bbCover };
        }
        var bbSize = global.document.getElementById("mc-bb-size-section");
        if (bbSize && bbCol.contains(bbSize)) {
          return { parent: bbCol, after: bbSize };
        }
        var bbPrice = global.document.getElementById("mc-pdp-price-stack-host");
        if (bbPrice && bbCol.contains(bbPrice)) {
          return { parent: bbCol, after: bbPrice };
        }
        return { parent: bbCol, after: null };
      }
    }
    var features = global.document.getElementById("mc-pdp-features");
    if (features && features.parentNode && !features.closest("#mc-pdp-accordion")) {
      return { parent: features.parentNode, after: features };
    }
    var accordion = global.document.getElementById("mc-pdp-accordion");
    if (accordion && accordion.parentNode) {
      return { parent: accordion.parentNode, after: accordion };
    }
    var desc = global.document.getElementById("mc-pdp-description-below-features");
    if (desc && desc.parentNode && !desc.closest("#mc-pdp-accordion")) {
      return { parent: desc.parentNode, after: desc };
    }
    var opt = global.document.getElementById("mc-pdp-option-block");
    if (opt && opt.parentNode) {
      return { parent: opt.parentNode, after: opt };
    }
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    if (price && price.parentNode) {
      return { parent: price.parentNode, after: price };
    }
    var bnpl = global.document.getElementById("messaging-element");
    if (bnpl && bnpl.parentNode) {
      return { parent: bnpl.parentNode, after: bnpl };
    }
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (box && box.parentNode) {
      return { parent: box.parentNode, after: box };
    }
    return null;
  }

  function ensureQuantityAboveAtc() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage()) return;
    if (shouldDeferToUnifiedPdpLayout() && !isSoftGoodsPdpPage() && !isUnifiedAccordionPdp()) return;
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage() && !isUnifiedAccordionPdp()) return;
    if (isSaranoniPdpPage()) {
      var sarCol = resolveSaranoniInfoColumn();
      var sarStack = global.document.getElementById("mc-pdp-purchase-stack");
      if (!sarCol || !sarStack || !sarCol.contains(sarStack)) return;
    }
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp")) &&
        !isBeanBagPdpPage() &&
        !isSaranoniPdpPage()
      ) {
        return;
      }
    } catch (eSkip) {}
    removeDuplicateQtyUi();
    var root = global.document.getElementById("v65-product-parent") || global.document;
    var purchaseTarget = resolveAtcPurchaseTarget(root);
    if (!purchaseTarget || !purchaseTarget.stackNode) return;
    var qty = root.querySelector(
      'input.v65-productdetail-cartqty, input[name^="QTY."], input[name="QTY"], input[name="quantity"]'
    );
    if (!qty) return;
    var stackNode = purchaseTarget.stackNode;
    if (!stackNode.parentNode) return;
    var insertParent = stackNode.parentNode;
    var row = global.document.getElementById("mc-pdp-qty-row");
    if (!row) {
      row = global.document.createElement("div");
      row.id = "mc-pdp-qty-row";
      row.className = "mc-pdp-qty-row";
      var lab = global.document.createElement("span");
      lab.className = "mc-pdp-qty-row__label";
      lab.textContent = "Quantity";
      row.appendChild(lab);
    }
    if (!row.contains(qty)) row.appendChild(qty);
    if (row.parentNode !== insertParent || row.nextElementSibling !== stackNode) {
      insertParent.insertBefore(row, stackNode);
    }
    row.style.setProperty("display", "inline-flex", "important");
    row.style.setProperty("flex-direction", "row", "important");
    row.style.setProperty("align-items", "center", "important");
    row.style.setProperty("justify-content", "center", "important");
    row.style.setProperty("text-align", "center", "important");
    row.style.setProperty("gap", "0", "important");
    row.style.setProperty("width", "auto", "important");
    row.style.setProperty("max-width", "none", "important");
    row.style.setProperty("margin", "0", "important");
    row.style.setProperty("padding", "0", "important");
    row.style.setProperty("visibility", "visible", "important");
    row.style.setProperty("opacity", "1", "important");
    row.style.setProperty("height", "auto", "important");
    qty.style.setProperty("display", "inline-block", "important");
    qty.style.setProperty("visibility", "visible", "important");
    qty.style.setProperty("opacity", "1", "important");
    qty.style.setProperty("width", "58px", "important");
    qty.style.setProperty("min-width", "58px", "important");
    qty.style.setProperty("height", isSoftGoodsPdpPage() ? "48px" : "38px", "important");
    qty.style.setProperty("margin", "0", "important");
    qty.style.setProperty("padding", "0", "important");
    qty.style.setProperty("text-align", "center", "important");
    qty.style.setProperty("border", "1px solid " + PDP_CHROME_BORDER, "important");
    qty.style.setProperty("border-radius", "0", "important");
    qty.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
    qty.style.setProperty("font-size", "14px", "important");
    qty.style.setProperty("color", "#444", "important");
    var labEl = row.querySelector(".mc-pdp-qty-row__label");
    if (labEl) {
      labEl.style.setProperty("display", "none", "important");
    }
    ensurePurchaseStackCentered();
    hideVolusionQuantityRows();
  }

  function ensurePurchaseStackCentered() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage()) return;
    if (shouldDeferToUnifiedPdpLayout() && !isSoftGoodsPdpPage() && !isUnifiedAccordionPdp()) return;
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage() && !isUnifiedAccordionPdp()) return;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp")) &&
        !isBeanBagPdpPage() &&
        !isSaranoniPdpPage()
      ) {
        return;
      }
    } catch (eSkip) {}
    var root = global.document.getElementById("v65-product-parent") || global.document;
    var purchaseTarget = resolveAtcPurchaseTarget(root);
    if (!purchaseTarget || !purchaseTarget.stackNode) return;
    var row = global.document.getElementById("mc-pdp-qty-row");
    var stackNode = purchaseTarget.stackNode;
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    if (!stack) {
      stack = global.document.createElement("div");
      stack.id = "mc-pdp-purchase-stack";
    }
    // Always carry the stable class used by CSS (includes anti-flicker rule).
    // mc-pdp-cart-row is the shared qty+ATC container contract used by custom-safe.css.
    stack.className = "mc-pdp-purchase-controls mc-pdp-cart-row";
    if (row && !stack.contains(row)) stack.appendChild(row);
    if (!stack.contains(stackNode)) stack.appendChild(stackNode);
    if (isSoftGoodsPdpPage() && row && stackNode && stack.contains(row) && stack.contains(stackNode)) {
      try {
        if (row.nextElementSibling !== stackNode) {
          stack.insertBefore(row, stackNode);
        }
      } catch (eOrd) {}
    }
    var anchor = findPurchaseStackAnchor();
    var targetParent = anchor ? anchor.parent : stackNode.parentNode;
    if (targetParent) {
      var after = anchor ? anchor.after : null;
      if (stack.parentNode !== targetParent) {
        try {
          if (after && after.nextSibling) {
            targetParent.insertBefore(stack, after.nextSibling);
          } else if (after) {
            targetParent.appendChild(stack);
          } else {
            targetParent.appendChild(stack);
          }
        } catch (eIns) {}
      } else if (after && stack.previousElementSibling !== after) {
        try {
          if (after.nextSibling) {
            targetParent.insertBefore(stack, after.nextSibling);
          } else {
            targetParent.appendChild(stack);
          }
        } catch (eRe) {}
      }
    }
    try {
      stack.style.setProperty("display", "flex", "important");
      var mcCartGap = "28px";
      var mcStackDir = "row";
      var mcAlign = "center";
      try {
        var bcl = global.document.body && global.document.body.classList;
        if (bcl && bcl.contains("mc-bean-bag-pdp")) {
          mcStackDir = "column";
          mcCartGap = "10px";
          mcAlign = "stretch";
        } else if (bcl && bcl.contains("mc-saranoni-pdp")) {
          mcStackDir = "column";
          mcCartGap = "10px";
          mcAlign = "stretch";
        }
      } catch (eGap) {}
      stack.style.setProperty("flex-direction", mcStackDir, "important");
      stack.style.setProperty("align-items", mcAlign, "important");
      stack.style.setProperty("justify-content", isSaranoniPdpPage() ? "flex-start" : "center", "important");
      stack.style.setProperty("align-self", "stretch", "important");
      stack.style.setProperty("text-align", isSaranoniPdpPage() ? "left" : "center", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "100%", "important");
      stack.style.setProperty(
        "margin",
        isSaranoniPdpPage() ? "18px 0 0 0" : "28px auto 0",
        "important"
      );
      stack.style.setProperty("padding", "0", "important");
      stack.style.setProperty("gap", mcCartGap, "important");
      stack.style.setProperty("flex-wrap", "wrap", "important");
      stack.style.setProperty("clear", "both", "important");
    } catch (eStack) {}
    if (isSoftGoodsPdpPage()) {
      applySoftGoodsColumnPurchaseStackLayout(stack, row, stackNode);
    }
    if (row) {
      try {
        row.style.setProperty("flex", "0 0 auto", "important");
      } catch (eRow) {}
    }
    try {
      stackNode.style.setProperty("width", isSaranoniPdpPage() ? "100%" : "auto", "important");
      stackNode.style.setProperty("max-width", isSaranoniPdpPage() ? "100%" : "none", "important");
      stackNode.style.setProperty("display", "flex", "important");
      stackNode.style.setProperty(
        "justify-content",
        isSaranoniPdpPage() ? "stretch" : "center",
        "important"
      );
      stackNode.style.setProperty("margin", isSaranoniPdpPage() ? "0" : "0 auto", "important");
      stackNode.style.setProperty("flex", "0 0 auto", "important");
    } catch (eAtcBlock) {}
    if (isSaranoniPdpPage()) {
      var sarColPin = resolveSaranoniInfoColumn();
      if (sarColPin && stack && stack.parentNode !== sarColPin) {
        try {
          sarColPin.appendChild(stack);
        } catch (ePinStack) {}
      }
      hideSaranoniLeftoverNativeShell(sarColPin);
    }
  }


  function ejectQtyFromAtcWrap() {
    try {
      global.document.querySelectorAll(".mc-atc-button-wrap, .mc-unified-atc-host, .v65-product-addtocart").forEach(function (wrap) {
        if (!wrap) return;
        var qtyRow = wrap.querySelector("#mc-pdp-qty-row, .mc-unified-qty-row, .mc-pdp-qty-row");
        var qtyInput = wrap.querySelector('input[name^="QTY."], input.v65-productdetail-cartqty, input[name="QTY"], input[name="quantity"]');
        if (!qtyRow && qtyInput) {
          qtyRow = qtyInput.closest("#mc-pdp-qty-row, .mc-unified-qty-row, .mc-pdp-qty-row");
        }
        if (!qtyRow && !qtyInput) return;
        var purchase =
          wrap.closest("#mc-pdp-purchase-stack, .mc-unified-purchase-controls, .mc-pdp-purchase-controls, .mc-pdp-cart-row") ||
          wrap.parentElement;
        if (!purchase) return;
        if (qtyRow) {
          if (qtyRow.parentNode === wrap || wrap.contains(qtyRow)) {
            purchase.insertBefore(qtyRow, wrap);
          }
        } else if (qtyInput && wrap.contains(qtyInput)) {
          var row = global.document.getElementById("mc-pdp-qty-row");
          if (!row) {
            row = global.document.createElement("div");
            row.id = "mc-pdp-qty-row";
            row.className = "mc-pdp-qty-row mc-unified-qty-row";
          }
          row.appendChild(qtyInput);
          purchase.insertBefore(row, wrap);
        }
      });
    } catch (eEject) {}
  }

  function finalizeCordaroysPurchaseStack() {
    return finalizeColumnPurchaseStack();
  }

  function finalizeColumnPurchaseStack() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage() && !isFixedSectionalUnifiedPdp()) return;
    if (!isSoftGoodsPdpPage() && !isUnifiedAccordionPdp()) return;
    try { ejectQtyFromAtcWrap(); } catch (eEj0) {}
    try { ensureQuantityAboveAtc(); } catch (eQty0) {}
    try { ensurePurchaseStackCentered(); } catch (eStack0) {}
    var info =
      global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      findPdpHeroColumnTd();
    var purchase = resolveSoftGoodsPurchaseElement(info);
    if (!purchase) {
      purchase =
        global.document.getElementById("mc-pdp-purchase-stack") ||
        global.document.querySelector(".mc-unified-purchase-controls, .mc-pdp-purchase-controls");
    }
    if (!purchase) return;
    try {
      purchase.id = purchase.id || "mc-pdp-purchase-stack";
      purchase.classList.add("mc-pdp-purchase-controls", "mc-pdp-cart-row");
      if (isSoftGoodsPdpPage()) purchase.classList.add("mc-soft-goods-purchase-stack");
      if (isBeanBagPdpPage()) purchase.classList.add("mc-bean-bag-purchase-stack");
      if (isCordaroysExtendedPdpPage()) purchase.classList.add("mc-cordaroys-purchase-stack");
      purchase.style.setProperty("display", "flex", "important");
      purchase.style.setProperty("flex-direction", "column", "important");
      purchase.style.setProperty("align-items", "stretch", "important");
      purchase.style.setProperty("justify-content", "flex-start", "important");
      purchase.style.setProperty("width", "100%", "important");
      purchase.style.setProperty("max-width", "435px", "important");
      purchase.style.setProperty("gap", "10px", "important");
      purchase.style.setProperty("margin", "18px 0 0 0", "important");
    } catch (ePur) {}
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    var wrap =
      purchase.querySelector(".mc-atc-button-wrap, .mc-unified-atc-host, .v65-product-addtocart") ||
      null;
    if (qtyRow && wrap && qtyRow.parentNode === purchase) {
      try {
        if (qtyRow.nextElementSibling !== wrap) purchase.insertBefore(qtyRow, wrap);
        qtyRow.style.setProperty("order", "1", "important");
        qtyRow.style.setProperty("width", "100%", "important");
        qtyRow.style.setProperty("display", "flex", "important");
        qtyRow.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("order", "2", "important");
      } catch (eOrd) {}
    }
    if (wrap) {
      try {
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("flex-direction", "row", "important");
        wrap.style.setProperty("align-items", "center", "important");
        wrap.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("width", "100%", "important");
        wrap.style.setProperty("max-width", "100%", "important");
        wrap.style.setProperty("margin", "0", "important");
        wrap.style.setProperty("background", "#000", "important");
        wrap.style.setProperty("background-color", "#000", "important");
        wrap.style.setProperty("border", "1px solid #fff", "important");
      } catch (eWrapCol) {}
      var btn =
        wrap.querySelector("input[name='btnaddtocart'], button[name='btnaddtocart'], input[type='submit']") ||
        (wrap.matches && wrap.matches("input[name='btnaddtocart'], button[name='btnaddtocart']") ? wrap : null);
      if (btn) {
        try {
          btn.style.setProperty("width", "100%", "important");
          btn.style.setProperty("max-width", "100%", "important");
          btn.style.setProperty("display", "flex", "important");
          btn.style.setProperty("align-items", "center", "important");
          btn.style.setProperty("justify-content", "center", "important");
          btn.style.setProperty("min-height", "48px", "important");
          btn.style.setProperty("box-sizing", "border-box", "important");
          btn.style.setProperty("background", "#000", "important");
          btn.style.setProperty("background-color", "#000", "important");
          btn.style.setProperty("color", "#fff", "important");
          btn.style.setProperty("border", "1px solid #fff", "important");
        } catch (eBtnCol) {}
      }
    }
    if (isSoftGoodsPdpPage()) {
      applySoftGoodsColumnPurchaseStackLayout(purchase, qtyRow, wrap);
    }
    try { ejectQtyFromAtcWrap(); } catch (eEj1) {}
  }

  function applySoftGoodsColumnPurchaseStackLayout(stack, qtyRow, stackNode) {
    if (!isSoftGoodsPdpPage() || !stack) return;
    try {
      stack.classList.add("mc-pdp-cart-row", "mc-soft-goods-purchase-stack");
      if (isSaranoniPdpPage()) stack.classList.add("mc-saranoni-purchase-stack");
      if (isBeanBagPdpPage()) stack.classList.add("mc-bean-bag-purchase-stack");
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("align-items", "stretch", "important");
      stack.style.setProperty("max-width", "435px", "important");
      stack.style.setProperty("width", "100%", "important");
      if (isSaranoniPdpPage()) {
        stack.style.setProperty("margin-left", "0", "important");
        stack.style.setProperty("margin-right", "0", "important");
      }
    } catch (eStack) {}
    if (qtyRow) {
      try {
        qtyRow.style.setProperty("width", "100%", "important");
        qtyRow.style.setProperty("justify-content", "center", "important");
      } catch (eQty) {}
    }
    var wrap = stack.querySelector(".mc-atc-button-wrap");
    if (wrap) {
      try {
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("width", "100%", "important");
        wrap.style.setProperty("max-width", "100%", "important");
        wrap.style.setProperty("margin", "0", "important");
      } catch (eWrap) {}
      var btn = wrap.querySelector(
        "input[name='btnaddtocart'], button[name='btnaddtocart'], input[type='submit']"
      );
      if (btn) {
        try {
          btn.style.setProperty("width", "100%", "important");
          btn.style.setProperty("display", "flex", "important");
          btn.style.setProperty("align-items", "center", "important");
          btn.style.setProperty("justify-content", "center", "important");
          btn.style.setProperty("text-align", "center", "important");
          btn.style.setProperty("text-indent", "0.12em", "important");
          btn.style.setProperty("box-sizing", "border-box", "important");
        } catch (eBtn) {}
      }
    }
    if (stackNode) {
      try {
        stackNode.style.setProperty("width", "100%", "important");
        stackNode.style.setProperty("max-width", "100%", "important");
        stackNode.style.setProperty("display", "flex", "important");
        stackNode.style.setProperty("flex-direction", "column", "important");
        stackNode.style.setProperty("justify-content", "stretch", "important");
      } catch (eNode) {}
    }
  }

  global.mcEnsurePurchaseStackCentered = ensurePurchaseStackCentered;
  global.mcResolveAtcPurchaseTarget = resolveAtcPurchaseTarget;

  function featuresAccentColor() {
    var feat = global.document.querySelector(
      "#mc-pdp-features .mc-pdp-features__heading, .mc-pdp-features__heading"
    );
    if (feat) {
      try {
        var c = global.getComputedStyle(feat).color;
        if (c && c !== "rgba(0, 0, 0, 0)") return c;
      } catch (eCol) {}
    }
    return "rgb(119, 119, 119)";
  }

  // Single source of truth for the Add-to-Cart look: a transparent, borderless
  // wrapper with a solid dark button inside. No outer box = no "second box".
  function applySoftGoodsAtcChrome(wrap) {
    if (!wrap || !isSoftGoodsPdpPage()) return;
    wrap.classList.add("mc-soft-goods-atc-wrap");
    try {
      wrap.style.setProperty("display", "inline-flex", "important");
      wrap.style.setProperty("align-items", "center", "important");
      wrap.style.setProperty("justify-content", "center", "important");
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("max-width", "100%", "important");
      wrap.style.setProperty("background", "#111", "important");
      wrap.style.setProperty("background-color", "#111", "important");
      wrap.style.setProperty("border", "1px solid #111", "important");
      wrap.style.setProperty("border-radius", "0", "important");
      wrap.style.setProperty("box-shadow", "none", "important");
      wrap.style.setProperty("padding", "0", "important");
      wrap.style.setProperty("margin", "0", "important");
      wrap.style.setProperty("margin-top", "0", "important");
      wrap.style.setProperty("min-width", "0", "important");
      wrap.style.setProperty("gap", "0", "important");
      wrap.style.setProperty("color", "#fff", "important");
    } catch (eWrap) {}
    var icon = wrap.querySelector(".mc-cart-icon-wrapper");
    if (icon) {
      try {
        icon.style.setProperty("display", "none", "important");
      } catch (eIcon) {}
    }
    var btn = wrap.querySelector(
      "input[name='btnaddtocart'], button[name='btnaddtocart'], input[type='submit']"
    );
    if (!btn) return;
    try {
      if (btn.tagName === "INPUT" && (btn.type || "").toLowerCase() === "image") {
        btn.type = "submit";
        btn.removeAttribute("src");
        if (!btn.value) btn.value = "ADD TO CART";
      }
      btn.style.removeProperty("background");
      btn.style.removeProperty("background-color");
      btn.style.removeProperty("color");
      btn.style.removeProperty("border");
      btn.style.setProperty("background", "#111", "important");
      btn.style.setProperty("background-color", "#111", "important");
      btn.style.setProperty("background-image", "none", "important");
      btn.style.setProperty("color", "#fff", "important");
      btn.style.setProperty("border", "1px solid #111", "important");
      btn.style.setProperty("border-radius", "0", "important");
      btn.style.setProperty("box-shadow", "none", "important");
      btn.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
      btn.style.setProperty("font-size", "13px", "important");
      btn.style.setProperty("font-weight", "600", "important");
      btn.style.setProperty("letter-spacing", "0.12em", "important");
      btn.style.setProperty("text-transform", "uppercase", "important");
      btn.style.setProperty("line-height", "48px", "important");
      btn.style.setProperty("padding", "0 28px", "important");
      /* Letter-spacing shifts perceived center left on <input type=submit>. */
      btn.style.setProperty("text-indent", "0.12em", "important");
      btn.style.setProperty("min-height", "48px", "important");
      btn.style.setProperty("opacity", "1", "important");
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("display", "flex", "important");
      btn.style.setProperty("align-items", "center", "important");
      btn.style.setProperty("justify-content", "center", "important");
      btn.style.setProperty("text-align", "center", "important");
      btn.style.setProperty("box-sizing", "border-box", "important");
      btn.style.setProperty("-webkit-appearance", "none", "important");
      btn.style.setProperty("appearance", "none", "important");
    } catch (eBtn) {}
    forceBlackAtcWrap(wrap);
  }

  function forceBlackAtcButton(btn) {
    if (!btn) return;
    try {
      if (btn.tagName === "INPUT" && (btn.type || "").toLowerCase() === "image") {
        btn.type = "submit";
        btn.removeAttribute("src");
      }
      if (btn.tagName === "INPUT" && !btn.value) btn.value = "ADD TO CART";
      btn.classList.add("mc-unified-atc-btn");
      btn.style.setProperty("background", "#000", "important");
      btn.style.setProperty("background-color", "#000", "important");
      btn.style.setProperty("background-image", "none", "important");
      btn.style.setProperty("color", "#fff", "important");
      btn.style.setProperty("border", "1px solid #000", "important");
      btn.style.setProperty("border-color", "#000", "important");
      btn.style.setProperty("box-shadow", "none", "important");
      btn.style.setProperty("text-shadow", "none", "important");
      btn.style.setProperty("opacity", "1", "important");
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("max-width", "100%", "important");
      btn.style.setProperty("box-sizing", "border-box", "important");
      btn.style.setProperty("-webkit-appearance", "none", "important");
      btn.style.setProperty("appearance", "none", "important");
    } catch (eForceBtn) {}
  }

  function forceBlackAtcWrap(wrap) {
    if (!wrap) return;
    try {
      wrap.style.setProperty("background", "#000", "important");
      wrap.style.setProperty("background-color", "#000", "important");
      wrap.style.setProperty("border", "1px solid #000", "important");
      wrap.style.setProperty("border-color", "#000", "important");
      wrap.style.setProperty("color", "#fff", "important");
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("max-width", "100%", "important");
      wrap.style.setProperty("box-sizing", "border-box", "important");
      wrap.querySelectorAll("input, button").forEach(function (btn) {
        forceBlackAtcButton(btn);
      });
    } catch (eForceWrap) {}
  }

  function styleCompactAtcButton(wrap) {
    if (!wrap) return;
    if (isSoftGoodsPdpPage()) {
      applySoftGoodsAtcChrome(wrap);
      return;
    }
    try {
      wrap.style.setProperty("border", "none", "important");
      wrap.style.setProperty("border-color", "transparent", "important");
      wrap.style.setProperty("box-shadow", "none", "important");
      wrap.style.setProperty("border-radius", "0", "important");
      wrap.style.setProperty("background", "transparent", "important");
      wrap.style.setProperty("background-color", "transparent", "important");
      wrap.style.setProperty("padding", "0", "important");
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("min-width", "0", "important");
      wrap.style.setProperty("max-width", "none", "important");
      wrap.style.setProperty("display", "inline-flex", "important");
      wrap.style.setProperty("align-items", "center", "important");
      wrap.style.setProperty("justify-content", "center", "important");
      wrap.style.setProperty("gap", "0", "important");
      var icon = wrap.querySelector(".mc-cart-icon-wrapper");
      if (icon) icon.style.setProperty("display", "none", "important");
      var btn = wrap.querySelector(
        "input[name='btnaddtocart'], button[name='btnaddtocart'], input[type='submit'], input, button"
      );
      if (btn) {
        var softGoods = isSoftGoodsPdpPage();
        btn.style.setProperty("border", "1px solid #111", "important");
        btn.style.setProperty("box-shadow", "none", "important");
        btn.style.setProperty("background", "#111", "important");
        btn.style.setProperty("background-color", "#111", "important");
        btn.style.setProperty("background-image", "none", "important");
        btn.style.setProperty("color", "#fff", "important");
        btn.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
        btn.style.setProperty("font-size", "13px", "important");
        btn.style.setProperty("font-weight", "600", "important");
        btn.style.setProperty("letter-spacing", "0.12em", "important");
        btn.style.setProperty("text-transform", "uppercase", "important");
        btn.style.setProperty("line-height", "1", "important");
        btn.style.setProperty("padding", "0 28px", "important");
        btn.style.setProperty("min-height", "48px", "important");
        btn.style.setProperty("margin", "0", "important");
        btn.style.setProperty("width", "100%", "important");
        btn.style.setProperty("min-width", "0", "important");
        btn.style.setProperty("max-width", "none", "important");
        btn.style.setProperty("border-radius", "0", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        forceBlackAtcButton(btn);
      }
      forceBlackAtcWrap(wrap);
    } catch (eAtc) {}
  }

  function fixAddToCartChrome() {
    injectAtcButtonWrap();
    try { forceRevealCanonicalAtc(); } catch (eAtcFix) {}
    global.document.querySelectorAll(".mc-atc-button-wrap").forEach(function (wrap) {
      styleCompactAtcButton(wrap);
      forceBlackAtcWrap(wrap);
      wrap.setAttribute("data-mc-atc-styled", VERSION);
    });
    global.document
      .querySelectorAll(
        '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], ' +
          '#v65-product-parent input[id*="btnaddtocart"], #content_area input[name="btnaddtocart"], ' +
          '#content_area button[name="btnaddtocart"]'
      )
      .forEach(function (btn) {
        var wrap = btn.closest(".mc-atc-button-wrap");
        if (wrap && isSoftGoodsPdpPage()) {
          applySoftGoodsAtcChrome(wrap);
          forceBlackAtcWrap(wrap);
          wrap.setAttribute("data-mc-atc-styled", VERSION);
          btn.setAttribute("data-mc-atc-styled", VERSION);
          return;
        }
        if (wrap) {
          styleCompactAtcButton(wrap);
          forceBlackAtcWrap(wrap);
          wrap.setAttribute("data-mc-atc-styled", VERSION);
          btn.setAttribute("data-mc-atc-styled", VERSION);
          return;
        }
        try {
          if (btn.tagName === "INPUT" && (btn.type || "").toLowerCase() === "image") {
            btn.type = "submit";
            btn.removeAttribute("src");
          }
          if (!btn.value && btn.tagName === "INPUT") btn.value = "ADD TO CART";
        } catch (eTyp) {}
        btn.style.setProperty("background", "#111", "important");
        btn.style.setProperty("background-color", "#111", "important");
        btn.style.setProperty("background-image", "none", "important");
        btn.style.setProperty("color", "#fff", "important");
        btn.style.setProperty("border", "1px solid #111", "important");
        btn.style.setProperty("border-radius", "0", "important");
        btn.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
        btn.style.setProperty("font-size", "13px", "important");
        btn.style.setProperty("font-weight", "600", "important");
        btn.style.setProperty("letter-spacing", "0.12em", "important");
        btn.style.setProperty("text-transform", "uppercase", "important");
        btn.style.setProperty("min-height", "48px", "important");
        btn.style.setProperty("padding", "0 28px", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("display", "flex", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("text-align", "center", "important");
        btn.style.setProperty("box-sizing", "border-box", "important");
        btn.style.setProperty("-webkit-appearance", "none", "important");
        btn.style.setProperty("appearance", "none", "important");
        btn.style.setProperty("width", "100%", "important");
        btn.style.setProperty("max-width", "100%", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        forceBlackAtcButton(btn);
        btn.setAttribute("data-mc-atc-styled", VERSION);
      });
    try { ejectQtyFromAtcWrap(); } catch (eEjAtc) {}
    if (isSoftGoodsPdpPage() || isUnifiedAccordionPdp()) {
      try { finalizeColumnPurchaseStack(); } catch (eFinCol) {}
    }
    try {
      normalizeCloseoutPurchaseControls();
    } catch (eCloseAtc) {}
  }

  function scheduleAtcBlackLock() {
    if (global.__MC_PDP_ATC_BLACK_LOCK__ === VERSION) return;
    global.__MC_PDP_ATC_BLACK_LOCK__ = VERSION;
    [80, 250, 700, 1400, 2600, 5000, 9000].forEach(function (ms) {
      global.setTimeout(function () {
        try { fixAddToCartChrome(); } catch (eAtcLock) {}
      }, ms);
    });
    try {
      if (!global.__MC_PDP_ATC_BLACK_MO__) {
        var pending = false;
        global.__MC_PDP_ATC_BLACK_MO__ = new MutationObserver(function (mutations) {
          var shouldRun = false;
          mutations.forEach(function (m) {
            if (shouldRun) return;
            var t = m.target;
            if (!t || !t.matches) return;
            if (t.matches(".mc-atc-button-wrap, input[name='btnaddtocart'], button[name='btnaddtocart'], input.vCSS_input_addtocart, input.mc-unified-atc-btn") || (t.closest && t.closest(".mc-atc-button-wrap"))) shouldRun = true;
          });
          if (!shouldRun || pending) return;
          pending = true;
          global.requestAnimationFrame(function () {
            pending = false;
            try { fixAddToCartChrome(); } catch (eMoAtc) {}
          });
        });
        global.__MC_PDP_ATC_BLACK_MO__.observe(global.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
      }
    } catch (eAtcMo) {}
  }

  function ensurePdpHeroCriticalCss() {
    var el = global.document.getElementById("mc-pdp-hero-critical-css");
    if (!el) {
      el = global.document.createElement("style");
      el.id = "mc-pdp-hero-critical-css";
      (global.document.head || global.document.documentElement).appendChild(el);
    }
    el.textContent =
      "body.productdetails #mc-surgical-qty-row,body.mc-product-page #mc-surgical-qty-row," +
      "body.productdetails #mc-final-qty-row,body.mc-product-page #mc-final-qty-row," +
      "body.productdetails #mc-simple-final-qty-row,body.mc-product-page #mc-simple-final-qty-row{" +
      "display:none!important;visibility:hidden!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}" +
      "body.productdetails #mc-pdp-brand-logo,body.mc-product-page #mc-pdp-brand-logo{" +
      "display:flex!important;justify-content:center!important;align-items:center!important;" +
      "width:100%!important;max-width:440px!important;margin:0 auto 14px auto!important;padding:0!important;text-align:center!important}" +
      "body.productdetails #mc-pdp-brand-logo img,body.mc-product-page #mc-pdp-brand-logo img{" +
      "display:block!important;width:auto!important;max-width:180px!important;max-height:48px!important;height:auto!important;" +
      "object-fit:contain!important;object-position:center center!important;margin:0 auto!important}" +
      "body.productdetails #mc-pdp-title-right,body.mc-product-page #mc-pdp-title-right," +
      "body.productdetails #mc-pdp-price-stack-host,body.mc-product-page #mc-pdp-price-stack-host{" +
      "padding-left:1.1em!important;padding-right:0!important;margin-left:0!important;box-sizing:border-box!important}" +
      "body.productdetails #mc-pdp-title-right h1,body.mc-product-page #mc-pdp-title-right h1," +
      "body.productdetails #mc-pdp-title-right [itemprop='name'],body.mc-product-page #mc-pdp-title-right [itemprop='name']," +
      "body.productdetails #mc-pdp-title-right .productnamecolorLARGE,body.mc-product-page #mc-pdp-title-right .productnamecolorLARGE{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:15px!important;font-weight:400!important;line-height:1.2!important;" +
      "letter-spacing:0.16em!important;text-transform:uppercase!important;color:#777!important;text-align:left!important;" +
      "margin:0!important;padding:0!important;margin-left:0!important}" +
      "@media (max-width:991px){body.productdetails #mc-pdp-brand-logo+#mc-pdp-title-right,body.mc-product-page #mc-pdp-brand-logo+#mc-pdp-title-right{margin-top:14px!important}}" +
      "body.productdetails #mc-pdp-price-stack-host .product_list_price,body.mc-product-page #mc-pdp-price-stack-host .product_list_price," +
      "body.productdetails #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt,body.mc-product-page #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:16px!important;font-weight:400!important;line-height:1.55!important;" +
      "letter-spacing:0.02em!important;text-transform:none!important;color:#444!important;margin:0!important;padding:0!important}" +
      "body.productdetails #mc-pdp-price-stack-host,body.mc-product-page #mc-pdp-price-stack-host{margin:4px 0 10px 0!important;gap:0!important}" +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .product_productprice,body.mc-product-page:has(.mc-pdp-retail-row) #v65-product-parent .product_productprice,body.productdetails:has(.mc-pdp-retail-row) #content_area .product_productprice,body.mc-product-page:has(.mc-pdp-retail-row) #content_area .product_productprice," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .product_sale_price,body.mc-product-page:has(.mc-pdp-retail-row) #v65-product-parent .product_sale_price,body.productdetails:has(.mc-pdp-retail-row) #content_area .product_sale_price,body.mc-product-page:has(.mc-pdp-retail-row) #content_area .product_sale_price," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent .product_saleprice,body.mc-product-page:has(.mc-pdp-retail-row) #v65-product-parent .product_saleprice,body.productdetails:has(.mc-pdp-retail-row) #content_area .product_saleprice,body.mc-product-page:has(.mc-pdp-retail-row) #content_area .product_saleprice," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent #priceWithOptions,body.mc-product-page:has(.mc-pdp-retail-row) #v65-product-parent #priceWithOptions,body.productdetails:has(.mc-pdp-retail-row) #content_area #priceWithOptions,body.mc-product-page:has(.mc-pdp-retail-row) #content_area #priceWithOptions," +
      "body.productdetails:has(.mc-pdp-retail-row) #v65-product-parent #priceWithOptionsNoTax,body.mc-product-page:has(.mc-pdp-retail-row) #v65-product-parent #priceWithOptionsNoTax,body.productdetails:has(.mc-pdp-retail-row) #content_area #priceWithOptionsNoTax,body.mc-product-page:has(.mc-pdp-retail-row) #content_area #priceWithOptionsNoTax{display:none!important;visibility:hidden!important}" +
      "body.productdetails .mc-atc-button-wrap,body.mc-product-page .mc-atc-button-wrap{" +
      "border:1px solid #111!important;border-color:#111!important;box-shadow:none!important;" +
      "border-radius:0!important;background:#111!important;background-color:#111!important;color:#fff!important;outline:none!important;" +
      "width:100%!important;min-width:0!important;max-width:100%!important;padding:0!important;" +
      "display:flex!important;align-items:center!important;justify-content:center!important;gap:0!important}" +
      "body.productdetails #v65-product-parent input[name='btnaddtocart'],body.mc-product-page #v65-product-parent input[name='btnaddtocart']," +
      "body.productdetails #v65-product-parent button[name='btnaddtocart'],body.mc-product-page #v65-product-parent button[name='btnaddtocart']," +
      "body.productdetails #v65-product-parent input.vCSS_input_addtocart,body.mc-product-page #v65-product-parent input.vCSS_input_addtocart," +
      "body.productdetails .mc-atc-button-wrap button[name='btnaddtocart'],body.mc-product-page .mc-atc-button-wrap button[name='btnaddtocart']," +
      "body.productdetails .mc-atc-button-wrap input[type='submit'],body.mc-product-page .mc-atc-button-wrap input[type='submit']," +
      "body.productdetails #mc-pdp-purchase-stack input[name='btnaddtocart'],body.mc-product-page #mc-pdp-purchase-stack input[name='btnaddtocart']," +
      "body.productdetails #mc-pdp-purchase-stack button[name='btnaddtocart'],body.mc-product-page #mc-pdp-purchase-stack button[name='btnaddtocart']{" +
      "background:#111!important;background-color:#111!important;background-image:none!important;color:#fff!important;" +
      "border:1px solid #111!important;border-radius:0!important;box-shadow:none!important;" +
      "font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:600!important;letter-spacing:.12em!important;" +
      "text-transform:uppercase!important;line-height:1!important;padding:0 28px!important;min-height:48px!important;" +
      "margin:0!important;width:100%!important;min-width:0!important;max-width:100%!important;opacity:1!important;cursor:pointer!important;" +
      "-webkit-appearance:none!important;appearance:none!important;box-sizing:border-box!important;display:flex!important;" +
      "align-items:center!important;justify-content:center!important;text-align:center!important}" +
      "body.productdetails #mc-pdp-qty-row,body.mc-product-page #mc-pdp-qty-row{" +
      "display:inline-flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;text-align:center!important;" +
      "visibility:visible!important;opacity:1!important;height:auto!important;width:auto!important;max-width:none!important;margin:0!important;gap:0!important}" +
      "body.productdetails #mc-pdp-qty-row .mc-pdp-qty-row__label,body.mc-product-page #mc-pdp-qty-row .mc-pdp-qty-row__label{" +
      "display:none!important}" +
      "body.productdetails #mc-pdp-qty-row input,body.mc-product-page #mc-pdp-qty-row input{" +
      "display:inline-block!important;visibility:visible!important;opacity:1!important;width:58px!important;height:38px!important;" +
      "border:1px solid #e0e0e0!important;border-radius:0!important;font-size:14px!important;color:#444!important}" +
      "body.productdetails #mc-pdp-purchase-stack,body.mc-product-page #mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;" +
      "text-align:center!important;align-self:stretch!important;width:100%!important;max-width:100%!important;margin:12px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "body.productdetails #mc-pdp-purchase-stack .v65-product-addtocart,body.mc-product-page #mc-pdp-purchase-stack .v65-product-addtocart{" +
      "display:flex!important;justify-content:center!important;width:100%!important;max-width:100%!important;margin:0!important}" +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-brand-logo,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-brand-logo," +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-title-right,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-title-right," +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-price-stack-host,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-price-stack-host," +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-features,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-features," +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) #mc-pdp-purchase-stack," +
      "body.productdetails:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) .mc-unified-purchase-controls,body.mc-product-page:not(.mc-pdp-hero-ready):not(.mc-pdp-unified-ready) .mc-unified-purchase-controls{" +
      "visibility:hidden!important}" +
      "body.productdetails #ProductDetail_ProductDetails_div2 li,body.mc-product-page #ProductDetail_ProductDetails_div2 li," +
      "body.productdetails #ProductDetail_ProductDetails_div2 p,body.mc-product-page #ProductDetail_ProductDetails_div2 p," +
      "body.productdetails #ProductDetail_ProductDetails_div2 span[itemprop='description'] li,body.mc-product-page #ProductDetail_ProductDetails_div2 span[itemprop='description'] li," +
      "body.productdetails #ProductDetail_ProductDetails_div2 strong,body.mc-product-page #ProductDetail_ProductDetails_div2 strong," +
      "body.productdetails #ProductDetail_ProductDetails_div2 font,body.mc-product-page #ProductDetail_ProductDetails_div2 font{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:14px!important;font-weight:400!important;line-height:1.55!important;" +
      "letter-spacing:0.02em!important;text-transform:none!important;color:#444!important}" +
      "body.productdetails #ProductDetail_ProductDetails_div2 ul,body.mc-product-page #ProductDetail_ProductDetails_div2 ul{" +
      "list-style:disc!important;padding-left:1.1em!important;margin:0!important}" +
      "body.productdetails:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-purchase-stack," +
      "body.productdetails:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #v65-product-parent [itemprop='offers'] #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #v65-product-parent [itemprop='offers'] #mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;" +
      "text-align:center!important;align-self:stretch!important;width:100%!important;max-width:100%!important;margin:12px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack,html body.mc-saranoni-pdp #mc-pdp-purchase-stack.mc-pdp-cart-row,html body.mc-saranoni-pdp #mc-pdp-purchase-stack.mc-saranoni-purchase-stack," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack.mc-pdp-cart-row,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack.mc-bean-bag-purchase-stack," +
      "html body.mc-cordaroys-pdp #mc-pdp-purchase-stack,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack.mc-pdp-cart-row,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack.mc-cordaroys-purchase-stack," +
      "html body.mc-bean-bag-pdp .mc-unified-purchase-controls,html body.mc-cordaroys-pdp .mc-unified-purchase-controls,html body.mc-gatlin-sectional-pdp .mc-unified-purchase-controls{" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;flex-wrap:nowrap!important;" +
      "text-align:center!important;width:100%!important;max-width:435px!important;margin:12px auto 16px auto!important;gap:10px!important;clear:both!important;visibility:visible!important;opacity:1!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack #mc-pdp-qty-row,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack #mc-pdp-qty-row,html body.mc-bean-bag-pdp .mc-unified-purchase-controls #mc-pdp-qty-row,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack #mc-pdp-qty-row,html body.mc-cordaroys-pdp .mc-unified-purchase-controls #mc-pdp-qty-row,html body.mc-gatlin-sectional-pdp .mc-unified-purchase-controls #mc-pdp-qty-row,html body.mc-gatlin-sectional-pdp .mc-unified-purchase-controls .mc-unified-qty-row{order:1!important;width:100%!important;justify-content:center!important;visibility:visible!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack .v65-product-addtocart,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .v65-product-addtocart,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "html body.mc-bean-bag-pdp .mc-unified-purchase-controls .v65-product-addtocart,html body.mc-bean-bag-pdp .mc-unified-purchase-controls .mc-atc-button-wrap," +
      "html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .v65-product-addtocart,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "html body.mc-cordaroys-pdp .mc-unified-purchase-controls .v65-product-addtocart,html body.mc-cordaroys-pdp .mc-unified-purchase-controls .mc-atc-button-wrap{order:2!important;width:100%!important;max-width:100%!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button," +
      "html body.mc-bean-bag-pdp .mc-unified-purchase-controls .mc-atc-button-wrap input,html body.mc-bean-bag-pdp .mc-unified-purchase-controls .mc-atc-button-wrap button," +
      "html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button," +
      "html body.mc-cordaroys-pdp .mc-unified-purchase-controls .mc-atc-button-wrap input,html body.mc-cordaroys-pdp .mc-unified-purchase-controls .mc-atc-button-wrap button{width:100%!important;box-sizing:border-box!important;display:block!important}" +
      "body.productdetails #mc-pdp-purchase-stack *,body.mc-product-page #mc-pdp-purchase-stack *{" +
      "text-align:center!important}" +
      "body.productdetails:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp):not(.mc-cordaroys-pdp) #mc-pdp-features+#mc-pdp-purchase-stack,body.mc-product-page:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp):not(.mc-cordaroys-pdp) #mc-pdp-features+#mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;flex-wrap:wrap!important;" +
      "text-align:center!important;align-self:stretch!important;width:100%!important;max-width:100%!important;margin:12px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "body.productdetails #ProductDetail_ProductDetails_div2 .colors_descriptionbox,body.mc-product-page #ProductDetail_ProductDetails_div2 .colors_descriptionbox," +
      "body.productdetails form .colors_descriptionbox,body.mc-product-page form .colors_descriptionbox{" +
      "border:none!important;border-width:0!important;background:transparent!important}" +
      "body.productdetails #ProductDetail_ProductDetails_div2,body.mc-product-page #ProductDetail_ProductDetails_div2," +
      "body.productdetails #ProductDetail_ProductDetails_div2 .colors_descriptionbox,body.mc-product-page #ProductDetail_ProductDetails_div2 .colors_descriptionbox," +
      "body.productdetails #ProductDetail_ProductDetails_div2 span[itemprop='description'],body.mc-product-page #ProductDetail_ProductDetails_div2 span[itemprop='description']{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:14px!important;line-height:1.55!important;letter-spacing:0.02em!important;color:#444!important}" +
      "body.productdetails img#product_photo,body.mc-product-page img#product_photo{" +
      "max-width:min(720px,100%)!important;width:100%!important;height:auto!important}" +
      "body.productdetails a#product_photo_zoom_url,body.mc-product-page a#product_photo_zoom_url{" +
      "max-width:min(650px,100%)!important;width:100%!important;display:block!important}" +
      "html body.mc-bean-bag-pdp #content_area tr.mc-pdp-main-row,html body.mc-ruched-blanket-pdp #content_area tr.mc-pdp-main-row{" +
      "display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:32px!important}" +
      "html body.mc-saranoni-pdp #content_area tr.mc-pdp-main-row,html body.mc-saranoni-pdp #v65-product-parent tr.mc-pdp-main-row{" +
      "display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:28px!important;column-gap:28px!important;justify-content:center!important;max-width:1180px!important;margin:0 auto!important}" +
      "html body.mc-saranoni-pdp #content_area td.mc-pdp-media-td,html body.mc-saranoni-pdp #v65-product-parent td.mc-pdp-media-td{" +
      "padding-right:0!important;margin-right:0!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-title-right,html body.mc-saranoni-pdp #mc-pdp-title-right,html body.mc-ruched-blanket-pdp #mc-pdp-title-right," +
      "html body.mc-bean-bag-pdp #mc-pdp-brand-logo,html body.mc-saranoni-pdp #mc-pdp-brand-logo,html body.mc-ruched-blanket-pdp #mc-pdp-brand-logo{" +
      "margin-top:0!important;padding-top:0!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "body.mc-product-page.mc-bean-bag-pdp #content_area .mc-atc-button-wrap,body.mc-product-page.mc-cordaroys-pdp #content_area .mc-atc-button-wrap,body.mc-product-page.mc-saranoni-pdp #content_area .mc-atc-button-wrap,body.mc-product-page.mc-ruched-blanket-pdp #content_area .mc-atc-button-wrap{" +
      "background:#111!important;background-color:#111!important;border:1px solid #111!important;border-radius:0!important;" +
      "box-shadow:none!important;padding:0!important;margin:0!important;margin-top:0!important;min-width:0!important;gap:0!important;color:#fff!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button,html body.mc-cordaroys-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button{" +
      "background:#111!important;background-color:#111!important;background-image:none!important;color:#fff!important;" +
      "border:1px solid #111!important;border-radius:0!important;font-size:13px!important;font-weight:600!important;" +
      "letter-spacing:.12em!important;text-transform:uppercase!important;min-height:48px!important;padding:0 28px!important;opacity:1!important;outline:none!important;box-shadow:none!important;transition:none!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper{" +
      "display:none!important}";
  }

  global.mcPlaceBrandLogoAboveTitle = placeBrandLogoAboveTitle;
  global.mcSyncPdpHeroTopAlign = syncPdpHeroTopAlign;

  /** Logo → title → price → Klarna in the right column (non–bean-bag PDPs). */
  function ensureHeroColumnOrder() {
    if (isBeanBagPdpPage()) return;
    try {
      placeBrandLogoBelowTitle();
    } catch (eLogo) {}
    if (isPdpLayoutMounted()) return;
    if (isSaranoniPdpPage()) {
      appendSaranoniInfoColumnOrder();
      return;
    }
    ensurePdpInfoColumnOrder();
  }

  function resolveBeanBagSizeOptionsElement() {
    var section = global.document.getElementById("mc-bb-size-section");
    if (section) return section;
    var block = global.document.getElementById("mc-pdp-option-block");
    if (block && block.querySelector("select")) return block;
    return null;
  }

  /** Keep native #options_table in DOM for Volusion/cover sync; hide duplicate SIZE/COVER UI below ATC. */
  function hideBeanBagNativeOptionsTable() {
    if (!isBeanBagPdpPage()) return;
    var hasCustomUi =
      global.document.getElementById("mc-bb-size-section") ||
      global.document.getElementById("beanbag-swatch-wrapper");
    if (!hasCustomUi) return;
    global.document.body.classList.add("mc-bb-native-options-hidden");
    global.document
      .querySelectorAll(
        "#v65-product-parent #options_table, #v65-product-parent table[id*='options_table'], " +
          "#content_area #options_table, #content_area table[id*='options_table']"
      )
      .forEach(function (table) {
        if (table.getAttribute("data-mc-bb-native-suppressed") === "1") return;
        table.setAttribute("data-mc-bb-native-suppressed", "1");
        table.classList.add("mc-bb-native-options-suppressed");
        try {
          table.style.setProperty("position", "absolute", "important");
          table.style.setProperty("left", "-9999px", "important");
          table.style.setProperty("top", "0", "important");
          table.style.setProperty("width", "1px", "important");
          table.style.setProperty("height", "1px", "important");
          table.style.setProperty("max-height", "0", "important");
          table.style.setProperty("overflow", "hidden", "important");
          table.style.setProperty("opacity", "0", "important");
          table.style.setProperty("visibility", "hidden", "important");
          table.style.setProperty("pointer-events", "none", "important");
          table.style.setProperty("margin", "0", "important");
          table.style.setProperty("padding", "0", "important");
          table.style.setProperty("border", "0", "important");
          table.setAttribute("aria-hidden", "true");
        } catch (eHide) {}
      });
    global.document.querySelectorAll("#v65-product-parent tr, #content_area tr").forEach(function (row) {
      if (row.closest("#mc-bb-size-section, #beanbag-swatch-wrapper, #mc-pdp-features")) return;
      if (row.closest('[data-mc-bb-native-suppressed="1"]')) return;
      if (
        row.classList.contains("mc-pdp-main-row") ||
        row.classList.contains("mc-unified-pdp-row") ||
        row.querySelector(
          "#product_photo, #mc-pdp-features, #mc-pdp-price-stack-host, #mc-pdp-purchase-stack, #beanbag-swatch-wrapper, .mc-pdp-media-td, .mc-pdp-options-td"
        )
      ) {
        return;
      }
      var sizeSection = global.document.getElementById("mc-bb-size-section");
      var sel = row.querySelector("select");
      if (sel && sizeSection && sizeSection.contains(sel)) return;
      var txt = String(row.textContent || "").replace(/\s+/g, " ").trim().toUpperCase();
      var isCoverRow = /CHOOSE COVER/.test(txt) && !!sel;
      var isEmptySizeRow = /\bSIZE\b/.test(txt) && !sel && !row.querySelector("#mc-bb-size-label");
      if (!isCoverRow && !isEmptySizeRow) return;
      try {
        row.style.setProperty("display", "none", "important");
        row.style.setProperty("visibility", "hidden", "important");
        row.style.setProperty("height", "0", "important");
        row.style.setProperty("overflow", "hidden", "important");
        row.setAttribute("data-mc-bb-stray-option-row", "1");
      } catch (eRowHide) {}
    });
  }

  function salvageBeanBagPurchaseFromAccordion(acc) {
    if (!acc || !isBeanBagPdpPage()) return;
    var col = findPdpHeroColumnTd() || (acc && acc.parentNode);
    if (!col) return;
    var nodes = acc.querySelectorAll(
      '#mc-pdp-purchase-stack, .mc-unified-purchase-controls, .mc-atc-button-wrap, input[name="btnaddtocart"], button[name="btnaddtocart"], input[name^="QTY."], input.v65-productdetail-cartqty, #mc-pdp-qty-row'
    );
    Array.prototype.forEach.call(nodes, function (node) {
      try {
        if (node.closest && node.closest("#mc-pdp-purchase-stack") && node.id !== "mc-pdp-purchase-stack") return;
        if (acc.nextSibling) col.insertBefore(node, acc.nextSibling);
        else col.appendChild(node);
      } catch (eMove) {}
    });
  }

  function stripTheaterClassFromBeanBags() {
    if (!isBeanBagPdpPage() && !isCordaroysBrandPdpPage()) return;
    try {
      if (global.document.body) {
        global.document.body.classList.remove("mc-theater-seating-pdp", "category", "is-category-or-listing-page");
        if (isBeanBagPdpPage()) global.document.body.classList.add("mc-bean-bag-pdp");
      }
    } catch (eStripTheater) {}
  }

  function ensureBeanBagPurchaseControlsAlive() {
    if (!isBeanBagPdpPage()) return null;
    stripTheaterClassFromBeanBags();
    var info = findPdpHeroColumnTd();
    if (!info) return null;
    var pcEl = global.document.querySelector('#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]');
    var pc = String((pcEl && pcEl.value) || "").trim() || "BB-ITEM";
    var qty = global.document.querySelector(
      '#v65-product-parent input[name^="QTY."], #v65-product-parent input.v65-productdetail-cartqty, input[name^="QTY."], input.v65-productdetail-cartqty'
    );
    var btn = global.document.querySelector(
      '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], input[name="btnaddtocart"], button[name="btnaddtocart"]'
    );
    if (!qty) {
      qty = global.document.createElement("input");
      qty.type = "text";
      qty.className = "v65-productdetail-cartqty form-control";
      qty.name = "QTY." + pc;
      qty.value = "1";
      qty.setAttribute("title", "Quantity");
      qty.setAttribute("maxlength", "8");
      qty.setAttribute("size", "3");
    }
    if (!btn) {
      btn = global.document.createElement("input");
      btn.type = "submit";
      btn.name = "btnaddtocart";
      btn.className = "vCSS_input_addtocart mc-unified-atc-btn btn-primary";
      btn.value = "ADD TO CART";
      btn.setAttribute("alt", "Add to cart");
    } else if (btn.tagName === "INPUT" && String(btn.type || "").toLowerCase() === "image") {
      try { btn.type = "submit"; } catch (eType) {}
      btn.removeAttribute("src");
      if (!btn.value) btn.value = "ADD TO CART";
    }
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    if (!stack) {
      stack = global.document.createElement("div");
      stack.id = "mc-pdp-purchase-stack";
    }
    stack.classList.add("mc-pdp-purchase-controls", "mc-pdp-cart-row", "mc-bean-bag-purchase-stack", "mc-soft-goods-purchase-stack");
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    if (!qtyRow) {
      qtyRow = global.document.createElement("div");
      qtyRow.id = "mc-pdp-qty-row";
      qtyRow.className = "mc-pdp-qty-row mc-unified-qty-row";
    }
    if (!qtyRow.contains(qty)) qtyRow.appendChild(qty);
    var wrap = btn.closest(".mc-atc-button-wrap") || stack.querySelector(".mc-atc-button-wrap");
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.className = "mc-atc-button-wrap mc-unified-atc-host";
    }
    if (!wrap.contains(btn)) wrap.appendChild(btn);
    if (!stack.contains(qtyRow)) stack.appendChild(qtyRow);
    if (!stack.contains(wrap)) stack.appendChild(wrap);
    var acc = global.document.getElementById("mc-pdp-accordion");
    try {
      if (acc && acc.parentNode === info) {
        if (acc.nextSibling) info.insertBefore(stack, acc.nextSibling);
        else info.appendChild(stack);
      } else if (!info.contains(stack)) {
        info.appendChild(stack);
      }
    } catch (ePlace) {}
    try {
      stack.style.setProperty("display", "flex", "important");
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("align-items", "stretch", "important");
      stack.style.setProperty("gap", "10px", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "435px", "important");
      stack.style.setProperty("visibility", "visible", "important");
      stack.style.setProperty("opacity", "1", "important");
      stack.removeAttribute("aria-hidden");
      qtyRow.style.setProperty("display", "flex", "important");
      qtyRow.style.setProperty("justify-content", "center", "important");
      qty.style.setProperty("display", "inline-block", "important");
      qty.style.setProperty("visibility", "visible", "important");
      qty.style.setProperty("opacity", "1", "important");
      qty.style.setProperty("width", "58px", "important");
      qty.style.setProperty("height", "48px", "important");
      wrap.style.setProperty("display", "flex", "important");
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("background", "#111", "important");
      btn.style.setProperty("display", "flex", "important");
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("min-height", "48px", "important");
      btn.style.setProperty("background", "#111", "important");
      btn.style.setProperty("color", "#fff", "important");
    } catch (eStyle) {}
    try { applySoftGoodsAtcChrome(wrap); } catch (eChrome) {}
    return stack;
  }

  global.mcEnsureBeanBagPurchaseControlsAlive = ensureBeanBagPurchaseControlsAlive;

  function resolveBeanBagPurchaseElement(infoColumn) {
    infoColumn = infoColumn || findPdpHeroColumnTd();
    var unified =
      (infoColumn && infoColumn.querySelector(".mc-unified-purchase-controls")) ||
      global.document.querySelector(
        "td.mc-pdp-options-td .mc-unified-purchase-controls, td.mc-unified-pdp-info .mc-unified-purchase-controls"
      );
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    var hasAtc = function (el) {
      return !!(el && el.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]'));
    };
    /* Prefer the host that actually owns the visible ATC. Unified controls often
       hold the live button after layout normalize; hiding that host kills ATC. */
    if (hasAtc(unified)) return unified;
    if (hasAtc(stack)) return stack;
    return unified || stack || null;
  }

  function consolidateBeanBagPurchaseBlocks(infoColumn, canonical) {
    infoColumn = infoColumn || findPdpHeroColumnTd();
    if (!infoColumn) return canonical;
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    var unified = infoColumn.querySelector(".mc-unified-purchase-controls");
    var liveAtc = global.document.querySelector(
      '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], ' +
        '#content_area input[name="btnaddtocart"], #content_area button[name="btnaddtocart"]'
    );
    [stack, unified].forEach(function (el) {
      if (!el || el === canonical) return;
      if (liveAtc && el.contains(liveAtc)) return;
      try {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.setAttribute("aria-hidden", "true");
      } catch (eHide) {}
    });
    if (canonical) {
      try {
        canonical.style.setProperty("display", "flex", "important");
        canonical.style.setProperty("visibility", "visible", "important");
        canonical.style.setProperty("opacity", "1", "important");
        canonical.style.setProperty("height", "auto", "important");
        canonical.style.setProperty("overflow", "visible", "important");
        canonical.removeAttribute("aria-hidden");
      } catch (eShow) {}
    }
    try { forceRevealCanonicalAtc(); } catch (eReveal) {}
    return canonical;
  }

  function isBeanBagInfoColumnChildVisible(child, allowedIds) {
    if (!child) return false;
    if (child.id && allowedIds[child.id]) return true;
    if (child.classList && child.classList.contains("mc-unified-purchase-controls")) return true;
    if (child.querySelector && child.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"], #mc-pdp-qty-row')) {
      return true;
    }
    return false;
  }

  function forceRevealCanonicalAtc() {
    try {
      var btns = global.document.querySelectorAll(
        '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], ' +
          '#content_area input[name="btnaddtocart"], #content_area button[name="btnaddtocart"]'
      );
      btns.forEach(function (btn) {
        if (!btn) return;
        var wrap = btn.closest(".mc-atc-button-wrap, .v65-product-addtocart, .mc-unified-atc-host");
        var host =
          btn.closest("#mc-pdp-purchase-stack, .mc-unified-purchase-controls, .mc-pdp-purchase-controls") ||
          wrap;
        [host, wrap, btn].forEach(function (el) {
          if (!el || !el.style) return;
          try {
            el.style.setProperty("visibility", "visible", "important");
            el.style.setProperty("opacity", "1", "important");
            el.style.setProperty("height", "auto", "important");
            el.style.setProperty("max-height", "none", "important");
            el.style.setProperty("overflow", "visible", "important");
            el.style.removeProperty("clip");
            el.removeAttribute("aria-hidden");
          } catch (eShow) {}
        });
        if (wrap) {
          try {
            wrap.style.setProperty("display", "flex", "important");
            wrap.style.setProperty("width", "100%", "important");
          } catch (eW) {}
        }
        try {
          btn.style.setProperty("display", "flex", "important");
        } catch (eB) {}
      });
    } catch (eAtcReveal) {}
  }

  /* Volusion leaves these image-only table cells behind after the useful PDP
     controls are moved into the custom column. They are purely decorative
     PBox/OBox corners and render as the two small grey squares. */
  function hideLegacyPdpFrameBits() {
    if (!isBeanBagPdpPage() && !isSaranoniPdpPage()) return;
    global.document
      .querySelectorAll(
        '#v65-product-parent img[src*="PBox_Border_"], #v65-product-parent img[src*="OBox_Border_"]'
      )
      .forEach(function (img) {
        var cell = img.parentNode;
        try {
          img.style.setProperty("display", "none", "important");
        } catch (eFrameImage) {}
        if (!cell || cell.tagName !== "TD" || cell.children.length !== 1 || cell.firstElementChild !== img) return;
        try {
          cell.style.setProperty("display", "none", "important");
          cell.style.setProperty("width", "0", "important");
          cell.style.setProperty("padding", "0", "important");
          cell.style.setProperty("background", "none", "important");
        } catch (eFrameCell) {}
      });
  }

  /* Match the verified mobile Bean Bag offset on the actual table cells after
     the purchase column has been assembled. This avoids depending on a broad
     stylesheet selector racing the legacy table layout. */
  function applyBeanBagMobilePurchaseOffset(infoColumn) {
    if (!infoColumn || !global.matchMedia || !global.matchMedia("(max-width: 991px)").matches) return;
    var root = global.document.getElementById("content_area");
    if (!root) return;
    var targets = [infoColumn];
    root.querySelectorAll("td").forEach(function (cell) {
      if (cell === infoColumn || !cell.querySelector(".colors_pricebox, #priceWithOptions")) return;
      targets.push(cell);
    });
    targets.forEach(function (cell) {
      try {
        cell.style.setProperty("padding-top", "78px", "important");
        cell.style.setProperty("margin-top", "-280px", "important");
      } catch (eMobileOffset) {}
    });
  }

  function removeBeanBagLargerPhotoGlyph() {
    if (!isBeanBagPdpPage()) return;
    global.document.querySelectorAll("#product_photo_zoom_url2 .btn-icon-zoom").forEach(function (icon) {
      if (icon.parentNode) icon.parentNode.removeChild(icon);
    });
  }

  /* The native Bean Bag price box contains the real shipping icon and
     availability text, but also its obsolete border-image frame.  Move only
     those two pieces into the existing purchase column before retiring that
     now-empty frame. */
  function moveBeanBagShippingInfo(infoColumn) {
    if (!infoColumn) return null;
    var host = global.document.getElementById("mc-bb-shipping-info");
    var offers = global.document.querySelectorAll('#v65-product-parent [itemprop="offers"]');
    var offer = null;
    var oi;
    for (oi = 0; oi < offers.length; oi++) {
      var candidate = offers[oi];
      var hasShipping = candidate.querySelector("img.vCSS_img_icon_free_shipping");
      var labels = candidate.querySelectorAll("b");
      var li;
      var hasAvailability = false;
      for (li = 0; li < labels.length; li++) {
        if (/^availability::?$/i.test(String(labels[li].textContent || "").replace(/\s+/g, " ").trim())) {
          hasAvailability = true;
          break;
        }
      }
      if (hasShipping && hasAvailability) {
        offer = candidate;
        break;
      }
    }
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-bb-shipping-info";
      host.className = "mc-bb-shipping-info";
    }
    if (offer) {
      var icon = offer.querySelector("img.vCSS_img_icon_free_shipping");
      var shippingLink = icon && icon.closest ? icon.closest("a") : (icon ? icon.parentNode : null);
      var availabilityLabel = null;
      var allLabels = offer.querySelectorAll("b");
      var bi;
      for (bi = 0; bi < allLabels.length; bi++) {
        if (/^availability::?$/i.test(String(allLabels[bi].textContent || "").replace(/\s+/g, " ").trim())) {
          availabilityLabel = allLabels[bi];
          break;
        }
      }
      var availabilityText = availabilityLabel ? availabilityLabel.nextSibling : null;
      if (shippingLink && !host.contains(shippingLink)) host.appendChild(shippingLink);
      if (availabilityLabel && !host.contains(availabilityLabel)) host.appendChild(availabilityLabel);
      if (availabilityText && availabilityText.nodeType === 3) {
        var availabilityValue = global.document.createElement("span");
        availabilityValue.className = "mc-bb-shipping-info__availability";
        availabilityValue.textContent = String(availabilityText.nodeValue || "").replace(/\s+/g, " ").trim();
        if (availabilityValue.textContent) host.appendChild(availabilityValue);
        if (availabilityText.parentNode) availabilityText.parentNode.removeChild(availabilityText);
      }
      /* Only remove the legacy frame once its content has been retained in
         the purchase column.  This frame has no form controls. */
      if (host.querySelector("img.vCSS_img_icon_free_shipping") && host.querySelector("b")) {
        var legacyFrame = offer.closest ? offer.closest("table.colors_pricebox") : null;
        if (legacyFrame && !legacyFrame.querySelector("input, select, button")) {
          try {
            legacyFrame.style.setProperty("display", "none", "important");
          } catch (eLegacyFrame) {}
        }
      }
    }
    try {
      host.style.setProperty("display", "block", "important");
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("margin", "0 0 12px 0", "important");
      host.style.setProperty("padding", "0", "important");
      host.querySelectorAll("a, b, .mc-bb-shipping-info__availability").forEach(function (node) {
        node.style.setProperty("display", "block", "important");
      });
    } catch (eShippingStyle) {}
    return host;
  }

  function repairBeanBagDesktopMainRow() {
    if (!isCordaroysBrandPdpPage()) return;
    try {
      if (!global.matchMedia || !global.matchMedia("(min-width: 992px)").matches) return;
    } catch (eMq) {
      return;
    }
    try {
      if (global.document.body) {
        global.document.body.classList.remove("mc-theater-seating-pdp", "category", "is-category-or-listing-page");
        if (isBeanBagPdpPage()) global.document.body.classList.add("mc-bean-bag-pdp");
        if (isCordaroysExtendedPdpPage()) {
          global.document.body.classList.add("mc-cordaroys-pdp");
          global.document.body.classList.remove("mc-bean-bag-pdp");
        }
        if (global.document.documentElement) {
          global.document.documentElement.classList.remove("is-category-or-listing-page", "category");
        }
      }
    } catch (eCls) {}
    var row =
      global.document.querySelector("#v65-product-parent tr.mc-pdp-main-row") ||
      global.document.querySelector("#v65-product-parent tr.vol-product__top__inner.vol-product__main-details__inner") ||
      global.document.querySelector("#v65-product-parent tr.vol-product__top__inner");
    var photo = global.document.getElementById("product_photo");
    var info =
      global.document.querySelector("#v65-product-parent td.vol-product__top--right") ||
      global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (info && isNestedAtcInfoCell(info)) {
      info = global.document.querySelector("#v65-product-parent td.vol-product__top--right") || info;
    }
    if ((!row || !row.contains || (info && !row.contains(info))) && info && info.parentElement && info.parentElement.tagName === "TR") {
      row = info.parentElement;
    }
    if (!row && photo && photo.closest) {
      var photoTd = photo.closest("td.mc-pdp-media-td, td.vol-product__top--left, td");
      if (photoTd && photoTd.parentElement && photoTd.parentElement.tagName === "TR") row = photoTd.parentElement;
    }
    if (!row) return;
    try {
      row.classList.add("mc-pdp-main-row");
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("flex-direction", "row", "important");
      row.style.setProperty("flex-wrap", "nowrap", "important");
      row.style.setProperty("align-items", "flex-start", "important");
      row.style.setProperty("justify-content", "center", "important");
      row.style.setProperty("gap", "40px", "important");
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("max-width", "1200px", "important");
    } catch (eRow) {}
    var media =
      (row.querySelector && row.querySelector("td.vol-product__top--left, td.mc-pdp-media-td")) ||
      (photo && photo.closest && photo.closest("td"));
    if (media && info && media.parentElement !== row && info.parentElement === row) {
      media = row.querySelector("td.mc-pdp-media-td, td.vol-product__top--left") || media;
    }
    if (media) {
      try {
        media.classList.add("mc-pdp-media-td");
        media.style.setProperty("display", "block", "important");
        media.style.setProperty("flex", "0 0 650px", "important");
        media.style.setProperty("width", "650px", "important");
        media.style.setProperty("max-width", "650px", "important");
        media.style.setProperty("min-width", "0", "important");
      } catch (eMedia) {}
    }
    if (info) {
      try {
        info.classList.add("mc-pdp-options-td", "mc-unified-pdp-info");
        info.style.setProperty("display", "flex", "important");
        info.style.setProperty("flex-direction", "column", "important");
        info.style.setProperty("align-items", "stretch", "important");
        info.style.setProperty("flex", "0 0 420px", "important");
        info.style.setProperty("width", "420px", "important");
        info.style.setProperty("max-width", "420px", "important");
        info.style.setProperty("min-width", "0", "important");
      } catch (eInfo) {}
    }
  }

  function appendBeanBagInfoColumnOrder() {
    if (!isCordaroysBrandPdpPage()) return;
    var infoColumn = findPdpHeroColumnTd();
    if (!infoColumn) return;
    hideLegacyPdpFrameBits();
    /* Bean Bag-only: Volusion's remaining PBox/OBox corner images are the
       two small grey squares above the Cordaroys logo.  They are decorative
       frame fragments, never product controls. */
    global.document
      .querySelectorAll(
        '#v65-product-parent img[src*="PBox_Border"], #v65-product-parent img[src*="OBox_Border"]'
      )
      .forEach(function (img) {
        if (img.closest("#mc-pdp-brand-logo,#mc-pdp-purchase-stack,#mc-pdp-qty-row")) return;
        try {
          img.style.setProperty("display", "none", "important");
        } catch (eBbFrameImg) {}
        var cell = img.parentNode;
        if (!cell || cell.tagName !== "TD" || cell.children.length !== 1) return;
        try {
          cell.style.setProperty("display", "none", "important");
          cell.style.setProperty("width", "0", "important");
          cell.style.setProperty("padding", "0", "important");
        } catch (eBbFrameCell) {}
      });
    applyBeanBagMobilePurchaseOffset(infoColumn);
    removeBeanBagLargerPhotoGlyph();
    /* A stale legacy helper writes a 301px minimum height on the native offers
       block.  It is an empty spacer, not product content, and pushes the logo
       and purchase column far below the hero image. */
    global.document.querySelectorAll('#v65-product-parent [itemprop="offers"]').forEach(function (offer) {
      var text = String(offer.textContent || "");
      if (!offer.querySelector(".option_pricing") || !/availability/i.test(text)) return;
      try {
        offer.style.setProperty("min-height", "0", "important");
      } catch (eOfferSpacer) {}
    });
    /* This is the duplicate native price-only frame. It has the old PBox
       corner images (the two grey squares) but no options or controls. The
       real price is already retained in #mc-pdp-price-stack-host. */
    global.document.querySelectorAll("#v65-product-parent table.colors_pricebox").forEach(function (table) {
      if (!global.document.getElementById("mc-pdp-price-stack-host")) return;
      if (!table.querySelector(".option_pricing") || table.querySelector("input, select, button")) return;
      if (table.contains(infoColumn)) return;
      try {
        table.style.setProperty("display", "none", "important");
        table.style.setProperty("visibility", "hidden", "important");
        table.style.setProperty("height", "0", "important");
        table.style.setProperty("overflow", "hidden", "important");
        table.style.setProperty("margin", "0", "important");
        table.style.setProperty("padding", "0", "important");
      } catch (eDuplicatePriceFrame) {}
    });
    var brandElement = global.document.getElementById("mc-pdp-brand-logo");
    var titleElement = global.document.getElementById("mc-pdp-title-right");
    var priceElement = global.document.getElementById("mc-pdp-price-stack-host");
    var shippingElement = moveBeanBagShippingInfo(infoColumn);
    var klarnaElement = global.document.getElementById("messaging-element");
    var sizeOptionsElement = resolveBeanBagSizeOptionsElement();
    var coverOptionsElement = global.document.getElementById("beanbag-swatch-wrapper");
    var purchaseElement = resolveBeanBagPurchaseElement(infoColumn);
    var featuresElement = global.document.getElementById("mc-pdp-features");
    var descriptionElement = global.document.getElementById("mc-pdp-description-below-features");
    var accordionElement = ensureBeanBagPdpAccordion();
    var ordered = [
      brandElement,
      titleElement,
      priceElement,
      shippingElement,
      klarnaElement,
      sizeOptionsElement,
      coverOptionsElement,
      accordionElement || featuresElement,
      purchaseElement,
      accordionElement ? null : descriptionElement,
    ];
    var allowedIds = {};
    var oi;
    for (oi = 0; oi < ordered.length; oi++) {
      if (ordered[oi] && ordered[oi].id) allowedIds[ordered[oi].id] = true;
    }
    infoColumn.querySelectorAll(":scope > *").forEach(function (child) {
      if (isBeanBagInfoColumnChildVisible(child, allowedIds)) return;
      if (!child.id) {
        try {
          child.style.setProperty("display", "none", "important");
          child.style.setProperty("visibility", "hidden", "important");
          child.style.setProperty("height", "0", "important");
          child.style.setProperty("overflow", "hidden", "important");
        } catch (eHide0) {}
      }
    });
    ordered.forEach(function (element) {
      if (element) {
        try {
          infoColumn.appendChild(element);
        } catch (eAppend) {}
      }
    });
    applyBeanBagMobilePurchaseOffset(infoColumn);
    try {
      hideBeanBagNativeOptionsTable();
    } catch (eHideNative) {}
    if (isBeanBagPdpPage()) {
      try { purchaseElement = ensureBeanBagPurchaseControlsAlive() || purchaseElement; } catch (eBbAlive) {}
    }
    consolidateBeanBagPurchaseBlocks(infoColumn, purchaseElement);
    /* Keep the real native quantity input in the one Bean Bag purchase stack,
       immediately before its existing Add to Cart control. */
    ensureQuantityAboveAtc();
    if (isBeanBagPdpPage()) {
      try { ensureBeanBagPurchaseControlsAlive(); } catch (eBbAlive2) {}
    }
    var bbPurchase = resolveBeanBagPurchaseElement(infoColumn);
    var bbQty = global.document.getElementById("mc-pdp-qty-row");
    var bbAtc =
      bbPurchase &&
      bbPurchase.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
    if (bbPurchase && bbQty && bbAtc) {
      try {
        if (bbQty.parentNode !== bbPurchase || bbQty.nextElementSibling !== bbAtc) {
          bbPurchase.insertBefore(bbQty, bbAtc);
        }
        bbQty.style.setProperty("display", "inline-flex", "important");
        bbQty.style.setProperty("visibility", "visible", "important");
        bbQty.style.setProperty("opacity", "1", "important");
        bbQty.style.setProperty("height", "auto", "important");
        var bbQtyInput = bbQty.querySelector(
          'input.v65-productdetail-cartqty, input[name^="QTY."], input[name="QTY"], input[name="quantity"]'
        );
        if (bbQtyInput) {
          /* The Bean Bag stack may be full-width; the quantity field itself
             must remain the compact, centered control used on other PDPs. */
          bbQtyInput.style.setProperty("display", "inline-block", "important");
          bbQtyInput.style.setProperty("width", "58px", "important");
          bbQtyInput.style.setProperty("min-width", "58px", "important");
          bbQtyInput.style.setProperty("max-width", "58px", "important");
          bbQtyInput.style.setProperty("height", "48px", "important");
          bbQtyInput.style.setProperty("flex", "0 0 58px", "important");
          bbQtyInput.style.setProperty("margin", "0 auto", "important");
        }
      } catch (eBbQty) {}
    }
    relocateVariantSwatchesFromMediaColumn();
    infoColumn.querySelectorAll(":scope > table, :scope > div").forEach(function (node) {
      if (node.id && /^(mc-pdp-|beanbag-|messaging|mc-bb-)/.test(node.id)) return;
      if (node.id) return;
      var txt = String(node.textContent || "");
      if (/stripe|product_productprice/i.test(txt) || node.querySelector(".product_productprice")) {
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("overflow", "hidden", "important");
        } catch (eHide) {}
      }
    });
  }

  function hideSaranoniNativePriceTables(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    infoColumn.querySelectorAll(":scope > table.colors_pricebox, :scope > table:has(.colors_pricebox)").forEach(
      function (table) {
        if (table.querySelector("#mc-pdp-option-block")) return;
        if (
          table.querySelector(
            "#mc-pdp-brand-logo, #mc-pdp-title-right, #mc-pdp-price-stack-host, #mc-pdp-features, #mc-pdp-purchase-stack"
          )
        ) {
          return;
        }
        try {
          table.style.setProperty("display", "none", "important");
          table.style.setProperty("visibility", "hidden", "important");
          table.style.setProperty("height", "0", "important");
          table.style.setProperty("max-height", "0", "important");
          table.style.setProperty("overflow", "hidden", "important");
          table.style.setProperty("margin", "0", "important");
          table.style.setProperty("padding", "0", "important");
        } catch (eHide) {}
      }
    );
    infoColumn.querySelectorAll(".option_pricing, font.option_pricing").forEach(function (node) {
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
      } catch (eOpt) {}
    });
    infoColumn.querySelectorAll(":scope > div, :scope > font, :scope > span").forEach(function (node) {
      if (node.id && /^mc-pdp-/.test(node.id)) return;
      if (node.id === "messaging-element") return;
      var txt = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (/^price$/i.test(txt) || /price with selected options/i.test(txt)) {
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("overflow", "hidden", "important");
        } catch (ePrice) {}
      }
    });
  }

  function resolveSaranoniInfoColumn() {
    /* Saranoni's native price markup contains several nested table cells.  The
       prior generic resolver selected the innermost one, which is offset well
       inside the actual right-hand product column and made the entire purchase
       stack jump right whenever this routine re-ran.  Use the direct product-row
       cell so the media and features columns share one stable frame. */
    var row = global.document.querySelector(
      "#v65-product-parent tr.mc-pdp-main-row, #content_area tr.mc-pdp-main-row"
    );
    var directColumn = row && row.querySelector(":scope > td.vol-product__top--right");
    if (directColumn) return directColumn;
    return findPdpHeroColumnTd();
  }

  function hideSaranoniNativeStripePriceTable(infoColumn) {
    // Do NOT move #messaging-element — Klarna/Affirm renders content as siblings
    // or adjacent nodes; any DOM relocation orphans the widget and hides it.
    // Only ensure its inline visibility styles are clear.
    var msg = global.document.getElementById("messaging-element");
    if (msg) {
      try {
        msg.style.removeProperty("display");
        msg.style.removeProperty("visibility");
        msg.style.removeProperty("opacity");
        msg.style.removeProperty("height");
      } catch (eBnpl) {}
    }
  }

  function anchorSaranoniMessagingElement(infoColumn) {
    hideSaranoniNativeStripePriceTable(infoColumn);
  }

  var saranoniLayoutTimer = null;
  var saranoniLayoutLastRun = 0;
  var saranoniLayoutFinalizing = false;
  function scheduleSaranoniLayoutPass(force) {
    if (!isSaranoniPdpPage() || isStalePdpAuthRun()) return;
    if (force) {
      if (saranoniLayoutTimer) {
        global.clearTimeout(saranoniLayoutTimer);
        saranoniLayoutTimer = null;
      }
      finalizeSaranoniInfoColumnOrder();
      return;
    }
    if (saranoniLayoutTimer) return;
    if (Date.now() - saranoniLayoutLastRun < 120) return;
    saranoniLayoutTimer = global.setTimeout(function () {
      saranoniLayoutTimer = null;
      saranoniLayoutLastRun = Date.now();
      finalizeSaranoniInfoColumnOrder();
    }, 60);
  }

  function buildSaranoniAccordionRow(id, label, contentHost) {
    var row = global.document.createElement("div");
    row.className = "mc-acc-row";
    row.id = "mc-acc-row-" + id;
    row.dataset.open = "0";
    var header = global.document.createElement("button");
    header.type = "button";
    header.className = "mc-acc-header";
    header.setAttribute("aria-expanded", "false");
    header.innerHTML =
      '<span class="mc-acc-label">' +
      escapeHtmlText(label) +
      '</span><span class="mc-acc-chevron" aria-hidden="true">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
      "</span>";
    var panel = global.document.createElement("div");
    panel.className = "mc-acc-panel";
    panel.setAttribute("aria-hidden", "true");
    header.addEventListener("click", function (e) {
      e.preventDefault();
      var open = row.dataset.open === "1";
      if (row.parentNode) {
        Array.prototype.forEach.call(row.parentNode.querySelectorAll(".mc-acc-row"), function (sibling) {
          var siblingHeader = sibling.querySelector(".mc-acc-header");
          var siblingPanel = sibling.querySelector(".mc-acc-panel");
          sibling.dataset.open = "0";
          if (siblingHeader) siblingHeader.setAttribute("aria-expanded", "false");
          if (siblingPanel) siblingPanel.setAttribute("aria-hidden", "true");
        });
      }
      if (!open) {
        row.dataset.open = "1";
        header.setAttribute("aria-expanded", "true");
        panel.setAttribute("aria-hidden", "false");
      }
    });
    if (contentHost && contentHost.parentNode !== panel) {
      panel.appendChild(contentHost);
    }
    row.appendChild(header);
    row.appendChild(panel);
    return row;
  }

  function mountNodeInSaranoniAccordionHost(host, node) {
    if (!host || !node) return;
    if (node.parentNode === host) return;
    try {
      host.appendChild(node);
    } catch (eMount) {}
  }

  /* Keep #mc-pdp-features inside the FEATURES accordion panel — later layout
     passes were re-inserting it as a loose sibling under the info column. */
  function ensureFeaturesInsideAccordion() {
    if (!isUnifiedAccordionPdp()) return;
    if (isCordaroysBrandPdpPage()) {
      try {
        ensureBeanBagPdpAccordion();
      } catch (eBbAccFeat) {}
      var featuresBb = global.document.getElementById("mc-pdp-features");
      var panelBb = global.document.querySelector("#mc-acc-row-features .mc-acc-panel");
      if (featuresBb && panelBb && featuresBb.parentNode !== panelBb) {
        try {
          panelBb.appendChild(featuresBb);
        } catch (eBbFeatMount) {}
      }
      var descBb = global.document.getElementById("mc-pdp-description-below-features");
      var detailsBb = global.document.querySelector("#mc-acc-row-details .mc-acc-panel");
      if (descBb && detailsBb && descBb.parentNode !== detailsBb) {
        try {
          detailsBb.appendChild(descBb);
        } catch (eBbDescMount) {}
      }
      return;
    }
    var features = global.document.getElementById("mc-pdp-features");
    if (!features) return;
    var featuresHost = global.document.getElementById("mc-acc-saranoni-features-host");
    if (!featuresHost) {
      try {
        ensureSaranoniPdpAccordion();
      } catch (eAcc) {}
      featuresHost = global.document.getElementById("mc-acc-saranoni-features-host");
    }
    if (!featuresHost) return;
    if (features.parentNode !== featuresHost) {
      try {
        featuresHost.appendChild(features);
      } catch (eFeat) {}
    }
    var featHeading = features.querySelector(".mc-pdp-features__heading");
    if (featHeading) {
      try {
        featHeading.style.setProperty("display", "none", "important");
      } catch (eHideFeat) {}
    }
  }

  function resolveGenericProductDescriptionNode() {
    var descHost = global.document.getElementById("mc-pdp-description-below-features");
    if (descHost && String(descHost.textContent || "").replace(/\s+/g, "").length > 20) {
      return descHost;
    }
    var candidates = [
      global.document.getElementById("ProductDetail_ProductDetails_div"),
      global.document.getElementById("ProductDetail_ProductDetails_div2"),
      global.document.querySelector(
        ".mc-unified-pdp-description--media #ProductDetail_ProductDetails_div, .mc-unified-pdp-description--media #product_description"
      ),
      global.document.getElementById("product_description"),
      global.document.querySelector(
        "#ProductDetail_ProductDetails_div span[itemprop='description'], #ProductDetail_ProductDetails_div2 span[itemprop='description']"
      ),
    ];
    var i;
    for (i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (!node) continue;
      if (
        node.closest(
          "#mc-pdp-features, #mc-acc-saranoni-features-host, #mc-acc-row-saranoni-features"
        )
      ) {
        continue;
      }
      if (String(node.textContent || "").replace(/\s+/g, " ").trim().length >= 20) {
        return node;
      }
    }
    return null;
  }

  function ensureGenericProductDescriptionHost(infoColumn) {
    var descNode = resolveGenericProductDescriptionNode();
    if (!descNode) return null;
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-below-features";
      host.className = "mc-pdp-description-below-features";
    }
    if (descNode !== host && descNode.parentNode !== host) {
      try {
        descNode.querySelectorAll("script").forEach(function (s) {
          try {
            s.remove();
          } catch (eRmScript) {}
        });
        host.appendChild(descNode);
      } catch (eWrapDesc) {}
    }
    if (infoColumn && host.parentNode !== infoColumn && !host.closest("#mc-pdp-accordion")) {
      try {
        infoColumn.appendChild(host);
      } catch (eHostCol) {}
    }
    ensureDescriptionBelowFeaturesInner(host);
    return host;
  }

  function repairGenericAccordionProductDetails() {
    if (!isUnifiedAccordionPdp()) return;
    var infoColumn = resolveSaranoniInfoColumn() || findPdpHeroColumnTd();
    var detailsHost = global.document.getElementById("mc-acc-saranoni-product-details-host");
    var panel = global.document.querySelector(
      "#mc-acc-row-saranoni-product-details .mc-acc-panel, #mc-acc-row-details .mc-acc-panel"
    );
    if (!detailsHost && panel) {
      detailsHost =
        panel.querySelector(".mc-acc-content--saranoni-description") ||
        panel.querySelector("#mc-pdp-description-below-features") ||
        panel;
    }
    if (isBeanBagPdpPage() && !detailsHost) {
      detailsHost = global.document.querySelector("#mc-acc-row-details .mc-acc-panel");
    }
    var host = ensureGenericProductDescriptionHost(infoColumn);
    if (host && detailsHost) {
      mountNodeInSaranoniAccordionHost(detailsHost, host);
    }
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (acc && detailsHost && !hostHasGenericAccordionDetailsContent(detailsHost)) {
      var desc = resolveGenericProductDescriptionNode();
      if (desc) mountNodeInSaranoniAccordionHost(detailsHost, desc);
    }
    global.document
      .querySelectorAll("td.mc-unified-pdp-media .mc-unified-pdp-description--media, td.mc-pdp-media-td .mc-unified-pdp-description--media")
      .forEach(function (stray) {
        try {
          stray.style.setProperty("display", "none", "important");
          stray.setAttribute("aria-hidden", "true");
        } catch (eHideStray) {}
      });
  }

  function hostHasGenericAccordionDetailsContent(host) {
    if (!host) return false;
    var txt = String(host.textContent || "").replace(/\s+/g, " ").trim();
    return txt.length >= 20;
  }

  function ensureSaranoniPdpAccordion() {
    if (!isUnifiedAccordionPdp()) {
      return null;
    }
    /* Bean bags own their accordion (features/details hosts). Never rebuild
       them with saranoni-* row ids — that destroys #mc-pdp-features via
       innerHTML="" and leaves empty FEATURES / PRODUCT DETAILS bars. */
    if (isBeanBagPdpPage() || isCordaroysExtendedPdpPage()) {
      try {
        return ensureBeanBagPdpAccordion();
      } catch (eBbOwnAcc) {
        return null;
      }
    }
    var infoColumn = resolveSaranoniInfoColumn();
    if (!infoColumn) return null;
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (!acc) {
      acc = global.document.createElement("div");
      acc.id = "mc-pdp-accordion";
      acc.className = "mc-pdp-accordion";
    }
    function getOrCreateHost(id, className) {
      var host = global.document.getElementById(id);
      if (!host) {
        host = global.document.createElement("div");
        host.id = id;
        host.className = className;
      }
      return host;
    }
    function hostHasContent(host) {
      if (!host) return false;
      var txt = String(host.textContent || "").replace(/\s+/g, " ").trim();
      if (txt) return true;
      return !!host.querySelector("img,svg,video,table,ul,ol,li,p,a,button,select");
    }
    function mountExistingTextPanel(host, pattern) {
      if (!host || host.dataset.mcSaranoniPanelMounted === "1") return;
      var root = global.document.getElementById("content_area") || global.document;
      var nodes = root.querySelectorAll(
        "#ProductDetail_ExtInfo_div, #divQuestions, .TabbedPanelsContent, .resp-tabs-container, .product_description, [id*='FAQ'], [id*='faq'], [class*='FAQ'], [class*='faq']"
      );
      Array.prototype.some.call(nodes, function (node) {
        if (!node || node === host || node.closest("#mc-pdp-accordion") || node.closest("#v65-product-related")) return false;
        if (node.id === "mc-pdp-features" || node.id === "mc-pdp-description-below-features") return false;
        var txt = String(node.textContent || "").replace(/\s+/g, " ").trim();
        if (!txt || !pattern.test(txt)) return false;
        try {
          host.appendChild(node);
          host.dataset.mcSaranoniPanelMounted = "1";
        } catch (ePanelMove) {}
        return true;
      });
    }

    var detailsHost = getOrCreateHost(
      "mc-acc-saranoni-product-details-host",
      "mc-acc-content mc-acc-content--saranoni-description"
    );
    var featuresHost = getOrCreateHost(
      "mc-acc-saranoni-features-host",
      "mc-acc-content mc-acc-content--saranoni-features"
    );
    var shippingHost = getOrCreateHost(
      "mc-acc-saranoni-shipping-returns-host",
      "mc-acc-content mc-acc-content--saranoni-shipping-returns"
    );
    var faqHost = getOrCreateHost("mc-acc-saranoni-faq-host", "mc-acc-content mc-acc-content--saranoni-faq");

    var features = global.document.getElementById("mc-pdp-features");
    if (features) {
      mountNodeInSaranoniAccordionHost(featuresHost, features);
      var featHeading = features.querySelector(".mc-pdp-features__heading");
      if (featHeading) {
        try {
          featHeading.style.setProperty("display", "none", "important");
        } catch (eHideFeat) {}
      }
    }
    mountNodeInSaranoniAccordionHost(
      detailsHost,
      global.document.getElementById("mc-pdp-description-below-features")
    );
    if (isMahjongHousePdpPage() && !hostHasContent(detailsHost)) {
      var tmhDesc = findMahjongDescriptionSource();
      if (tmhDesc) {
        mountNodeInSaranoniAccordionHost(detailsHost, tmhDesc);
      }
    }
    if (isCloseoutPdpPage() && !hostHasContent(detailsHost)) {
      var closeoutDesc =
        global.document.getElementById("ProductDetail_ProductDetails_div2") ||
        global.document.getElementById("ProductDetail_ProductDetails_div") ||
        global.document.getElementById("ProductDetail_ExtInfo_div");
      if (closeoutDesc && !closeoutDesc.closest("#mc-pdp-accordion")) {
        mountNodeInSaranoniAccordionHost(detailsHost, closeoutDesc);
      }
    }
    ensureGenericProductDescriptionHost(infoColumn);
    mountNodeInSaranoniAccordionHost(
      detailsHost,
      global.document.getElementById("mc-pdp-description-below-features")
    );
    if (!hostHasGenericAccordionDetailsContent(detailsHost)) {
      var genericDesc = resolveGenericProductDescriptionNode();
      if (genericDesc) {
        if (genericDesc.id === "mc-pdp-description-below-features") {
          mountNodeInSaranoniAccordionHost(detailsHost, genericDesc);
        } else {
          var genericHost = ensureGenericProductDescriptionHost(infoColumn);
          if (genericHost) mountNodeInSaranoniAccordionHost(detailsHost, genericHost);
        }
      }
    }
    mountExistingTextPanel(shippingHost, /\b(shipping|returns?|return policy)\b/i);
    mountExistingTextPanel(faqHost, /\b(faq|frequently asked questions?)\b/i);

    if (!hostHasContent(featuresHost)) {
      var featSeed = global.document.getElementById("mc-pdp-features");
      if (!featSeed) {
        featSeed = global.document.createElement("div");
        featSeed.id = "mc-pdp-features";
        featSeed.className = "mc-pdp-features";
        featSeed.innerHTML =
          '<ul class="mc-pdp-features__list"><li>Premium construction and finish</li><li>Designed for everyday use</li><li>See Product Details for full specifications</li></ul>';
      }
      mountNodeInSaranoniAccordionHost(featuresHost, featSeed);
    }
    if (!hostHasGenericAccordionDetailsContent(detailsHost)) {
      var detailSeed = ensureGenericProductDescriptionHost(infoColumn);
      if (detailSeed) mountNodeInSaranoniAccordionHost(detailsHost, detailSeed);
      if (!hostHasGenericAccordionDetailsContent(detailsHost)) {
        detailsHost.innerHTML = "<p>See product specifications and care details below.</p>";
      }
    }
    var rows = [];
    function addRow(id, label, host, force) {
      if (force || hostHasContent(host)) rows.push({ id: id, label: label, host: host });
    }
    addRow("saranoni-features", "FEATURES", featuresHost, true);
    addRow("saranoni-product-details", "PRODUCT DETAILS", detailsHost, true);
    addRow("saranoni-shipping-returns", "SHIPPING & RETURNS", shippingHost, false);
    addRow("saranoni-faq", "FAQ", faqHost, false);

    if (!rows.length) {
      if (acc.parentNode) {
        try {
          acc.parentNode.removeChild(acc);
        } catch (eAccRm) {}
      }
      return null;
    }

    var signature = rows.map(function (row) { return row.id; }).join("|");
    if (acc.dataset.mcSaranoniRows !== signature) {
      acc.innerHTML = "";
      rows.forEach(function (row) {
        acc.appendChild(buildSaranoniAccordionRow(row.id, row.label, row.host));
      });
      acc.dataset.mcSaranoniRows = signature;
    } else {
      rows.forEach(function (row) {
        var panel = global.document.querySelector("#mc-acc-row-" + row.id + " .mc-acc-panel");
        if (panel && row.host.parentNode !== panel) panel.appendChild(row.host);
      });
    }

    var purchaseStack =
      global.document.getElementById("mc-pdp-purchase-stack") ||
      global.document.querySelector(".mc-unified-purchase-controls");
    try {
      if (purchaseStack && purchaseStack.parentNode === infoColumn) {
        infoColumn.insertBefore(acc, purchaseStack);
      } else if (!infoColumn.contains(acc)) {
        infoColumn.appendChild(acc);
      }
      acc.style.setProperty("display", "block", "important");
      if (isMahjongHousePdpPage() && !global.__MC_MAHJONG_PDP_READY__) {
        acc.style.setProperty("visibility", "hidden", "important");
      } else {
        acc.style.removeProperty("visibility");
      }
    } catch (eAccVis) {}
    if (isMahjongHousePdpPage()) {
      applyMahjongHouseInfoColumnOrder(infoColumn);
    }
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-pdp-accordion-pdp");
        if (isCloseoutPdpPage()) {
          global.document.body.classList.add("mc-closeout-pdp");
        }
      }
    } catch (eAccBody) {}
    ensurePdpAccordionVisible();
    if (isMahjongHousePdpPage()) {
      ensureMahjongAccordionClosed();
      markMahjongPdpReady();
    }
    try {
      ensureFeaturesInsideAccordion();
    } catch (eFeatIn) {}
    return acc;
  }


  function forceCanonicalUnifiedInfoColumnOrder() {
    if (!isUnifiedAccordionPdp()) return;
    /* Soft goods (Cordaroys / Saranoni) keep their approved frames. The
       dining/closeout 650/420 lock must not shrink heroes or wipe logos. */
    if (isBeanBagPdpPage() || isCordaroysExtendedPdpPage()) {
      try { stripTheaterClassFromBeanBags(); } catch (eThBb) {}
      try { forceRevealCanonicalAtc(); } catch (eAtcBb) {}
      try { ensureBeanBagBrandLogo(); } catch (eLogoBb) {}
      try { mountPdpFeaturesBlock(); } catch (eFeatBb) {}
      try { mountDescriptionBelowFeatures(); } catch (eDescBb) {}
      try { ensureBeanBagPdpAccordion(); } catch (eAccBb) {}
      if (isBeanBagPdpPage()) {
        try { ensureBeanBagPurchaseControlsAlive(); } catch (eBbAtc) {}
      }
      try { appendBeanBagInfoColumnOrder(); } catch (eOrdBb) {}
      try { repairBeanBagDesktopMainRow(); } catch (eRowBb) {}
      try { finalizeCordaroysPurchaseStack(); } catch (ePurBb) {}
      if (isBeanBagPdpPage()) {
        try { ensureBeanBagPurchaseControlsAlive(); } catch (eBbAtc2) {}
        try {
          if (!global.__MC_BB_THEATER_STRIP_TIMER__) {
            global.__MC_BB_THEATER_STRIP_TIMER__ = global.setInterval(function () {
              try { stripTheaterClassFromBeanBags(); } catch (eTick) {}
            }, 750);
          }
        } catch (eTimerBb) {}
      }
      try { ensureFeaturesInsideAccordion(); } catch (eFeatInBb) {}
      return;
    }
    if (isSaranoniPdpPage()) {
      try { forceRevealCanonicalAtc(); } catch (eAtcSar) {}
      try { finalizeSaranoniInfoColumnOrder(); } catch (eFinSar) {}
      try { ensureSaranoniVariantsBelowPrice(); } catch (eOrdSar) {}
      try { ensureFeaturesInsideAccordion(); } catch (eFeatInSar) {}
      try { repairGenericAccordionProductDetails(); } catch (eDetSar) {}
      return;
    }
    try { forceRevealCanonicalAtc(); } catch (eAtc0) {}
    var info =
      global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      findPdpHeroColumnTd();
    if (!info) return;
    try {
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      finalizeUnifiedPdpAccordion();
    } catch (eFin) {}
    var brand = global.document.getElementById("mc-pdp-brand-logo");
    var title =
      global.document.getElementById("mc-pdp-title-right") ||
      info.querySelector("h1, .product_name, #ProductDetails_ProductName");
    var price =
      global.document.getElementById("mc-pdp-price-stack-host") ||
      info.querySelector(".mc-pdp-price-stack, .product_productprice, #price_div");
    var shipping = global.document.getElementById("mc-bb-shipping-info");
    var sizeOpts =
      global.document.getElementById("mc-bean-bag-size-row") ||
      global.document.getElementById("mc-saranoni-size-thumbs");
    var covers =
      global.document.getElementById("beanbag-swatch-wrapper") ||
      global.document.getElementById("mc-configured-color-swatches");
    var optionsTable = global.document.getElementById("options_table");
    var desc = global.document.getElementById("mc-pdp-description-below-features");
    var detailsHost = global.document.getElementById("mc-acc-saranoni-product-details-host");
    if (desc && detailsHost && desc.parentNode !== detailsHost) {
      try { detailsHost.appendChild(desc); } catch (eDesc) {}
    }
    var acc = global.document.getElementById("mc-pdp-accordion");
    var purchase =
      global.document.getElementById("mc-pdp-purchase-stack") ||
      info.querySelector("#mc-pdp-purchase-stack, .mc-pdp-purchase-controls, .mc-unified-purchase-controls");
    info.querySelectorAll(
      ":scope > table.colors_pricebox, :scope > .mc-pdp-duplicate-price-hidden"
    ).forEach(function (node) {
      if (purchase && node.contains(purchase)) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
      } catch (eHide) {}
    });
    /* Strict order: logo -> title -> price -> options -> accordion -> ATC */
    var ordered = [brand, title, price, shipping, sizeOpts, covers, optionsTable, acc, purchase];
    var i;
    for (i = 0; i < ordered.length; i++) {
      var el = ordered[i];
      if (!el || !info.contains(el) && el.parentNode !== info) {
        /* allow moving into info even if currently elsewhere in product parent */
      }
      if (!el) continue;
      try {
        info.appendChild(el);
        el.style.setProperty("display", el.id === "options_table" ? "" : "block", "important");
        el.style.removeProperty("visibility");
        el.style.removeProperty("height");
        el.style.removeProperty("overflow");
      } catch (eMove) {}
    }
    /* Keep orphan description / features nodes out of the info column root. */
    if (desc && desc.parentNode === info) {
      try {
        if (detailsHost) detailsHost.appendChild(desc);
        else if (acc) {
          var panel = acc.querySelector("#mc-acc-row-details .mc-acc-panel") || acc;
          panel.appendChild(desc);
        }
      } catch (eDesc2) {}
    }
    try {
      ensureFeaturesInsideAccordion();
    } catch (eFeatCanon) {}
    var media = global.document.querySelector("td.mc-unified-pdp-media, td.mc-pdp-media-td");
    if (media && global.matchMedia && global.matchMedia("(min-width: 992px)").matches) {
      try {
        media.style.setProperty("width", "650px", "important");
        media.style.setProperty("max-width", "650px", "important");
        media.style.setProperty("flex", "0 0 650px", "important");
        media.style.setProperty("padding-right", "24px", "important");
      } catch (eMed) {}
    }
    if (global.matchMedia && global.matchMedia("(min-width: 992px)").matches) {
      try {
        info.style.setProperty("width", "auto", "important");
        info.style.setProperty("max-width", "420px", "important");
        info.style.setProperty("flex", "0 1 420px", "important");
        info.style.setProperty("padding-left", "0", "important");
      } catch (eInfo) {}
    }
    try { finalizeColumnPurchaseStack(); } catch (ePurCanon) {}
  }

  function finalizeUnifiedPdpAccordion() {
    if (!isUnifiedAccordionPdp()) return null;
    try {
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      if (isBeanBagPdpPage() || isCordaroysExtendedPdpPage()) {
        try { ensureBeanBagBrandLogo(); } catch (eBbLogoFin) {}
        ensureBeanBagPdpAccordion();
        repairGenericAccordionProductDetails();
        ensureBeanBagPdpAccordion();
      } else {
        ensureSaranoniPdpAccordion();
        repairGenericAccordionProductDetails();
        ensureSaranoniPdpAccordion();
      }
      ensureFeaturesInsideAccordion();
      ensurePdpAccordionVisible();
      if (global.document.body) {
        global.document.body.classList.add("mc-pdp-accordion-pdp");
      }
    } catch (eUnifiedAcc) {}
    return global.document.getElementById("mc-pdp-accordion");
  }

  function finalizeGenericFurniturePdpAccordion() {
    return finalizeUnifiedPdpAccordion();
  }


  function getCordaroysMattressFallbackContent(pc) {
    var code = String(pc || resolveSoftGoodsProductCode() || "").toUpperCase();
    var size = "Queen";
    if (/^MHH-T-BD/.test(code) || /TWIN/.test(code)) size = "Twin";
    else if (/^MHH-K-BD/.test(code) || /KING/.test(code)) size = "King";
    else if (/^MHH-Q-BD/.test(code) || /QUEEN/.test(code)) size = "Queen";
    var featuresHtml =
      '<ul class="mc-pdp-features__list">' +
      "<li>Five-layer hybrid build with graphite Visco Gel, copper Energex foam, and micro-coil support</li>" +
      "<li>Medium-firm feel (about 7/10) for side, back, and stomach sleepers</li>" +
      "<li>Cooling yarns and copper gel beads help pull heat away overnight</li>" +
      "<li>100-night in-home trial and limited lifetime guarantee</li>" +
      "<li>Made in the USA (Arizona)</li>" +
      "</ul>";
    var detailsHtml =
      "<p>Meet CordaRoy&#39;s Hybrid Mattress. Contouring comfort, advanced cooling, and durable support in a medium-firm hybrid built for everyday sleep.</p>" +
      "<p><b>Dimensions:</b> " +
      size +
      " mattress</p>" +
      "<ul>" +
      "<li>Five-layer hybrid build with graphite Visco Gel, copper Energex foam, and micro-coil support</li>" +
      "<li>Medium-firm feel (about 7/10) for side, back, and stomach sleepers</li>" +
      "<li>Cooling yarns and copper gel beads help pull heat away overnight</li>" +
      "<li>100-night in-home trial and limited lifetime guarantee</li>" +
      "<li>Made in the USA (Arizona)</li>" +
      "</ul>";
    return { featuresHtml: featuresHtml, detailsHtml: detailsHtml };
  }

  function hostHasMeaningfulText(host) {
    if (!host) return false;
    return String(host.textContent || "").replace(/\s+/g, " ").trim().length >= 20;
  }


  /* Bean Bag PDPs already own their Features and optional description nodes.
     Mount those existing nodes in the same accessible accordion component used by
     the other soft-goods PDPs; do not duplicate or rewrite their content. */
  function ensureBeanBagPdpAccordion() {
    if (!isCordaroysBrandPdpPage()) return null;
    var infoColumn = findPdpHeroColumnTd();
    if (!infoColumn) return null;
    var features = global.document.getElementById("mc-pdp-features");
    var description = global.document.getElementById("mc-pdp-description-below-features");

    var acc = global.document.getElementById("mc-pdp-accordion");
    if (!acc) {
      acc = global.document.createElement("div");
      acc.id = "mc-pdp-accordion";
      acc.className = "mc-pdp-accordion mc-bean-bag-accordion";
    }
    var rows = [];
    if (!features) {
      features = global.document.createElement("div");
      features.id = "mc-pdp-features";
      features.className = "mc-pdp-features";
    }
    if (!hostHasMeaningfulText(features)) {
      try {
        var featHtml = extractTechSpecsBodyHtml() || extractDescriptionFeaturesHtml();
        if (!featHtml && /^MHH-/i.test(resolveSoftGoodsProductCode())) {
          featHtml = getCordaroysMattressFallbackContent().featuresHtml;
        }
        if (!featHtml) {
          featHtml = /^MHH-/i.test(resolveSoftGoodsProductCode())
            ? getCordaroysMattressFallbackContent().featuresHtml
            : "<ul class=\"mc-pdp-features__list\"><li>Soft, inviting Cordaroy comfort</li><li>Machine-washable cover options</li><li>Designed for everyday lounge seating</li></ul>";
        }
        if (featHtml.indexOf("mc-pdp-features__") === -1 && featHtml.indexOf("<ul") !== -1) {
          features.innerHTML =
            '<div class="mc-pdp-features__heading" style="display:none">Features:</div><div class="mc-pdp-features__body">' +
            featHtml +
            "</div>";
        } else {
          features.innerHTML = featHtml;
        }
      } catch (eFeatSeed) {}
    }
    rows.push({ id: "features", label: "FEATURES", host: features });
    if (!description) {
      description = global.document.getElementById("mc-pdp-description-below-features");
    }
    if (!description) {
      description = global.document.createElement("div");
      description.id = "mc-pdp-description-below-features";
      description.className = "mc-pdp-description-below-features";
    }
    /* Always prefer the live Volusion productdescription node. */
    try {
      var liveDesc =
        global.document.getElementById("ProductDetail_ProductDetails_div") ||
        global.document.getElementById("product_description") ||
        global.document.getElementById("ProductDetail_ProductDetails_div2") ||
        resolveGenericProductDescriptionNode();
      if (liveDesc && description.contains && description.contains(liveDesc)) {
        /* already mounted */
      } else if (liveDesc && liveDesc !== description && hostHasMeaningfulText(liveDesc)) {
        while (description.firstChild) description.removeChild(description.firstChild);
        if (liveDesc.id === "product_description") {
          var wrapDiv = global.document.getElementById("ProductDetail_ProductDetails_div");
          if (wrapDiv && wrapDiv.contains(liveDesc)) description.appendChild(wrapDiv);
          else description.appendChild(liveDesc);
        } else {
          description.appendChild(liveDesc);
        }
      }
    } catch (eLiveDesc) {}
    if (!hostHasMeaningfulText(description)) {
      try {
        if (/^MHH-/i.test(resolveSoftGoodsProductCode())) {
          description.innerHTML = getCordaroysMattressFallbackContent().detailsHtml;
        } else {
          description.innerHTML = "<p>See product specifications and care details below.</p>";
        }
      } catch (eDescSeed) {}
    }
    try { revealAccordionProductDescription(); } catch (eRevSeed) {}
    rows.push({ id: "details", label: "PRODUCT DETAILS", host: description });
    if (!rows.length) return null;

    var signature = rows.map(function (row) { return row.id; }).join("|");
    var existingRows = rows.every(function (row) {
      return !!acc.querySelector("#mc-acc-row-" + row.id + " .mc-acc-panel");
    });
    /* Drop leftover saranoni-* rows if a prior unified pass rebuilt this accordion. */
    if (acc.querySelector("#mc-acc-row-saranoni-features, #mc-acc-row-saranoni-product-details")) {
      existingRows = false;
    }
    if (existingRows) {
      /* Preserve the mounted Bean Bag rows and their open state on later PDP
         passes. Rebuilding them was replacing the Features panel during hover. */
      rows.forEach(function (row) {
        var panel = acc.querySelector("#mc-acc-row-" + row.id + " .mc-acc-panel");
        if (panel && row.host && row.host.parentNode !== panel) {
          try {
            panel.appendChild(row.host);
          } catch (eBbHost) {}
        }
      });
      acc.dataset.mcBeanBagRows = signature;
    } else {
      try { salvageBeanBagPurchaseFromAccordion(acc); } catch (eSalv0) {}
      while (acc.firstChild) acc.removeChild(acc.firstChild);
      rows.forEach(function (row) { acc.appendChild(buildSaranoniAccordionRow(row.id, row.label, row.host)); });
      acc.dataset.mcBeanBagRows = signature;
    }
    /* Guarantee FEATURES / PRODUCT DETAILS still have content after layout fights. */
    rows.forEach(function (row) {
      var panel = acc.querySelector("#mc-acc-row-" + row.id + " .mc-acc-panel");
      if (!panel || !row.host) return;
      if (row.host.parentNode !== panel) {
        try {
          panel.appendChild(row.host);
        } catch (eBbRemount) {}
      }
    });
    var purchase = resolveBeanBagPurchaseElement(infoColumn);
    if (purchase && purchase.parentNode === infoColumn) infoColumn.insertBefore(acc, purchase);
    else if (acc.parentNode !== infoColumn) infoColumn.appendChild(acc);
    /* If a later saranoni wipe left empty panels, refill hosts now. */
    try {
      var featPanelFill = acc.querySelector("#mc-acc-row-features .mc-acc-panel");
      var detPanelFill = acc.querySelector("#mc-acc-row-details .mc-acc-panel");
      if (featPanelFill && !hostHasMeaningfulText(featPanelFill) && features) {
        if (!hostHasMeaningfulText(features)) {
          if (/^MHH-/i.test(resolveSoftGoodsProductCode())) {
            features.innerHTML = getCordaroysMattressFallbackContent().featuresHtml;
          }
        }
        if (features.parentNode !== featPanelFill) featPanelFill.appendChild(features);
      }
      if (detPanelFill && !hostHasMeaningfulText(detPanelFill) && description) {
        if (!hostHasMeaningfulText(description)) {
          if (/^MHH-/i.test(resolveSoftGoodsProductCode())) {
            description.innerHTML = getCordaroysMattressFallbackContent().detailsHtml;
          }
        }
        if (description.parentNode !== detPanelFill) detPanelFill.appendChild(description);
      }
    } catch (eFillEmpty) {}
    /* Rescue ATC if an earlier pass nested it inside the collapsed Features panel. */
    if (purchase && purchase.closest && purchase.closest("#mc-pdp-accordion .mc-acc-panel")) {
      try {
        if (acc.nextSibling) infoColumn.insertBefore(purchase, acc.nextSibling);
        else infoColumn.appendChild(purchase);
      } catch (eRescueAtc) {}
    }
    try { revealAccordionProductDescription(); } catch (eRevBb) {}
    return acc;
  }

  
  function injectAccordionDescriptionVisibleCss() {
    if (global.document.getElementById("mc-acc-desc-visible-css")) return;
    var el = global.document.createElement("style");
    el.id = "mc-acc-desc-visible-css";
    el.textContent =
      "html body.mc-pdp-unified-ready #mc-pdp-accordion #mc-pdp-description-below-features," +
      "html body.mc-product-page.mc-pdp-unified-ready #mc-pdp-accordion #mc-pdp-description-below-features," +
      "html body.mc-cordaroys-pdp #mc-pdp-accordion #mc-pdp-description-below-features," +
      "html body.mc-bean-bag-pdp #mc-pdp-accordion #mc-pdp-description-below-features," +
      "html body #mc-pdp-accordion #mc-acc-saranoni-product-details-host," +
      "html body #mc-pdp-accordion #ProductDetail_ProductDetails_div," +
      "html body #mc-pdp-accordion #product_description{" +
      "display:block!important;visibility:visible!important;opacity:1!important;" +
      "height:auto!important;max-height:none!important;overflow:visible!important}" +
      "html body #mc-pdp-accordion .mc-acc-panel #mc-pdp-description-below-features," +
      "html body #mc-pdp-accordion .mc-acc-panel #mc-pdp-description-below-features *, " +
      "html body #mc-pdp-accordion .mc-acc-panel #ProductDetail_ProductDetails_div," +
      "html body #mc-pdp-accordion .mc-acc-panel #ProductDetail_ProductDetails_div *, " +
      "html body #mc-pdp-accordion .mc-acc-panel #product_description," +
      "html body #mc-pdp-accordion .mc-acc-panel #product_description *{color:#333!important}";
    (global.document.head || global.document.documentElement).appendChild(el);
  }

  function revealAccordionProductDescription() {
    try {
      var acc = global.document.getElementById("mc-pdp-accordion");
      if (!acc) return;
      var nodes = acc.querySelectorAll(
        "#mc-pdp-description-below-features, #mc-acc-saranoni-product-details-host, #ProductDetail_ProductDetails_div, #ProductDetail_ProductDetails_div2, #product_description, .mc-pdp-description-below-features__inner, [itemprop='description']"
      );
      Array.prototype.forEach.call(nodes, function (el) {
        if (!el || !el.style) return;
        try {
          el.style.setProperty("display", "block", "important");
          el.style.setProperty("visibility", "visible", "important");
          el.style.setProperty("opacity", "1", "important");
          el.style.setProperty("height", "auto", "important");
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("overflow", "visible", "important");
          el.style.setProperty("color", "#333", "important");
        } catch (eShow) {}
      });
    } catch (eReveal) {}
  }

  function ensurePdpAccordionVisible() {
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (!acc) return;
    var tmhPending = isMahjongHousePdpPage() && !global.__MC_MAHJONG_PDP_READY__;
    try {
      acc.style.setProperty("display", "block", "important");
      if (tmhPending) {
        acc.style.setProperty("visibility", "hidden", "important");
      } else {
        acc.style.removeProperty("visibility");
      }
      acc.classList.add("mc-pdp-accordion");
    } catch (eAcc) {}
    acc.querySelectorAll(".mc-acc-row").forEach(function (node) {
      try {
        node.style.setProperty("display", "block", "important");
        node.style.setProperty("visibility", "visible", "important");
      } catch (eRow) {}
    });
    acc.querySelectorAll(".mc-acc-header").forEach(function (node) {
      try {
        node.style.setProperty("display", "flex", "important");
        node.style.setProperty("align-items", "center", "important");
        node.style.setProperty("justify-content", "space-between", "important");
        node.style.setProperty("width", "100%", "important");
        node.style.setProperty("visibility", "visible", "important");
      } catch (eHdr) {}
    });
    try { injectAccordionDescriptionVisibleCss(); } catch (eInjAcc) {}
    try { revealAccordionProductDescription(); } catch (eRevAcc) {}
  }

  function ensureSaranoniHeroImage() {
    if (!isSaranoniPdpPage()) return;
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg) return;
    // The media chain is flattened before this runs, so the hero can fill that
    // column up to 650px. Right alignment keeps the visual gap to the details
    // column fixed even on wide desktop viewports.
    try {
      mainImg.style.setProperty("width", "100%", "important");
      mainImg.style.setProperty("max-width", "min(650px, 100%)", "important");
      mainImg.style.setProperty("height", "auto", "important");
      mainImg.style.setProperty("max-height", "none", "important");
      mainImg.style.setProperty("margin-left", "auto", "important");
      mainImg.style.setProperty("margin-right", "0", "important");
    } catch (eHeroSize) {}
    var pc = resolveConfiguredColorProductCode(null);
    var cur = mainImg.getAttribute("src") || "";
    /* Respect an explicit alt-thumb / color-swatch choice. */
    try {
      if (global.__MC_PDP_ALT_VIEW_ACTIVE_SRC__) return;
      if (configuredColorActiveEntry && configuredColorActiveSrc) return;
    } catch (eHold) {}
    global.document
      .querySelectorAll(
        "td.mc-pdp-media-td img[src*='/manufacturers/'], #product_photo_td img[src*='/manufacturers/']"
      )
      .forEach(function (img) {
        if (img.id === "product_photo") return;
        try {
          img.style.setProperty("display", "none", "important");
        } catch (eHideMfg) {}
      });
    var hasLoadedHero =
      !mainImg.complete || (mainImg.naturalWidth && mainImg.naturalWidth > 0);
    var isColorOptionHero = isSaranoniColorOptionPhotoFile(saranoniPhotoFileName(cur));
    var hasGoodHero =
      cur &&
      !isSaranoniBadHeroSrc(cur) &&
      hasLoadedHero &&
      (!pc || configuredColorImageBelongsToProduct(cur, pc)) &&
      (isColorOptionHero || !isSaranoniSecondaryNumberedPhoto(cur));
    if (hasGoodHero) {
      if (!configuredColorDefaultSrc) configuredColorDefaultSrc = cur;
      if (!configuredColorActiveSrc) configuredColorActiveSrc = cur;
      dismissSaranoniProductPhotoLoading();
      try {
        mainImg.style.setProperty("display", "block", "important");
        mainImg.style.setProperty("opacity", "1", "important");
        mainImg.style.setProperty("visibility", "visible", "important");
      } catch (eShow) {}
      return;
    }
    if (!pc) pc = resolveSoftGoodsProductCode();
    if (!pc) {
      global.document.querySelectorAll("#v65-product-parent img[src]").forEach(function (img) {
        var s = img.getAttribute("src") || "";
        if (s.indexOf("/manufacturers/") !== -1) return;
        if (/-\dT\.(jpg|jpeg|png|webp)/i.test(s)) {
          setConfiguredColorPhotoSrc(s, "", "");
          dismissSaranoniProductPhotoLoading();
        }
      });
      dismissSaranoniProductPhotoLoading();
      try {
        mainImg.style.setProperty("display", "block", "important");
        mainImg.style.setProperty("opacity", "1", "important");
        mainImg.style.setProperty("visibility", "visible", "important");
      } catch (eShowBare) {}
      return;
    }
    loadConfiguredColorImage(
      [
        "/v/vspfiles/photos/" + pc + "-1.jpg",
        "/v/vspfiles/photos/" + pc + "-1T.jpg",
        "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/" + pc + "-1.jpg",
        "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/" + pc + "-1T.jpg",
      ],
      function (resolved) {
        if (!resolved || !configuredColorImageBelongsToProduct(resolved, pc)) return;
        configuredColorDefaultSrc = resolved;
        configuredColorActiveSrc = resolved;
        setConfiguredColorPhotoSrc(resolved, "", pc);
        dismissSaranoniProductPhotoLoading();
      }
    );
  }

  function hoistSaranoniInfoColumnNode(infoColumn, element) {
    if (!infoColumn || !element) return;
    if (element.parentNode === infoColumn) return;
    try {
      infoColumn.appendChild(element);
    } catch (eHoist) {}
  }

  var SARANONI_INFO_COLUMN_ORDER = [
    "mc-pdp-brand-logo",
    "mc-pdp-title-right",
    "mc-pdp-price-stack-host",
    "messaging-element",
    "mc-configured-color-swatch-wrapper",
    "mc-saranoni-size-label",
    "mc-saranoni-size-thumbs",
    "mc-pdp-option-block",
    "mc-pdp-accordion",
    "mc-pdp-purchase-stack",
  ];

  var MAHJONG_INFO_COLUMN_ORDER = [
    "mc-pdp-brand-logo",
    "mc-pdp-title-right",
    "mc-mahjong-price-host",
    "mc-pdp-price-stack-host",
    "messaging-element",
    "mc-pdp-option-block",
    "mc-pdp-accordion",
    "mc-mahjong-purchase-stack",
    "mc-pdp-purchase-stack",
  ];

  function applyInfoColumnOrder(infoColumn, orderIds) {
    if (!infoColumn || !orderIds || !orderIds.length) return;
    var anchor = null;
    orderIds.forEach(function (id) {
      var element = global.document.getElementById(id);
      if (!element) return;
      // messaging-element: only move once, before Klarna/Affirm renders into it.
      // Once the widget has rendered (has child elements), never touch it again.
      if (id === "messaging-element") {
        if (element.childElementCount > 0) {
          if (element.parentNode === infoColumn) anchor = element;
          return;
        }
      }
      if (element.parentNode !== infoColumn) {
        try {
          infoColumn.appendChild(element);
        } catch (eHoist) {}
      }
      try {
        if (anchor) {
          if (anchor.nextElementSibling !== element) {
            insertNodeAfter(infoColumn, anchor, element);
          }
        } else if (infoColumn.firstElementChild !== element) {
          infoColumn.insertBefore(element, infoColumn.firstElementChild);
        }
        if (element.parentNode === infoColumn) anchor = element;
      } catch (eOrd) {}
    });
  }

  function applySaranoniInfoColumnOrder(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    applyInfoColumnOrder(infoColumn, SARANONI_INFO_COLUMN_ORDER);
    dedupeSaranoniConfiguredColorSwatchWrappers();
  }

  function applyMahjongHouseInfoColumnOrder(infoColumn) {
    if (!infoColumn || !isMahjongHousePdpPage()) return;
    ensurePdpTitleInOptionsColumn();
    applyInfoColumnOrder(infoColumn, MAHJONG_INFO_COLUMN_ORDER);
    try {
      var logo = global.document.getElementById("mc-pdp-brand-logo");
      var title = global.document.getElementById("mc-pdp-title-right");
      var price =
        global.document.getElementById("mc-mahjong-price-host") ||
        global.document.getElementById("mc-pdp-price-stack-host");
      if (logo && logo.parentNode !== infoColumn) infoColumn.insertBefore(logo, infoColumn.firstChild);
      if (title && title.parentNode === infoColumn) {
        var titleAfter = logo && logo.parentNode === infoColumn ? logo.nextElementSibling : infoColumn.firstElementChild;
        if (titleAfter !== title) infoColumn.insertBefore(title, titleAfter);
      }
      if (price && title && title.parentNode === infoColumn && title.nextElementSibling !== price) {
        infoColumn.insertBefore(price, title.nextElementSibling);
      }
    } catch (eTmhOrder) {}
    /* Collapse leftover breadcrumb row once the H1 lives under the logo. */
    try {
      global.document
        .querySelectorAll("#v65-product-parent .vCSS_breadcrumb_td")
        .forEach(function (td) {
          if (td.querySelector("h1, #mc-pdp-title-right, [itemprop='name']")) return;
          var text = String(td.textContent || "").replace(/\s+/g, " ").trim();
          if (text.length > 0) return;
          td.style.setProperty("display", "none", "important");
          var tr = td.parentNode;
          if (tr && tr.tagName === "TR") tr.style.setProperty("display", "none", "important");
        });
    } catch (eBcHide) {}
  }

  function reorderSaranoniInfoColumnChildren(infoColumn, skipEnsure) {
    if (!infoColumn) return;
    if (!skipEnsure) {
      ensureSaranoniVariantOptionBlock();
      hideSaranoniNativeStripePriceTable(infoColumn);
    }
    applySaranoniInfoColumnOrder(infoColumn);
  }

  function markSaranoniPdpReady() {
    if (!isSaranoniPdpPage()) return;
    var body = global.document.body;
    if (!body) return;
    ensureSaranoniPdpAccordion();
    dismissSaranoniProductPhotoLoading();
    ensureSaranoniHeroImage();
    ensureFreshSaranoniAltViewRowScript();
    try {
      body.classList.remove("mc-saranoni-pdp-init");
      body.classList.add("mc-saranoni-pdp-ready");
    } catch (eReady) {}
    if (
      global.document.getElementById("mc-pdp-price-stack-host") ||
      global.document.getElementById("mc-pdp-accordion")
    ) {
      markPdpHeroReady();
    }
  }

  function applySaranoniInfoColumnAlignment() {
    if (!isSaranoniPdpPage()) return;
    var col = resolveSaranoniInfoColumn();
    if (!col) return;
    try {
      col.style.setProperty("margin-left", "0", "important");
      col.style.setProperty("padding-left", "0", "important");
      col.style.setProperty("padding-right", "0", "important");
      col.style.setProperty("text-align", "left", "important");
      col.style.setProperty("box-sizing", "border-box", "important");
    } catch (eCol) {}
    [
      "mc-pdp-brand-logo",
      "mc-pdp-title-right",
      "mc-pdp-price-stack-host",
      "mc-configured-color-swatch-wrapper",
      "mc-saranoni-size-thumbs",
      "mc-pdp-option-block",
      "mc-pdp-purchase-stack",
      "mc-pdp-accordion",
    ].forEach(function (id) {
      var el = global.document.getElementById(id);
      if (!el) return;
      try {
        el.style.setProperty("padding-left", "0", "important");
        el.style.setProperty("padding-right", "0", "important");
        el.style.setProperty("margin-left", "0", "important");
        el.style.setProperty("width", "100%", "important");
        el.style.setProperty("max-width", "100%", "important");
        el.style.setProperty("box-sizing", "border-box", "important");
      } catch (eEl) {}
    });
    var accAlign = global.document.getElementById("mc-pdp-accordion");
    if (accAlign) {
      try {
        accAlign.style.setProperty("margin-left", "0", "important");
        accAlign.style.setProperty("padding-left", "0", "important");
      } catch (eAccAlign) {}
      accAlign.querySelectorAll(".mc-acc-header, .mc-acc-panel, .mc-acc-row").forEach(function (node) {
        try {
          node.style.setProperty("padding-left", "0", "important");
          node.style.setProperty("padding-right", "0", "important");
          node.style.setProperty("margin-left", "0", "important");
        } catch (eAccNode) {}
      });
    }
  }

  function hideSaranoniDecorativeNode(node) {
    if (!node) return;
    try {
      node.style.setProperty("display", "none", "important");
      node.style.setProperty("visibility", "hidden", "important");
      node.style.setProperty("height", "0", "important");
      node.style.setProperty("max-height", "0", "important");
      node.style.setProperty("overflow", "hidden", "important");
      node.style.setProperty("margin", "0", "important");
      node.style.setProperty("padding", "0", "important");
      node.style.setProperty("border", "0", "important");
    } catch (eHideDec) {}
  }

  function hideSaranoniLeftoverNativeShell(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    applySaranoniInfoColumnOrder(infoColumn);
    var keepIds =
      "#mc-pdp-brand-logo, #mc-pdp-title-right, #mc-pdp-price-stack-host, #messaging-element, " +
      "#mc-pdp-accordion, #mc-pdp-option-block, #mc-pdp-purchase-stack, #mc-pdp-features, " +
      "#mc-pdp-description-below-features, #mc-configured-color-swatch-wrapper, #mc-saranoni-size-thumbs";
    infoColumn.querySelectorAll('img[src*="PBox_Border"], td[background*="PBox_Border"]').forEach(
      function (node) {
        if (node.closest && node.closest(keepIds)) return;
        var tr = node.closest ? node.closest("tr") : null;
        hideSaranoniDecorativeNode(tr || node);
      }
    );
    infoColumn.querySelectorAll("table.colors_pricebox, table:has(.colors_pricebox)").forEach(
      function (table) {
        if (table.closest("#mc-pdp-option-block")) return;
        if (table.closest("#mc-pdp-accordion")) return;
        var stillHostsMc = table.querySelector(keepIds);
        if (stillHostsMc) {
          SARANONI_INFO_COLUMN_ORDER.forEach(function (id) {
            var el = global.document.getElementById(id);
            if (el && table.contains(el) && el.parentNode !== infoColumn) {
              try {
                infoColumn.appendChild(el);
              } catch (eHoistMc) {}
            }
          });
          stillHostsMc = table.querySelector(keepIds);
        }
        if (!stillHostsMc) {
          hideSaranoniDecorativeNode(table);
          return;
        }
        table.querySelectorAll("tr").forEach(function (tr) {
          if (tr.querySelector(keepIds)) return;
          if (tr.querySelector('img[src*="PBox_Border"], td[background*="PBox_Border"]')) {
            hideSaranoniDecorativeNode(tr);
            return;
          }
          if (
            tr.querySelector(
              'input[name="btnaddtocart"], button[name="btnaddtocart"], input[name^="QTY."], .v65-product-addtocart'
            )
          ) {
            hideSaranoniDecorativeNode(tr);
            return;
          }
          var txt = String(tr.textContent || "").replace(/\s+/g, " ").trim();
          if (!txt && !tr.querySelector("select, input, textarea, button")) {
            hideSaranoniDecorativeNode(tr);
          }
        });
      }
    );
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (acc) {
      try {
        acc.style.setProperty("display", "block", "important");
        acc.style.setProperty("visibility", "visible", "important");
      } catch (eAccShow) {}
    }
    var feat = global.document.getElementById("mc-pdp-features");
    if (feat) {
      try {
        feat.style.removeProperty("display");
        feat.style.setProperty("visibility", "visible", "important");
      } catch (eFeatShow) {}
    }
  }

  function dedupeSaranoniConfiguredColorSwatchWrappers() {
    if (!isSaranoniPdpPage()) return null;
    var wraps = global.document.querySelectorAll('[id="mc-configured-color-swatch-wrapper"]');
    if (!wraps.length) return null;
    if (wraps.length === 1) return wraps[0];
    var infoColumn = resolveSaranoniInfoColumn();
    var purchase = global.document.getElementById("mc-pdp-purchase-stack");
    var keep = wraps[0];
    var best = -1;
    Array.prototype.forEach.call(wraps, function (wrap) {
      var score = wrap.querySelectorAll(".mc-configured-color-swatch").length * 5;
      if (infoColumn && infoColumn.contains(wrap)) score += 100;
      if (
        purchase &&
        purchase.parentNode === infoColumn &&
        wrap.compareDocumentPosition(purchase) & Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        score += 50;
      }
      if (
        purchase &&
        purchase.parentNode === infoColumn &&
        purchase.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        score -= 80;
      }
      if (score > best) {
        best = score;
        keep = wrap;
      }
    });
    Array.prototype.forEach.call(wraps, function (wrap) {
      if (wrap === keep || !wrap.parentNode) return;
      try {
        wrap.parentNode.removeChild(wrap);
      } catch (eRmDupWrap) {}
    });
    return keep;
  }

  function getConfiguredColorSwatchWrapper() {
    if (isSaranoniPdpPage()) {
      var deduped = dedupeSaranoniConfiguredColorSwatchWrappers();
      if (deduped) return deduped;
    }
    return global.document.getElementById("mc-configured-color-swatch-wrapper");
  }

  function removeSaranoniDuplicateColorPicker() {
    if (!isSaranoniPdpPage()) return;
    dedupeSaranoniConfiguredColorSwatchWrappers();
    removeLegacySaranoniTemplatePickers();
    global.document.querySelectorAll("#mc-saranoni-color-picker, .mc-saranoni-color-picker").forEach(function (picker) {
      if (!picker || !picker.parentNode) return;
      if (picker.id === "mc-configured-color-swatch-wrapper") return;
      try {
        picker.parentNode.removeChild(picker);
      } catch (eRmPicker) {}
    });
  }

  function removeLegacySaranoniTemplatePickers() {
    if (!isSaranoniPdpPage()) return;
    [
      ".mc-sar-live-picker",
      ".mc-sar-hotfix-picker",
      "#mc-sar-hotfix-return",
    ].forEach(function (sel) {
      global.document.querySelectorAll(sel).forEach(function (el) {
        if (!el || !el.parentNode) return;
        try {
          el.parentNode.removeChild(el);
        } catch (eRmLegacy) {}
      });
    });
    ["mc-sar-stale-hotfix-css", "mc-sar-swatch-return-fix-css"].forEach(function (id) {
      var st = global.document.getElementById(id);
      if (st && st.parentNode) {
        try {
          st.parentNode.removeChild(st);
        } catch (eRmCss) {}
      }
    });
  }

  function repairSaranoniOrphanSwatchRail(infoColumn) {
    if (!isSaranoniPdpPage()) return;
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (!wrap) return;
    var rail = wrap.querySelector(".mc-configured-color-swatches");
    var orphans = global.document.querySelectorAll(
      "td.mc-unified-pdp-info > .mc-configured-color-swatches, td.mc-pdp-options-td > .mc-configured-color-swatches, .mc-configured-color-swatches.mc-saranoni-swatches"
    );
    Array.prototype.forEach.call(orphans, function (node) {
      if (!node || wrap.contains(node)) return;
      if (rail && node !== rail) {
        try {
          if (node.parentNode) node.parentNode.removeChild(node);
        } catch (eRmOrphan) {}
        return;
      }
      try {
        wrap.appendChild(node);
        rail = node;
      } catch (eReparent) {}
    });
    if (infoColumn && infoColumn.classList && infoColumn.classList.contains("mc-saranoni-scroll-host")) {
      try {
        infoColumn.classList.remove("mc-saranoni-scroll-host");
      } catch (eHost) {}
      infoColumn.querySelectorAll(":scope > .mc-saranoni-scroll-arrow").forEach(function (btn) {
        try {
          if (btn.parentNode) btn.parentNode.removeChild(btn);
        } catch (eBtn) {}
      });
    }
  }

  function resolveSoftGoodsPurchaseElement(infoColumn) {
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    if (stack) return stack;
    var scope = infoColumn || global.document;
    var byClass =
      (scope.querySelector &&
        scope.querySelector(".mc-unified-purchase-controls, .mc-pdp-purchase-controls, .mc-saranoni-purchase-stack")) ||
      global.document.querySelector(
        "td.mc-pdp-options-td .mc-unified-purchase-controls, td.mc-unified-pdp-info .mc-unified-purchase-controls, .mc-unified-purchase-controls"
      );
    if (byClass) {
      try {
        if (!byClass.id) byClass.id = "mc-pdp-purchase-stack";
        byClass.classList.add("mc-pdp-purchase-controls", "mc-pdp-cart-row");
        if (isSaranoniPdpPage()) byClass.classList.add("mc-saranoni-purchase-stack");
      } catch (eTag) {}
      return byClass;
    }
    var btn =
      (scope.querySelector &&
        scope.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]')) ||
      global.document.querySelector(
        'td.mc-pdp-options-td input[name="btnaddtocart"], td.mc-unified-pdp-info input[name="btnaddtocart"], input[name="btnaddtocart"]'
      );
    if (!btn) return null;
    var host =
      (btn.closest &&
        btn.closest(
          "#mc-pdp-purchase-stack, .mc-unified-purchase-controls, .mc-pdp-purchase-controls, .mc-pdp-cart-row"
        )) ||
      btn.parentElement;
    if (!host) return null;
    try {
      if (!host.id) host.id = "mc-pdp-purchase-stack";
      host.classList.add("mc-pdp-purchase-controls", "mc-pdp-cart-row");
      if (isSaranoniPdpPage()) host.classList.add("mc-saranoni-purchase-stack");
    } catch (eHost) {}
    return host;
  }

  /* Logo -> title -> price -> variants -> accordion -> ATC. Always. Desktop + mobile. */
  function ensureSaranoniVariantsBelowPrice() {
    if (!isSaranoniPdpPage()) return;
    var info =
      resolveSaranoniInfoColumn() ||
      global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      findPdpHeroColumnTd();
    if (!info) return;
    repairSaranoniOrphanSwatchRail(info);
    try {
      ensurePurchaseStackCentered();
      ensureQuantityAboveAtc();
    } catch (ePurPrep) {}
    try {
      info.style.setProperty("display", "flex", "important");
      info.style.setProperty("flex-direction", "column", "important");
      info.style.setProperty("align-items", "stretch", "important");
    } catch (eFlex) {}
    try {
      applySaranoniInfoColumnOrder(info);
    } catch (eOrdSarCol) {}
    var logo = global.document.getElementById("mc-pdp-brand-logo");
    var title = global.document.getElementById("mc-pdp-title-right");
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    var colors = global.document.getElementById("mc-configured-color-swatch-wrapper");
    var sizeLabel = global.document.getElementById("mc-saranoni-size-label");
    var sizes = global.document.getElementById("mc-saranoni-size-thumbs");
    var accordion = global.document.getElementById("mc-pdp-accordion");
    var purchase = resolveSoftGoodsPurchaseElement(info);
    /* Never promote ATC ahead of logo/title — only reorder once logo exists. */
    if (!logo || !title) return;
    var stack = [logo, title, price, colors, sizeLabel, sizes, accordion, purchase];
    var orders = [1, 2, 3, 5, 6, 7, 9, 10];
    var anchor = null;
    stack.forEach(function (el, idx) {
      if (!el) return;
      try {
        if (el.parentNode !== info) info.appendChild(el);
        if (anchor && anchor.parentNode === info) {
          if (anchor.nextElementSibling !== el) insertNodeAfter(info, anchor, el);
        } else if (info.firstElementChild !== el) {
          info.insertBefore(el, info.firstElementChild);
        }
        if (el.parentNode === info) anchor = el;
        el.style.setProperty("order", String(orders[idx]), "important");
        if (el === colors || el === sizes || el === sizeLabel) {
          el.style.setProperty(
            "display",
            el.id === "mc-saranoni-size-thumbs" ? "grid" : "block",
            "important"
          );
          el.style.setProperty("visibility", "visible", "important");
          el.style.setProperty("width", "100%", "important");
          el.style.setProperty("max-width", "100%", "important");
        }
      } catch (eMove) {}
    });
    if (purchase) {
      try {
        purchase.style.setProperty("order", "10", "important");
        purchase.style.setProperty("display", "flex", "important");
        if (purchase.parentNode === info && accordion && accordion.parentNode === info) {
          if (purchase.compareDocumentPosition(accordion) & 2) {
            insertNodeAfter(info, accordion, purchase);
          }
        }
      } catch (ePurOrd) {}
    }
    if (logo) {
      try {
        logo.style.setProperty("order", "1", "important");
        logo.style.setProperty("display", "block", "important");
        logo.style.setProperty("visibility", "visible", "important");
      } catch (eLogoOrd) {}
    }
  }

  function ensureSaranoniVariantsBelowPriceMobile() {
    ensureSaranoniVariantsBelowPrice();
  }

  function finalizeSaranoniInfoColumnOrder() {
    if (saranoniLayoutFinalizing) return;
    saranoniLayoutFinalizing = true;
    try {
      if (!isSaranoniPdpPage()) return;

      hideLegacyPdpFrameBits();
      expandSaranoniHeroNestedTables();
      ensureSaranoniHeroImage();
      /* Rehome title BEFORE breadcrumb H1 hide rules leave the page blank. */
      try {
        ensurePdpTitleInOptionsColumn();
      } catch (eTitle) {}
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      hideSaranoniNestedStrayMediaCol();
      removeSaranoniDuplicateColorPicker();
      relocateVariantSwatchesFromMediaColumn();

      var infoColumn = resolveSaranoniInfoColumn();
      if (infoColumn) {
        hideSaranoniNativePriceTables(infoColumn);
        hideSaranoniNativeColumnClutter(infoColumn);
        hideSaranoniNativeOptionPricing();
        hideSaranoniNativePurchaseUi(infoColumn);
        try {
          ensurePdpTitleInOptionsColumn();
        } catch (eTitle2) {}
        ensureSaranoniPdpAccordion();
        ensurePurchaseStackCentered();
        ensureQuantityAboveAtc();
        ensureSaranoniSizeThumbsInInfoColumn();
        hideSaranoniStrayHeroCopy(infoColumn);
        applySaranoniInfoColumnOrder(infoColumn);
        applySaranoniInfoColumnAlignment();
        hideSaranoniLeftoverNativeShell(infoColumn);
        ensureSaranoniHeroImage();
        try { ensureSaranoniVariantsBelowPrice(); } catch (eSarMobFin) {}
      }

      revealSaranoniRelated();
      markSaranoniPdpReady();
      markPdpHeroReady();
    } finally {
      saranoniLayoutFinalizing = false;
    }
  }

  function hideSaranoniNativePurchaseUi(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    infoColumn.querySelectorAll("table, form").forEach(function (node) {
      if (stack && (node === stack || node.contains(stack) || stack.contains(node))) return;
      if (
        node.querySelector(
          "#mc-pdp-brand-logo, #mc-pdp-title-right, #mc-pdp-price-stack-host, #mc-pdp-accordion, #messaging-element"
        )
      ) {
        return;
      }
      if (
        !node.querySelector(
          'input[name="btnaddtocart"], button[name="btnaddtocart"], input[name^="QTY."], input.v65-productdetail-cartqty'
        )
      ) {
        return;
      }
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
      } catch (eHide) {}
    });
  }

  function appendSaranoniInfoColumnOrder() {
    if (isStalePdpAuthRun()) return;
    if (!isSaranoniPdpPage()) return;
    ensureSaranoniPdpLayoutCss();
    try {
      removeSaranoniOutsideReturnLinks();
    } catch (eRmLinks) {}
    var infoColumn = resolveSaranoniInfoColumn();
    if (!infoColumn) return;
    hideLegacyPdpFrameBits();
    expandSaranoniHeroNestedTables();
    ensureSaranoniHeroImage();
    mountPdpFeaturesBlock();
    mountDescriptionBelowFeatures();
    ensureSaranoniVariantUi();
    relocateVariantSwatchesFromMediaColumn();
    hideSaranoniNativeColumnClutter(infoColumn);
    hideSaranoniNativePurchaseUi(infoColumn);
    ensureSaranoniPdpAccordion();
    ensureSaranoniSizeThumbsInInfoColumn();
    hideSaranoniNativePriceTables(infoColumn);
    hideSaranoniStrayHeroCopy(infoColumn);
    hideSaranoniNativeOptionPricing();
    dismissSaranoniProductPhotoLoading();
    infoColumn.querySelectorAll(":scope > table, :scope > div").forEach(function (node) {
      if (node.id && /^(mc-pdp-|messaging|mc-configured)/.test(node.id)) return;
      if (node.id) return;
      var txt = String(node.textContent || "");
      if (/stripe|product_productprice/i.test(txt) || node.querySelector(".product_productprice")) {
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("overflow", "hidden", "important");
        } catch (eHide) {}
      }
    });
    syncPdpDescriptionViewMore();
    ensurePurchaseStackCentered();
    ensureQuantityAboveAtc();
    hideSaranoniNativePurchaseUi(infoColumn);
    ensureSaranoniPdpAccordion();
    applySaranoniInfoColumnOrder(infoColumn);
    applySaranoniInfoColumnAlignment();
    hideSaranoniLeftoverNativeShell(infoColumn);
    ensureSaranoniHeroImage();
    try {
      ensureSaranoniVariantsBelowPrice();
    } catch (eOrdAppend) {}
    markSaranoniPdpReady();
  }

  function ensureSaranoniSizeThumbsInInfoColumn() {
    var row = global.document.getElementById("mc-saranoni-size-thumbs");
    if (!row) return;
    var label = global.document.getElementById("mc-saranoni-size-label");
    var mediaTd = findPdpMediaTd();
    var infoColumn = resolveSaranoniInfoColumn();
    if (!infoColumn) return;
    if (mediaTd && mediaTd.contains(row)) {
      try {
        mediaTd.removeChild(row);
      } catch (eRmMedia) {}
    }
    if (row.parentNode !== infoColumn) {
      try {
        var atc = global.document.getElementById("mc-pdp-purchase-stack");
        if (atc && atc.parentNode === infoColumn) {
          infoColumn.insertBefore(row, atc);
        } else {
          infoColumn.appendChild(row);
        }
      } catch (eHoist) {}
    }
    if (label) {
      try {
        if (label.parentNode !== infoColumn || label.nextElementSibling !== row) {
          infoColumn.insertBefore(label, row);
        }
      } catch (eLabelHoist) {}
    }
  }

  function hideSaranoniNativeColumnClutter(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    if (!global.document.getElementById("mc-pdp-price-stack-host")) return;
    infoColumn.querySelectorAll(":scope > table").forEach(function (table) {
      if (table.id === "options_table" || table.querySelector("#options_table")) return;
      if (table.querySelector("#mc-pdp-option-block")) return;
      if (
        table.classList.contains("colors_pricebox") ||
        table.querySelector(".colors_pricebox, .product_productprice, #priceWithOptions")
      ) {
        try {
          table.style.setProperty("display", "none", "important");
          table.style.setProperty("visibility", "hidden", "important");
          table.style.setProperty("height", "0", "important");
          table.style.setProperty("max-height", "0", "important");
          table.style.setProperty("overflow", "hidden", "important");
          table.style.setProperty("margin", "0", "important");
          table.style.setProperty("padding", "0", "important");
        } catch (eHide) {}
      }
    });
    infoColumn.querySelectorAll(":scope > #options_table, :scope > table[id*='options_table']").forEach(
      function (table) {
        if (global.document.getElementById("mc-pdp-option-block") && global.document.getElementById("mc-pdp-option-block").contains(table)) {
          return;
        }
        try {
          table.style.setProperty("display", "none", "important");
          table.style.setProperty("visibility", "hidden", "important");
          table.style.setProperty("height", "0", "important");
          table.style.setProperty("overflow", "hidden", "important");
        } catch (eOptHide) {}
      }
    );
  }

  function looksLikeSaranoniSizeOptionsTable(table) {
    if (!table || !table.querySelector || !isSaranoniPdpPage()) return false;
    var sel = table.querySelector("select[name*='___58']");
    if (!sel) return false;
    return /^SAR/i.test(parseProductCodeFromSelectName(sel.name));
  }

  function looksLikeSaranoniColorOptionsTable(table) {
    if (!table || !table.querySelector || !isSaranoniPdpPage()) return false;
    var sel = table.querySelector("select[name*='___23']");
    if (!sel) return false;
    return /^SAR/i.test(parseProductCodeFromSelectName(sel.name));
  }

  function looksLikeSaranoniVariantOptionsTable(table) {
    return looksLikeSaranoniSizeOptionsTable(table) || looksLikeSaranoniColorOptionsTable(table);
  }

  function ensureSaranoniVariantOptionBlock() {
    if (!isSaranoniPdpPage()) return;
    if (
      !findSaranoniSizeVariantContext() &&
      !findConfiguredColorSwatchContext() &&
      !global.document.querySelector("select[name*='___58'][name*='SAR']") &&
      !global.document.querySelector("select[name*='___23'][name*='SAR']")
    ) {
      return;
    }
    var table =
      global.document.getElementById("options_table") ||
      global.document.querySelector("#v65-product-parent table[id*='options_table']") ||
      global.document.querySelector("table[id*='options_table']");
    if (!table || !looksLikeSaranoniVariantOptionsTable(table)) return;
    var col = resolveSaranoniInfoColumn();
    if (!col) return;
    var host = global.document.getElementById("mc-pdp-option-block");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-option-block";
      host.className = "mc-pdp-option-block";
    }
    if (table.parentNode !== host) {
      try {
        host.appendChild(table);
      } catch (eTable) {}
    }
    if (host.parentNode !== col) {
      try {
        col.appendChild(host);
      } catch (eHost) {}
    }
    table.querySelectorAll("select[name*='___58'], select[name*='___23']").forEach(function (sizeSel) {
      try {
        sizeSel.setAttribute("onchange", "");
        sizeSel.onchange = null;
      } catch (eInlineSize) {}
    });
  }

  function ensureSaranoniSizeOptionBlock() {
    ensureSaranoniVariantOptionBlock();
  }

  function hideCloseoutNativePriceBoxChrome() {
    if (!isCloseoutPdpPage() && !isSteveSilverPdpPage()) return;
    if (!global.document.getElementById("mc-pdp-price-stack-host")) return;
    try {
      global.document.querySelectorAll("table.colors_pricebox").forEach(function (box) {
        if (
          box.querySelector(
            "#mc-pdp-price-stack-host, #mc-pdp-purchase-stack, #mc-pdp-brand-logo, #mc-pdp-accordion, #mc-pdp-title-right"
          )
        ) {
          return;
        }
        try {
          box.style.cssText =
            "display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;" +
            "margin:0!important;padding:0!important;overflow:hidden!important;border:0!important;" +
            "position:absolute!important;left:-9999px!important;pointer-events:none!important;";
          box.setAttribute("aria-hidden", "true");
          box.setAttribute("data-mc-closeout-pricebox-hidden", "1");
        } catch (eHide) {}
      });
      global.document
        .querySelectorAll(
          'img[src*="PBox_Border"], img[src*="PBox_Border_Left"], img[src*="PBox_Border_Bottom"], img[src*="PBox_Border_Top"]'
        )
        .forEach(function (img) {
          try {
            img.style.setProperty("display", "none", "important");
            img.style.setProperty("height", "0", "important");
            img.style.setProperty("width", "0", "important");
          } catch (eImg) {}
        });
      /* Orphan "Quantity:" text cells left after qty input was moved into purchase stack. */
      global.document.querySelectorAll("#v65-product-parent td, #content_area td").forEach(function (td) {
        if (td.closest("#mc-pdp-purchase-stack, #mc-pdp-qty-row, #mc-pdp-accordion")) return;
        var text = String(td.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!/^Quantity:?$/i.test(text)) return;
        if (td.querySelector("input, button, select, .mc-atc-button-wrap")) return;
        try {
          td.style.setProperty("display", "none", "important");
          var tr = td.parentElement;
          if (tr && tr.tagName === "TR" && !tr.querySelector("input, button, select")) {
            tr.style.setProperty("display", "none", "important");
          }
        } catch (eTd) {}
      });
    } catch (eChrome) {}
  }

  /* Closeout/SS: qty label + input above ATC; full-width ATC; hide +/- grey squares. */
  function normalizeCloseoutPurchaseControls() {
    if (!isCloseoutPdpPage() && !isSteveSilverPdpPage()) return;
    var purchase =
      global.document.getElementById("mc-pdp-purchase-stack") ||
      global.document.querySelector(".mc-unified-purchase-controls");
    if (!purchase) return;
    try {
      purchase.style.setProperty("display", "flex", "important");
      purchase.style.setProperty("flex-direction", "column", "important");
      purchase.style.setProperty("align-items", "stretch", "important");
      purchase.style.setProperty("justify-content", "flex-start", "important");
      purchase.style.setProperty("width", "100%", "important");
      purchase.style.setProperty("max-width", "100%", "important");
      purchase.style.setProperty("gap", "10px", "important");
    } catch (eStack) {}

    var qty =
      purchase.querySelector('input[name^="QTY."], input.v65-productdetail-cartqty, input[name="quantity"]') ||
      global.document.querySelector(
        '#v65-product-parent input[name^="QTY."], #content_area input[name^="QTY."], input.v65-productdetail-cartqty'
      );
    if (qty) {
      var row = global.document.getElementById("mc-pdp-qty-row");
      if (!row) {
        row = global.document.createElement("div");
        row.id = "mc-pdp-qty-row";
        row.className = "mc-pdp-qty-row";
        var lab = global.document.createElement("span");
        lab.className = "mc-pdp-qty-row__label";
        lab.textContent = "Quantity";
        row.appendChild(lab);
      }
      if (!row.contains(qty)) row.appendChild(qty);
      if (row.parentNode !== purchase) purchase.insertBefore(row, purchase.firstChild);
      try {
        row.style.setProperty("display", "flex", "important");
        row.style.setProperty("flex-direction", "column", "important");
        row.style.setProperty("align-items", "center", "important");
        row.style.setProperty("justify-content", "center", "important");
        row.style.setProperty("gap", "6px", "important");
        row.style.setProperty("width", "100%", "important");
        row.style.setProperty("order", "1", "important");
        var labEl = row.querySelector(".mc-pdp-qty-row__label");
        if (labEl) {
          labEl.style.setProperty("display", "block", "important");
          labEl.style.setProperty("font", "500 13px/1.2 Inter,Arial,sans-serif", "important");
          labEl.style.setProperty("color", "#444", "important");
        }
        qty.style.setProperty("display", "inline-block", "important");
        qty.style.setProperty("width", "58px", "important");
        qty.style.setProperty("height", "38px", "important");
        qty.style.setProperty("text-align", "center", "important");
        qty.style.setProperty("border", "1px solid #e0e0e0", "important");
      } catch (eQty) {}
    }

    purchase.querySelectorAll(".vol-cartqty__toggle, .vol-cartqty__text").forEach(function (el) {
      try {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("aria-hidden", "true");
      } catch (eTog) {}
    });
    purchase.querySelectorAll(".vol-cartqty__wrap").forEach(function (wrap) {
      if (wrap.querySelector("#mc-pdp-qty-row, .mc-pdp-qty-row__label")) return;
      if (qty && wrap.contains(qty)) return;
      try {
        wrap.style.setProperty("display", "none", "important");
      } catch (eWrap) {}
    });

    var atcRow =
      purchase.querySelector(".mc-atc-row, .mc-atc-button-wrap, .v65-product-addtocart") ||
      purchase.querySelector("input[name='btnaddtocart'], button[name='btnaddtocart']");
    if (atcRow && atcRow.closest) {
      var host = atcRow.closest(".mc-atc-row, .v65-product-addtocart, .mc-atc-button-wrap") || atcRow;
      try {
        host.style.setProperty("display", "flex", "important");
        host.style.setProperty("width", "100%", "important");
        host.style.setProperty("max-width", "100%", "important");
        host.style.setProperty("align-self", "stretch", "important");
        host.style.setProperty("order", "2", "important");
        host.style.setProperty("box-sizing", "border-box", "important");
      } catch (eAtcHost) {}
    }
    purchase.querySelectorAll(".mc-atc-button-wrap, .mc-atc-row").forEach(function (wrap) {
      try {
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty("width", "100%", "important");
        wrap.style.setProperty("max-width", "100%", "important");
        wrap.style.setProperty("align-self", "stretch", "important");
        wrap.style.setProperty("flex", "1 1 auto", "important");
      } catch (eW) {}
      wrap.querySelectorAll("input[name='btnaddtocart'], button[name='btnaddtocart'], input[type='submit']").forEach(
        function (btn) {
          try {
            btn.style.setProperty("width", "100%", "important");
            btn.style.setProperty("max-width", "100%", "important");
            btn.style.setProperty("display", "flex", "important");
            btn.style.setProperty("align-items", "center", "important");
            btn.style.setProperty("justify-content", "center", "important");
            btn.style.setProperty("text-align", "center", "important");
            btn.style.setProperty("text-indent", "0.12em", "important");
          } catch (eB) {}
        }
      );
    });
  }

  function appendSteveSilverInfoColumnOrder() {
    if (!isSteveSilverPdpPage() && !isCloseoutPdpPage()) return;
    var infoColumn =
      global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      findPdpHeroColumnTd();
    if (!infoColumn) return;

    try {
      ensurePdpTitleInOptionsColumn();
      forceRebuildCleanPriceStack();
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
    } catch (eSsBlocks) {}

    var accordion = ensureSaranoniPdpAccordion();

    /* Build / reclaim purchase stack from native qty + ATC (often trapped in colors_pricebox). */
    var purchase =
      global.document.querySelector(".mc-unified-purchase-controls") ||
      global.document.getElementById("mc-pdp-purchase-stack");
    if (!purchase) {
      purchase = global.document.createElement("div");
      purchase.id = "mc-pdp-purchase-stack";
      purchase.className = "mc-pdp-purchase-stack mc-pdp-purchase-controls mc-pdp-cart-row";
    }
    try {
      var qty =
        global.document.getElementById("mc-pdp-qty-row") ||
        global.document.querySelector(
          "#v65-product-parent .v65-productdetail-cartqty, #content_area .v65-productdetail-cartqty, #v65-product-parent [class*='cartqty'], .colors_pricebox [class*='cartqty']"
        );
      var atcWrap =
        global.document.querySelector(".mc-atc-button-wrap, .mc-atc-row") ||
        global.document.querySelector(
          "#v65-product-parent .v65-product-addtocart, #content_area .v65-product-addtocart, input[name='btnaddtocart'], button[name='btnaddtocart']"
        );
      if (atcWrap && atcWrap.closest) {
        var atcRow = atcWrap.closest(".mc-atc-row, .v65-product-addtocart, tr");
        if (atcRow && (atcRow.classList.contains("mc-atc-row") || atcRow.classList.contains("v65-product-addtocart"))) {
          atcWrap = atcRow;
        }
      }
      if (qty && !purchase.contains(qty)) purchase.appendChild(qty);
      if (atcWrap && !purchase.contains(atcWrap)) purchase.appendChild(atcWrap);
    } catch (ePurchase) {}

    /* logo → title → price → accordion → qty/ATC (ATC below Product Details) */
    var ordered = [
      global.document.getElementById("mc-pdp-brand-logo"),
      global.document.getElementById("mc-pdp-title-right"),
      global.document.getElementById("mc-pdp-price-stack-host"),
      global.document.getElementById("messaging-element"),
      global.document.getElementById("mc-pdp-option-block"),
      accordion || global.document.getElementById("mc-pdp-features"),
      accordion ? null : global.document.getElementById("mc-pdp-description-below-features"),
      purchase,
    ];
    ordered.forEach(function (element) {
      if (!element) return;
      try {
        infoColumn.appendChild(element);
      } catch (eAppend) {}
    });

    try {
      ensureFeaturesInsideAccordion();
    } catch (eFeatSs) {}

    try {
      infoColumn.style.setProperty("display", "flex", "important");
      infoColumn.style.setProperty("flex-direction", "column", "important");
      infoColumn.style.setProperty("align-items", "stretch", "important");
    } catch (eFlex) {}

    hideCloseoutNativePriceBoxChrome();
    normalizeCloseoutPurchaseControls();

    try {
      var priceHost = global.document.getElementById("mc-pdp-price-stack-host");
      if (priceHost) {
        priceHost.style.setProperty("display", "flex", "important");
        priceHost.style.setProperty("visibility", "visible", "important");
        priceHost.style.setProperty("opacity", "1", "important");
        priceHost.style.setProperty("height", "auto", "important");
        priceHost.querySelectorAll(".mc-pdp-stack-retail-amt, .product_list_price").forEach(function (el) {
          el.style.setProperty("display", "block", "important");
          el.style.setProperty("visibility", "visible", "important");
          el.style.setProperty("opacity", "1", "important");
        });
      }
      var logo = global.document.getElementById("mc-pdp-brand-logo");
      var title = global.document.getElementById("mc-pdp-title-right");
      var accEl = global.document.getElementById("mc-pdp-accordion");
      if (logo) logo.style.setProperty("order", "10", "important");
      if (title) title.style.setProperty("order", "20", "important");
      if (priceHost) priceHost.style.setProperty("order", "30", "important");
      if (accEl) accEl.style.setProperty("order", "50", "important");
      if (purchase) {
        purchase.style.setProperty("display", "flex", "important");
        purchase.style.setProperty("flex-direction", "column", "important");
        purchase.style.setProperty("visibility", "visible", "important");
        purchase.style.setProperty("opacity", "1", "important");
        purchase.style.setProperty("order", "90", "important");
      }
    } catch (eOrder) {}
  }

  function appendMahjongHouseInfoColumnOrder() {
    if (!isMahjongHousePdpPage()) return;
    var infoColumn =
      global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td") ||
      findPdpHeroColumnTd();
    if (!infoColumn) return;
    if (global.__MC_MAHJONG_PDP_READY__) {
      applyMahjongHouseInfoColumnOrder(infoColumn);
      hideMahjongHeroManufacturerLogo();
      return;
    }
    try {
      ensureMahjongHouseBrandLogo();
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      hideNativeVolusionTabPanels();
    } catch (eTmhBlocks) {}
    var accordion = ensureSaranoniPdpAccordion();
    var ordered = [
      global.document.getElementById("mc-pdp-brand-logo"),
      global.document.getElementById("mc-pdp-title-right"),
      global.document.getElementById("mc-pdp-price-stack-host"),
      global.document.getElementById("messaging-element"),
      global.document.getElementById("mc-pdp-option-block"),
      accordion,
      global.document.querySelector(".mc-unified-purchase-controls") ||
        global.document.getElementById("mc-pdp-purchase-stack"),
    ];
    ordered.forEach(function (element) {
      if (!element) return;
      try {
        infoColumn.appendChild(element);
      } catch (eAppend) {}
    });
    applyMahjongHouseInfoColumnOrder(infoColumn);
    hideMahjongHeroManufacturerLogo();
    markMahjongPdpReady();
  }

  function ensurePdpInfoColumnOrder() {
    if (isPdpLayoutMounted()) return;
    if (isBeanBagPdpPage() || isSaranoniPdpPage() || isCordaroysExtendedPdpPage()) return;
    var col = findPdpHeroColumnTd();
    if (!col) {
      var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
      if (!box || !box.parentNode) return;
      col = box.parentNode;
    }
    var title = global.document.getElementById("mc-pdp-title-right");
    var logo = global.document.getElementById("mc-pdp-brand-logo");
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    var bnpl = global.document.getElementById("messaging-element");
    if (title && !col.contains(title)) {
      try {
        col.appendChild(title);
      } catch (eTitleCol) {}
    }
    if (logo && !col.contains(logo)) {
      try {
        col.appendChild(logo);
      } catch (eLogoCol) {}
    }
    if (price && !col.contains(price)) {
      try {
        col.appendChild(price);
      } catch (ePriceCol) {}
    }
    var chain = [];
    if (logo && col.contains(logo) && logo.querySelector("img")) chain.push(logo);
    if (title && col.contains(title)) chain.push(title);
    if (price && col.contains(price)) chain.push(price);
    if (bnpl && col.contains(bnpl)) chain.push(bnpl);
    var ref = null;
    var ci;
    for (ci = 0; ci < chain.length; ci++) {
      var node = chain[ci];
      if (!ref) {
        ref = node;
        continue;
      }
      if (ref.nextElementSibling !== node) {
        insertNodeAfter(col, ref, node);
      }
      ref = node;
    }
  }

  function finalizeSoftGoodsColumnOrder() {
    return;
  }
  function ensurePdpContentColumnOrder() {
    if (isPdpLayoutMounted()) return;
    if (isBeanBagPdpPage() || isSaranoniPdpPage() || isCordaroysExtendedPdpPage()) return;
    var col = findPdpHeroColumnTd();
    if (!col) return;
    var head =
      global.document.getElementById("messaging-element") ||
      global.document.getElementById("mc-pdp-price-stack-host") ||
      global.document.getElementById("mc-pdp-brand-logo") ||
      global.document.getElementById("mc-pdp-title-right");
    if (head && !col.contains(head)) head = null;
    var blocks = [
      global.document.getElementById("mc-pdp-features"),
      global.document.getElementById("mc-pdp-option-block"),
      global.document.getElementById("beanbag-swatch-wrapper"),
      global.document.getElementById("mc-configured-color-swatch-wrapper"),
      global.document.getElementById("mc-pdp-description-below-features"),
      global.document.getElementById("mc-pdp-purchase-stack"),
    ];
    var ref = head;
    var bi;
    for (bi = 0; bi < blocks.length; bi++) {
      var block = blocks[bi];
      if (!block || block.parentNode !== col) continue;
      if (!ref) {
        ref = block;
        continue;
      }
      if (ref.nextElementSibling !== block) {
        insertNodeAfter(col, ref, block);
      }
      ref = block;
    }
  }

  function escapeHtmlText(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeFeatureText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/^[\s\u2022\u00b7\u25aa\u25cf\u25e6\u2023\u2043\u2219•·▪‣◦\-–—*]+\s*/u, "")
      .trim();
  }

  function buildFeaturesListHtml(items) {
    if (!items.length) return "";
    return '<ul class="mc-pdp-features__list">' + items.join("") + "</ul>";
  }

  function extractTechSpecsBodyHtml() {
    var src = global.document.getElementById("ProductDetail_TechSpecs_div");
    if (!src) return "";
    var lis = src.querySelectorAll("li");
    if (lis.length) {
      var items = [];
      var i;
      for (i = 0; i < lis.length; i++) {
        if (lis[i].querySelector("ul, ol")) continue;
        var t = normalizeFeatureText(lis[i].textContent || "");
        if (t) items.push("<li>" + escapeHtmlText(t) + "</li>");
      }
      if (items.length) {
        return buildFeaturesListHtml(items);
      }
    }
    var clone = src.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("style");
    clone.querySelectorAll("script, style").forEach(function (n) {
      try {
        n.remove();
      } catch (eRm) {}
    });
    var inner = (clone.innerHTML || "").replace(/\s+/g, " ").trim();
    if (!inner || /^<ul>\s*<\/ul>$/i.test(inner)) return "";
    var plain = (clone.textContent || "").replace(/\s+/g, " ").trim();
    if (!plain) return "";
    return inner;
  }

  function markNativePanelHidden(node) {
    if (!node) return;
    try {
      node.style.setProperty("display", "none", "important");
      node.setAttribute("aria-hidden", "true");
      node.setAttribute("data-mc-native-panel-hidden", "1");
    } catch (eHide) {}
  }

  function hideLegacyNativeDescriptionShells() {
    if (!isProductPdp()) return;

    var descHost = global.document.getElementById("mc-pdp-description-below-features");
    var mediaDesc = global.document.querySelector(
      "td.mc-unified-pdp-media .mc-unified-pdp-description--media, td.mc-pdp-media-td .mc-unified-pdp-description--media"
    );
    var features = global.document.querySelector("#mc-pdp-features .mc-pdp-features__body");
    var featuresText = features
      ? String(features.textContent || "").replace(/\s+/g, " ").trim()
      : "";
    var mcDescMounted =
      (descHost && String(descHost.textContent || "").replace(/\s+/g, " ").trim().length > 10) ||
      (mediaDesc && String(mediaDesc.textContent || "").replace(/\s+/g, " ").trim().length > 10) ||
      featuresText.length > 10;

    global.document.querySelectorAll("[data-mc-empty-desc='1']").forEach(markNativePanelHidden);

    var div2 = global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (div2 && !(descHost && descHost.contains(div2)) && !(mediaDesc && mediaDesc.contains(div2))) {
      div2.querySelectorAll("table.colors_descriptionbox").forEach(function (orphan) {
        if (orphan.querySelector(".mc-unified-pdp-description--media, #mc-pdp-description-below-features")) {
          return;
        }
        var hasDesc = orphan.querySelector(
          "#ProductDetail_ProductDetails_div, #product_description, span[itemprop='description']"
        );
        var descText = hasDesc
          ? String(hasDesc.textContent || "").replace(/\s+/g, " ").trim()
          : "";
        if (!descText) markNativePanelHidden(orphan);
      });
      var div2Text = String(div2.textContent || "").replace(/\s+/g, " ").trim();
      if (!div2Text || div2Text.length < 5) markNativePanelHidden(div2);
    }

    if (!mcDescMounted) return;

    var mediaTd =
      global.document.querySelector("td.mc-unified-pdp-media, td.mc-pdp-media-td") || null;
    global.document.querySelectorAll("table.colors_descriptionbox").forEach(function (box) {
      if (!box) return;
      if (box.contains(mediaDesc) || box.contains(descHost)) return;
      if (box.querySelector(".mc-unified-pdp-description--media")) return;

      var mainDesc = box.querySelector(
        "#ProductDetail_ProductDetails_div, #product_description, span[itemprop='description']"
      );
      if (mainDesc && descHost && descHost.contains(mainDesc)) {
        markNativePanelHidden(box);
        return;
      }

      if (box.querySelector("#ProductDetail_TechSpecs_div, #ProductDetail_ExtInfo_div")) {
        if (featuresText.length > 10) {
          markNativePanelHidden(box);
        }
        return;
      }

      var legacyDesc = box.querySelector(
        "#ProductDetail_ProductDetails_div2, #ProductDetail_ProductDetails_div"
      );
      if (!legacyDesc) return;
      if (mediaTd && mediaTd.contains(legacyDesc) && mediaDesc && mediaTd.contains(mediaDesc)) return;

      var legacyText = String(legacyDesc.textContent || "").replace(/\s+/g, " ").trim();
      if (!legacyText || legacyText.length < 10) {
        markNativePanelHidden(box);
        return;
      }
      if (descHost && descHost.contains(legacyDesc)) {
        markNativePanelHidden(box);
      }
    });
  }

  function hideNativeVolusionTabPanels() {
    if (!isProductPdp()) return;
    var features = global.document.querySelector("#mc-pdp-features .mc-pdp-features__body");
    var featuresText = features
      ? String(features.textContent || "").replace(/\s+/g, " ").trim()
      : "";
    if (featuresText.length > 10) {
      var tech = global.document.getElementById("ProductDetail_TechSpecs_div");
      if (tech) {
        markNativePanelHidden(tech);
      }
      var extInfo = global.document.getElementById("ProductDetail_ExtInfo_div");
      if (extInfo) {
        markNativePanelHidden(extInfo);
      }
    }

    var mediaDesc =
      global.document.querySelector(".mc-unified-pdp-description--media") ||
      global.document.getElementById("mc-pdp-description-below-features") ||
      global.document.querySelector(
        "td.mc-unified-pdp-media #ProductDetail_ProductDetails_div2, td.mc-pdp-media-td #ProductDetail_ProductDetails_div2"
      );
    var mediaTd =
      global.document.querySelector("td.mc-unified-pdp-media, td.mc-pdp-media-td") || null;
    if (mediaDesc && String(mediaDesc.textContent || "").replace(/\s+/g, " ").trim()) {
      global.document.querySelectorAll("table.colors_descriptionbox").forEach(function (box) {
        if (!box || box.contains(mediaDesc)) return;
        if (box.querySelector("#ProductDetail_TechSpecs_div, #ProductDetail_ExtInfo_div")) {
          markNativePanelHidden(box);
          return;
        }
        var legacyDesc = box.querySelector(
          "#ProductDetail_ProductDetails_div2, #ProductDetail_ProductDetails_div"
        );
        if (!legacyDesc) return;
        if (mediaTd && mediaTd.contains(legacyDesc)) return;
        markNativePanelHidden(box);
      });
    }

    hideLegacyNativeDescriptionShells();
  }

  function resolveSoftGoodsProductCode() {
    try {
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      return String((pcEl && pcEl.value) || "").trim().toUpperCase();
    } catch (ePc) {}
    return "";
  }

  function isBeanBagPdpPage() {
    try {
      if (isSaranoniPdpPage()) return false;
      var pc = resolveSoftGoodsProductCode();
      if (/^MHH-/i.test(pc) || /^FC-/i.test(pc) || /^PC\d*-/i.test(pc)) return false;
      if (/^BB/i.test(pc) || /^XL-/i.test(pc)) return true;
      if (global.document.getElementById("beanbag-swatch-wrapper")) return true;
      if (typeof global.isBeanBagProductPage === "function") return !!global.isBeanBagProductPage();
      if (global.document.body && global.document.body.classList.contains("mc-bean-bag-pdp")) return true;
      var p = String(global.location.pathname || "").toLowerCase();
      if (/product-p\/(?:bb-|xl-)/i.test(p)) return true;
      if (/\/bean-bag-seating-s\//.test(p) && !/\/product-p\//.test(p)) return true;
    } catch (eBb) {}
    return false;
  }


  function isCordaroysExtendedPdpPage() {
    /* Mattresses / dog beds / outdoor: Cordaroys brand, not bean-bag SKUs. */
    try {
      if (isSaranoniPdpPage()) return false;
      if (isBeanBagPdpPage()) return false;
      var pc = resolveSoftGoodsProductCode();
      if (/^MHH-/i.test(pc) || /^FC-/i.test(pc) || /^PC\d*-/i.test(pc)) return true;
      var p = String(global.location.pathname || "").toLowerCase();
      if (/product-p\/(?:mhh-|fc-|pc\d*-)/i.test(p)) return true;
      var title = "";
      try {
        var te = global.document.querySelector('[itemprop="name"], h1, .productnamecolor, .colors_productname');
        title = String((te && te.textContent) || global.document.title || "");
      } catch (eT) {}
      var mfg = "";
      try {
        var me = global.document.querySelector('.product_manufacturer, [itemprop="brand"], #manufacturer_name');
        mfg = String((me && me.textContent) || "");
      } catch (eM) {}
      var hay = (title + " " + mfg).toLowerCase();
      if (/corda\s*roy/.test(hay) && /(mattress|dog\s*bed|outdoor)/.test(hay)) return true;
      if (global.document.body && global.document.body.classList.contains("mc-cordaroys-pdp")) return true;
    } catch (eCx) {}
    return false;
  }

  function isCordaroysBrandPdpPage() {
    return isBeanBagPdpPage() || isCordaroysExtendedPdpPage();
  }

  function isSaranoniPdpPage() {
    try {
      var pc = resolveSoftGoodsProductCode();
      if (/^SAR/.test(pc)) return true;
      if (global.document.body && global.document.body.classList.contains("mc-saranoni-pdp")) return true;
    } catch (eSar) {}
    return false;
  }

  function isMahjongHousePdpPage() {
    try {
      var pc = resolveSoftGoodsProductCode();
      if (/^TMH-/i.test(pc)) return true;
      if (global.document.body && global.document.body.classList.contains("mc-mahjong-house-pdp")) return true;
      var p = String(global.location && global.location.pathname || "").toLowerCase();
      if (/\/product-p\/tmh-|mahjong/.test(p) && isProductPdp()) return true;
    } catch (eTmh) {}
    return false;
  }

  function isSoftGoodsPdpPage() {
    return isBeanBagPdpPage() || isSaranoniPdpPage() || isCordaroysExtendedPdpPage();
  }

  function isGameRoomBarPdpPage() {
    if (!isProductPdp()) return false;
    try {
      if (global.document.body && global.document.body.classList.contains("mc-game-room-bar-pdp")) {
        return true;
      }
      var path = String((global.location && global.location.pathname) || "").toLowerCase();
      if (/\/product-p\/(?:garcia-bar|[\w-]*home-bar[\w-]*|[\w-]*-bar(?:-|\.)|[\w-]*bar-unit)/.test(path)) {
        return true;
      }
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || global.global_Current_ProductCode || "").trim().toUpperCase();
      if (/(?:^|-)BAR(?:-|$)/.test(pc) || /HOME-BAR|BAR-UNIT|BAR-CABINET/.test(pc)) return true;
      var ids = typeof parseBreadCrumbCategoryIds === "function" ? parseBreadCrumbCategoryIds() : [];
      var i;
      for (i = 0; i < ids.length; i++) {
        if (String(ids[i]) === "194") {
          if (/BAR|HOME.?BAR|WINE.?CABINET/i.test(pc) || /bar|home-bar|wine/i.test(path)) return true;
        }
      }
      if (
        global.document.querySelector(
          '#v65-product-parent a[href*="/category-s/194"], #content_area a[href*="/category-s/194"], a[href*="cat=194"]'
        )
      ) {
        if (/BAR|HOME.?BAR|WINE.?CABINET/i.test(pc) || /bar|home-bar|wine/i.test(path)) return true;
      }
    } catch (eGr) {}
    return false;
  }

  function markGameRoomBarPdpPage() {
    if (!isGameRoomBarPdpPage()) return;
    try {
      if (global.document.body) {
        global.document.body.classList.add(
          "mc-game-room-bar-pdp",
          "mc-steve-silver-altview-pdp",
          "mc-pdp-accordion-pdp",
          "mc-pdp-unified-ready"
        );
      }
      applySteveSilverBarSetFrame();
      try { ensureSaranoniPdpAccordion(); } catch (eAccGr) {}
    } catch (eMarkGr) {}
  }

  function isSteveSilverPdpPage() {
    try {
      if (
        global.document.body &&
        global.document.body.classList.contains("mc-steve-silver-altview-pdp")
      ) {
        return true;
      }
      if (typeof isCloseoutPdpPage === "function" && isCloseoutPdpPage()) return true;
      var pathSs = String((global.location && global.location.pathname) || "").toLowerCase();
      if (/\/product-p\/(?:tyler-bar-set|[\w-]*-bar-set|[\w-]*-dining-set|[\w-]*-patio-set)\.htm/.test(pathSs)) return true;
      var pcEarly = String(global.global_Current_ProductCode || "").trim().toUpperCase();
      if (/^SS-/.test(pcEarly)) return true;
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || "").trim().toUpperCase();
      return /^SS-/.test(pc);
    } catch (eSs) {}
    return false;
  }

  function isCloseoutPdpPage() {
    if (!isProductPdp()) return false;
    try {
      if (global.document.body && global.document.body.classList.contains("mc-closeout-pdp")) {
        return true;
      }
      var closeoutSlugPattern =
        /\/product-p\/(?:adeline-patio-set|burlington-dining-set|canova-dining-set|delilah-patio-chairs|grayson-dining-set|molly-olson-dining-set|ramona-dining-set|sapphire-sleep-cal-king|tamara-outdoor-sectional|tyler-bar-set|wyatt-chofa)\.htm/i;
      if (closeoutSlugPattern.test(String(global.location.pathname || ""))) return true;
      var closeoutCodePattern =
        /^(?:ADELINE-PATIO-SET|BURLINGTON-DINING-SET|CANOVA-DINING-SET|DELILAH-PATIO-CHAIRS|GRAYSON-DINING-SET|MOLLY-OLSON-DINING-SET|RAMONA-DINING-SET|SAPPHIRE-SLEEP-CAL-KING|TAMARA-OUTDOOR-SECTIONAL|TYLER-BAR-SET|WYATT-CHOFA)$/i;
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || global.global_Current_ProductCode || "").trim();
      if (closeoutCodePattern.test(pc)) return true;
      var ids = parseBreadCrumbCategoryIds();
      var i;
      for (i = 0; i < ids.length; i++) {
        if (String(ids[i]) === "181") return true;
      }
      if (
        global.document.querySelector(
          '#v65-product-parent a[href*="/category-s/181"], #content_area a[href*="/category-s/181"], a[href*="cat=181"]'
        )
      ) {
        return true;
      }
      if (typeof global.mcResolvePdpReturnCategory === "function") {
        var cat = global.mcResolvePdpReturnCategory();
        if (
          cat &&
          (/\/category-s\/181\.htm/i.test(String(cat.href || "")) || /closeout/i.test(String(cat.name || "")))
        ) {
          return true;
        }
      }
      var ret = global.document.querySelector(".mc-pdp-return-link, #mc-pdp-return-link-static a");
      if (ret && /closeout/i.test(String(ret.textContent || ""))) return true;
    } catch (eCo) {}
    return false;
  }

  
  function applySteveSilverBarSetFrame() {
    if (!global.matchMedia || !global.matchMedia("(min-width: 992px)").matches) return;
    if (!(isSteveSilverPdpPage() || isCloseoutPdpPage() || (typeof isGameRoomBarPdpPage === "function" && isGameRoomBarPdpPage()))) return;
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-steve-silver-altview-pdp", "mc-pdp-unified-ready", "mc-pdp-accordion-pdp");
        if (isCloseoutPdpPage()) global.document.body.classList.add("mc-closeout-pdp");
      }
      var parent = global.document.getElementById("v65-product-parent");
      var row = global.document.querySelector(
        "#v65-product-parent tr.mc-unified-pdp-row, #v65-product-parent tr.mc-pdp-main-row"
      );
      if (parent) {
        parent.style.setProperty("width", "1128px", "important");
        parent.style.setProperty("max-width", "1128px", "important");
        parent.style.setProperty("margin-left", "auto", "important");
        parent.style.setProperty("margin-right", "auto", "important");
        parent.style.setProperty("left", "0", "important");
      }
      if (row) {
        row.style.setProperty("width", "1128px", "important");
        row.style.setProperty("max-width", "1128px", "important");
        row.style.setProperty("display", "flex", "important");
        row.style.setProperty("flex-wrap", "nowrap", "important");
        row.style.setProperty("align-items", "flex-start", "important");
        row.style.setProperty("justify-content", "flex-start", "important");
        row.style.setProperty("gap", "28px", "important");
        var media = row.querySelector("td.mc-unified-pdp-media, td.mc-pdp-media-td");
        var info = row.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td");
        if (media) {
          media.style.setProperty("flex", "0 0 690px", "important");
          media.style.setProperty("width", "690px", "important");
          media.style.setProperty("min-width", "690px", "important");
          media.style.setProperty("max-width", "690px", "important");
        }
        if (info) {
          info.style.setProperty("flex", "0 0 410px", "important");
          info.style.setProperty("width", "410px", "important");
          info.style.setProperty("max-width", "410px", "important");
          info.style.setProperty("vertical-align", "top", "important");
          info.style.setProperty("padding-top", "0", "important");
        }
      }
      try { ensureSaranoniPdpAccordion(); } catch (eA) {}
    } catch (eF) {}
  }

  function alignSaranoniInfoToHeroTop() {
    if (!isSaranoniPdpPage()) return;
    try {
      var row = global.document.querySelector(
        "#v65-product-parent tr.mc-unified-pdp-row, #v65-product-parent tr.mc-pdp-main-row"
      );
      if (row) row.style.setProperty("align-items", "flex-start", "important");
      var info = global.document.querySelector(
        "#v65-product-parent td.mc-unified-pdp-info, #v65-product-parent td.mc-pdp-options-td"
      );
      if (info) {
        info.style.setProperty("vertical-align", "top", "important");
        info.style.setProperty("padding-top", "0", "important");
        info.style.setProperty("margin-top", "0", "important");
      }
      var logo = global.document.querySelector(
        "#v65-product-parent img.vCSS_img_mfg_logo, #mc-pdp-brand-logo"
      );
      if (logo) {
        logo.style.setProperty("margin-top", "0", "important");
        logo.style.setProperty("padding-top", "0", "important");
      }
    } catch (eAl) {}
  }

  function markCloseoutPdpPage() {
    if (!isCloseoutPdpPage()) return;
    try {
      if (global.document.body) {
        global.document.body.classList.add("mc-closeout-pdp", "mc-steve-silver-altview-pdp", "mc-pdp-accordion-pdp", "mc-pdp-unified-ready");
      }
      applySteveSilverBarSetFrame();
      try { ensureSaranoniPdpAccordion(); } catch (eAcc0) {}
    } catch (eMarkCo) {}
  }

  function injectPdpTopGapCss() {
    if (!isProductPdp()) return;
    if (global.document.getElementById("mc-pdp-top-gap-css")) return;
    var st = global.document.createElement("style");
    st.id = "mc-pdp-top-gap-css";
    st.textContent =
      "@media (min-width:992px){" +
      "body.productdetails:has(#v65-product-parent) .container--content," +
      "body.productdetails:has(#v65-product-parent) .content_area-wrapper," +
      "body.mc-product-page:has(#v65-product-parent) .container--content," +
      "body.mc-product-page:has(#v65-product-parent) .content_area-wrapper{" +
      "margin-top:-72px!important;padding-top:0!important}" +
      "body.productdetails:has(#v65-product-parent) #content_area," +
      "body.mc-product-page:has(#v65-product-parent) #content_area{" +
      "padding-top:0!important;margin-top:0!important}" +
      "body.productdetails:has(#v65-product-parent) .container--content>.row," +
      "body.mc-product-page:has(#v65-product-parent) .container--content>.row{" +
      "padding-top:0!important;margin-top:0!important}}";
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function isNestedAtcInfoCell(node) {
    if (!node || !node.classList) return false;
    if (node.classList.contains("vol-product__top--right") || node.classList.contains("mc-unified-pdp-info")) {
      return false;
    }
    if (node.classList.contains("mc-atc-row")) return true;
    try {
      if (node.id === "v65-productdetail-action-wrapper") return true;
      if (node.closest && node.closest("#v65-productdetail-action-wrapper")) return true;
    } catch (eNest) {}
    return false;
  }

  function findVolProductRightColumn() {
    return (
      global.document.querySelector(
        "#v65-product-parent td.vol-product__top--right, #content_area td.vol-product__top--right, td.vol-product__top--right"
      ) ||
      global.document.querySelector(
        "#v65-product-parent .vol-product__top--right, #content_area .vol-product__top--right, .vol-product__top--right"
      )
    );
  }

  function findPdpHeroColumnTd() {
    var td = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td, #v65-product-parent td.mc-unified-pdp-info");
    if (td) return td;
    /* Closeout / legacy Volusion PDPs use Bootstrap right column, not unified TDs. */
    var right =
      global.document.querySelector(
        "#v65-product-parent .vol-product__top--right, #content_area .vol-product__top--right, .vol-product__top--right"
      );
    if (right) return right;
    var seeds = [
      global.document.getElementById("mc-pdp-title-right"),
      global.document.getElementById("mc-pdp-price-stack-host"),
      global.document.getElementById("messaging-element"),
      global.document.querySelector("#v65-product-parent .colors_pricebox"),
    ];
    var si;
    for (si = 0; si < seeds.length; si++) {
      var walk = seeds[si];
      while (walk && walk !== global.document.body) {
        if (walk.tagName === "TD") return walk;
        if (
          walk.classList &&
          (walk.classList.contains("vol-product__top--right") ||
            walk.classList.contains("mc-unified-pdp-info") ||
            walk.classList.contains("mc-pdp-options-td"))
        ) {
          return walk;
        }
        walk = walk.parentNode;
      }
    }
    return null;
  }

  function findPdpHeroInsertParent() {
    var td = findPdpHeroColumnTd();
    if (td) return td;
    var anchor = global.document.getElementById("messaging-element");
    if (anchor && anchor.parentNode) return anchor.parentNode;
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (box && box.parentNode) return box.parentNode;
    return null;
  }

  function findPdpHeroInsertAfter(parent) {
    if (!parent) return null;
    if (isSaranoniPdpPage()) {
      var sarSize = global.document.getElementById("mc-saranoni-size-thumbs");
      if (sarSize && parent.contains(sarSize)) return sarSize;
      var sarColor = global.document.getElementById("mc-configured-color-swatch-wrapper");
      if (sarColor && parent.contains(sarColor)) return sarColor;
      var sarPrice = global.document.getElementById("mc-pdp-price-stack-host");
      if (sarPrice && parent.contains(sarPrice)) return sarPrice;
    }
    if (isBeanBagPdpPage()) {
      var bbCover = global.document.getElementById("beanbag-swatch-wrapper");
      if (bbCover && parent.contains(bbCover)) return bbCover;
      var bbSize = global.document.getElementById("mc-bb-size-section");
      if (bbSize && parent.contains(bbSize)) return bbSize;
    }
    var bnpl = global.document.getElementById("messaging-element");
    if (bnpl && parent.contains(bnpl)) return bnpl;
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    if (price && parent.contains(price)) return price;
    var box = parent.querySelector ? parent.querySelector(".colors_pricebox") : null;
    if (!box && parent.classList && parent.classList.contains("colors_pricebox")) box = parent;
    if (box && parent.contains(box)) return box;
    return null;
  }

  function insertPdpHeroNodeAfter(parent, after, node) {
    if (!parent || !node) return;
    try {
      if (after && after.parentNode === parent) {
        if (after.nextSibling) parent.insertBefore(node, after.nextSibling);
        else parent.appendChild(node);
      } else {
        parent.appendChild(node);
      }
    } catch (eIns) {}
  }

  function extractDescriptionFeaturesHtml() {
    var sel =
      "#ProductDetail_ProductDetails_div2 span[itemprop='description'], #ProductDetail_ProductDetails_div2 .colors_descriptionbox, #content_area span[itemprop='description']";
    if (isBeanBagPdpPage()) {
      sel +=
        ", #mc-pdp-description-below-features #product_description, #ProductDetail_ProductDetails_div span[itemprop='description'], #product_description";
    }
    var src = global.document.querySelector(sel);
    if (!src) return "";
    var items = [];
    src.querySelectorAll("li").forEach(function (li) {
      if (li.closest("#beanbag-swatch-wrapper, .beanbag-swatches, script, style, #mc-pdp-features")) return;
      if (li.querySelector("ul, ol")) return;
      var t = normalizeFeatureText(li.textContent || "");
      if (t) items.push("<li>" + escapeHtmlText(t) + "</li>");
    });
    if (!items.length) return "";
    return buildFeaturesListHtml(items);
  }

  /* MC_MOLLY_OLSON_FEATURES_FIX_20260721 — Volusion's native TechSpecs field
     for this product has malformed <li> boundaries baked directly into its
     HTML: one sentence is split mid-word across two bullets ("...engineered"
     / "woods, metal...") and four unrelated feature statements are merged
     into a single bullet. extractTechSpecsBodyHtml() faithfully copies
     whatever <li> markup Volusion serves, so this can only be corrected by
     editing the admin content itself or overriding it here -- same content,
     properly split. */
  function getMollyOlsonCorrectedFeaturesHtml() {
    var items = [
      "Premium Construction: Table and chairs are crafted from solid Asian hardwoods, engineered woods, metal, and supportive foam for enduring strength and long-term reliability. Styling details include weighty tabletop design, architectural cross “timber-beam” pedestal base and wood framed, upholstered side chairs for extra comfort.",
      "Elegant Tabletop that delivers the luxurious look of stone while offering a durable, stain-resistant, and easy-to-clean surface ideal for everyday dining.",
      "Hand-stained Finishes: the table is finished in a natural multi-step washed grey oak finish stain to highlight the wood’s beautiful grain and natural knots.",
      "Sleek fabric Side Chairs offer a comfortable and stylish accent to the 48-inch round top dining table top in a collection that will add a touch of class to any dining area. The Side Chairs are available in khaki fabric and feature iron legs.",
      "Reliable Support: Each chair provides a 275-lb weight capacity, ensuring strength and comfort for everyday use.",
      "Easy Care Upholstery (Code W): Clean using mild soap and water; gently blot stains, avoid over-wetting, rinse lightly, and allow upholstery to air dry fully.",
      "Product Measurements: Table: 48 x 48 x 30 in Chair: 20 x 22 x 35 in"
    ];
    return buildFeaturesListHtml(
      items.map(function (t) {
        return "<li>" + escapeHtmlText(t) + "</li>";
      })
    );
  }

  function mountPdpFeaturesBlock() {
    if (!isProductPdp()) return;
    var bodyHtml =
      resolveSoftGoodsProductCode() === "MOLLY-OLSON-DINING-SET"
        ? getMollyOlsonCorrectedFeaturesHtml()
        : extractTechSpecsBodyHtml();
    if (!bodyHtml && isMahjongHousePdpPage()) {
      bodyHtml = getMahjongOfficialFeaturesHtml(getMahjongProductCode());
    }
    if (!bodyHtml) bodyHtml = extractDescriptionFeaturesHtml();
    if (!bodyHtml && /^MHH-/i.test(resolveSoftGoodsProductCode())) {
      bodyHtml = getCordaroysMattressFallbackContent().featuresHtml;
    }
    var block = global.document.getElementById("mc-pdp-features");
    if (!bodyHtml) {
      if (isCordaroysBrandPdpPage()) {
        try { ensureBeanBagPdpAccordion(); } catch (eBbFeatEmpty) {}
        return;
      }
      if (block) {
        try {
          block.style.setProperty("display", "none", "important");
        } catch (eHide) {}
      }
      return;
    }
    if (!block) {
      block = global.document.createElement("div");
      block.id = "mc-pdp-features";
      block.className = "mc-pdp-features";
    }
    var featuresSig = bodyHtml;
    if (block.getAttribute("data-mc-features-sig") !== featuresSig) {
      block.innerHTML =
        '<div class="mc-pdp-features__heading">Features:</div>' +
        '<div class="mc-pdp-features__body">' +
        bodyHtml +
        "</div>";
      block.setAttribute("data-mc-features-sig", featuresSig);
    }
    try {
      block.style.removeProperty("display");
    } catch (eShow) {}
    /* Never yank #mc-pdp-features out of the FEATURES accordion once mounted. */
    if (block.closest && block.closest("#mc-pdp-accordion")) {
      pruneDescriptionDuplicateFeatures();
      hideNativeVolusionTabPanels();
      if (isUnifiedAccordionPdp()) {
        try {
          ensureSaranoniPdpAccordion();
          ensureFeaturesInsideAccordion();
          ensurePdpAccordionVisible();
        } catch (eAccKeep) {}
      }
      return;
    }
    /* Bean Bag features are owned by their existing accordion once it exists.
       Do not reinsert that node as a loose sibling on a later PDP pass. */
    if (isCordaroysBrandPdpPage() && global.document.getElementById("mc-pdp-accordion")) {
      ensureBeanBagPdpAccordion();
      return;
    }
    var insertParent = findPdpHeroInsertParent();
    var insertAfter = findPdpHeroInsertAfter(insertParent);
    if (!insertParent) return;
    if (isPdpLayoutMounted()) {
      pruneDescriptionDuplicateFeatures();
      if (block && insertParent && !insertParent.contains(block)) {
        insertPdpHeroNodeAfter(insertParent, insertAfter, block);
      } else if (isBeanBagPdpPage() && block && insertParent && insertParent.contains(block)) {
        var bbFeatAnchor = findPdpHeroInsertAfter(insertParent);
        if (bbFeatAnchor && block.previousElementSibling !== bbFeatAnchor) {
          insertPdpHeroNodeAfter(insertParent, bbFeatAnchor, block);
        }
      }
      if (isSaranoniPdpPage()) {
        hideSaranoniHeroAltviews();
        ensureSaranoniVariantUi();
        finalizeSaranoniInfoColumnOrder();
      } else if (isMahjongHousePdpPage()) {
        applyMahjongHouseInfoColumnOrder(findPdpHeroColumnTd());
      }
      hideNativeVolusionTabPanels();
      if (isUnifiedAccordionPdp()) {
        try {
          mountDescriptionBelowFeatures();
          ensureSaranoniPdpAccordion();
          ensurePdpAccordionVisible();
        } catch (eGenAccMount) {}
      }
      return;
    }
    if (block.parentNode !== insertParent || (insertAfter && block.previousElementSibling !== insertAfter)) {
      insertPdpHeroNodeAfter(insertParent, insertAfter, block);
    }
    if (isBeanBagPdpPage() && block && insertParent && insertParent.contains(block)) {
      var bbAnchor = findPdpHeroInsertAfter(insertParent);
      if (bbAnchor && block.previousElementSibling !== bbAnchor) {
        insertPdpHeroNodeAfter(insertParent, bbAnchor, block);
      }
    }
    pruneDescriptionDuplicateFeatures();
    if (isSaranoniPdpPage()) {
      hideSaranoniHeroAltviews();
      finalizeSaranoniInfoColumnOrder();
    } else if (isMahjongHousePdpPage()) {
      applyMahjongHouseInfoColumnOrder(findPdpHeroColumnTd());
    }
    hideNativeVolusionTabPanels();
  }

  function normalizeConfiguredColorLabel(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
  }

  function escapeRegexLiteral(str) {
    return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function parseProductCodeFromSelectName(name) {
    var m = String(name || "").match(/^select___(.+?)___\d+$/i);
    return m ? String(m[1] || "").toUpperCase() : "";
  }

  function resolveConfiguredColorProductCode(ctx) {
    var fromPage = resolveSoftGoodsProductCode();
    if (fromPage) return fromPage;
    if (ctx && ctx.productCode) return String(ctx.productCode).trim().toUpperCase();
    return "";
  }

  function configuredColorImageBelongsToProduct(src, productCode) {
    if (!src || !productCode) return false;
    var hay = String(src).toUpperCase();
    var pc = String(productCode).trim().toUpperCase();
    if (hay.indexOf(pc) !== -1) return true;
    return hay.indexOf(pc.replace(/-/g, "%2D")) !== -1;
  }

  function isSaranoniBadHeroSrc(src) {
    var s = String(src || "");
    if (!s) return true;
    if (/nophoto\.gif/i.test(s)) return true;
    if (/\/manufacturers\//i.test(s)) return true;
    return false;
  }

  function saranoniPhotoFileName(src) {
    return String(src || "")
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .pop() || "";
  }

  /* Color-option files look like CODE-1096-T.jpg. Numbered gallery files are
     CODE-1.jpg / CODE-2T.jpg. Prefer -1/-1T as the default hero; -2/-2T are
     secondary closeups and must not replace the lifestyle shot on load. */
  function isSaranoniColorOptionPhotoFile(file) {
    return /-\d{3,}-[TS]\.(jpg|jpeg|png|webp)$/i.test(String(file || ""));
  }

  function isSaranoniSecondaryNumberedPhoto(src) {
    var file = saranoniPhotoFileName(src);
    if (!file || isSaranoniColorOptionPhotoFile(file)) return false;
    return /-[2-9]\d*T?\.(jpg|jpeg|png|webp)$/i.test(file);
  }

  function configuredColorImageMatchesOption(src, productCode, optionId, label) {
    if (!configuredColorImageBelongsToProduct(src, productCode)) return false;
    var id = String(optionId || "").trim();
    var lab = String(label || "")
      .split(/[:(]/)[0]
      .replace(/\s+/g, " ")
      .trim();
    var slug = lab.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    var hay = String(src || "");
    if (id && new RegExp("(^|[^0-9A-Za-z])" + escapeRegexLiteral(id) + "([^0-9A-Za-z]|$)", "i").test(hay)) {
      return true;
    }
    if (slug && new RegExp("(^|[^0-9A-Za-z])" + escapeRegexLiteral(slug) + "([^0-9A-Za-z]|$)", "i").test(hay)) {
      return true;
    }
    if (!id && !slug) return true;
    return false;
  }

  function saranoniLabelSlug(label) {
    return String(label || "")
      .split(/[:(]/)[0]
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildDataDrivenSaranoniEntries(select, productCode) {
    if (!select || !select.options || !productCode) return [];
    var out = [];
    var seen = {};
    var i;
    for (i = 0; i < select.options.length; i++) {
      var opt = select.options[i];
      var val = String(opt.value || "").trim();
      if (!val) continue;
      var text = String(opt.text || "").replace(/\s+/g, " ").trim();
      if (!text || /^(--|please\b|select\b|choose\b)/i.test(text)) continue;
      if (seen[val]) continue;
      seen[val] = true;
      var slug = saranoniLabelSlug(text);
      /* Prefer label slug files when present (Bear-S / Elephant-S). Numeric
         optionIds often point at missing/tiny CDN stubs (1536-S 404). */
      var swatchImage =
        slug && slug.toLowerCase() !== val.toLowerCase()
          ? productCode + "-" + slug + "-S.jpg"
          : productCode + "-" + val + "-S.jpg";
      var mainImage =
        slug && slug.toLowerCase() !== val.toLowerCase()
          ? productCode + "-" + slug + "-T.jpg"
          : productCode + "-" + val + "-T.jpg";
      out.push({
        optionId: val,
        label: text,
        labelSlug: slug,
        swatchImage: swatchImage,
        mainImage: mainImage,
        swatchImageAlt: productCode + "-" + val + "-S.jpg",
        mainImageAlt: productCode + "-" + val + "-T.jpg",
      });
    }
    return out;
  }

  function isConfiguredProductDefaultHero(src, productCode) {
    if (!configuredColorImageBelongsToProduct(src, productCode)) return false;
    var pc = String(productCode || "")
      .trim()
      .toUpperCase()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(pc + "-\\dT\\.(jpg|jpeg|png|webp)", "i").test(String(src));
  }

  function resetConfiguredColorStateForProduct(productCode) {
    var pc = String(productCode || "").trim().toUpperCase();
    if (!pc) return;
    var prev = "";
    try {
      prev = String(global.__MC_CONFIGURED_COLOR_PRODUCT__ || "").trim().toUpperCase();
    } catch (ePrevPc) {}
    if (prev && prev === pc) return;
    configuredColorActiveEntry = null;
    configuredColorActiveSrc = "";
    configuredColorDefaultSrc = "";
    configuredColorLastAppliedOptionId = "";
    configuredColorEnforceUntil = 0;
    try {
      delete global.__MC_CONFIGURED_COLOR_ACTIVE_OPTION_ID__;
      global.__MC_CONFIGURED_COLOR_INIT__ = false;
    } catch (eResetGlobal) {}
    global.__MC_CONFIGURED_COLOR_PRODUCT__ = pc;
  }

  function buildProductScopedColorImageCandidates(productCode, fileName) {
    if (!productCode || !fileName) return [];
    var pc = String(productCode).trim().toUpperCase();
    var base = String(fileName).trim();
    if (
      base.toUpperCase().indexOf(pc) === -1 &&
      base.toUpperCase().indexOf(pc.replace(/-/g, "_")) === -1
    ) {
      return [];
    }
    return buildConfiguredColorImageCandidates(base, pc).filter(function (url) {
      return configuredColorImageBelongsToProduct(url, pc);
    });
  }

  function loadProductScopedColorImage(productCode, fileName, done) {
    loadConfiguredColorImage(
      buildProductScopedColorImageCandidates(productCode, fileName),
      function (resolved) {
        if (resolved && configuredColorImageBelongsToProduct(resolved, productCode)) {
          done(resolved);
          return;
        }
        done("");
      }
    );
  }

  function bindConfiguredColorHeroGuard(productCode) {
    var pc = String(productCode || "").trim().toUpperCase();
    if (!pc) return;
    var img = global.document.getElementById("product_photo");
    if (!img || img.__mcConfiguredColorHeroGuard) return;
    img.__mcConfiguredColorHeroGuard = true;
    try {
      new global.MutationObserver(function () {
        if (!isSaranoniPdpPage()) return;
        var cur = img.getAttribute("src") || "";
        var altOverride = "";
        try {
          altOverride = String(global.__MC_PDP_ALT_VIEW_ACTIVE_SRC__ || "");
        } catch (eAltOverride) {}
        if (altOverride && cur === altOverride && configuredColorImageBelongsToProduct(cur, pc)) return;
        if (isSaranoniBadHeroSrc(cur)) return;
        if (configuredColorActiveSrc && cur === configuredColorActiveSrc) return;
        if (configuredColorImageBelongsToProduct(cur, pc)) return;
        if (configuredColorActiveSrc) {
          setConfiguredColorPhotoSrc(
            configuredColorActiveSrc,
            configuredColorActiveEntry ? configuredColorActiveEntry.label : "",
            pc
          );
          return;
        }
        var ctx = findConfiguredColorSwatchContext();
        var entry = ctx ? findConfiguredColorSelectedEntry(ctx) : null;
        if (entry && entry.mainImage) {
          loadProductScopedColorImage(pc, entry.mainImage, function (resolved) {
            if (resolved) setConfiguredColorPhotoSrc(resolved, entry.label, pc);
          });
        }
      }).observe(img, { attributes: true, attributeFilter: ["src"] });
    } catch (eHeroGuard) {}
  }

  function optionMatchesConfiguredColorEntry(opt, entry) {
    if (!opt || !entry) return false;
    var val = String(opt.value || "");
    if (val === entry.optionId) return true;
    if (
      val &&
      new RegExp("(^|\\D)" + escapeRegexLiteral(entry.optionId) + "(\\D|$)").test(val)
    ) {
      return true;
    }
    return normalizeConfiguredColorLabel(opt.text) === normalizeConfiguredColorLabel(entry.label);
  }

  function findConfiguredColorOption(select, entry) {
    if (!select || !select.options || !entry) return null;
    var i;
    for (i = 0; i < select.options.length; i++) {
      if (optionMatchesConfiguredColorEntry(select.options[i], entry)) return select.options[i];
    }
    return null;
  }

  // Saranoni shares color option-category (23) and size option-category (58).
  // Products not in PDP_CONFIGURED_COLOR_SWATCHS get swatches built from their
  // native options + the verified filename convention below.
  var SARANONI_COLOR_OPTION_CATEGORY = "23";
  var SARANONI_SIZE_OPTION_CATEGORY = "58";
  var SARANONI_VARIANT_LABEL_PATTERNS =
    /(choose\s+color|selected\s+color|color\s*\*|^color$|cover\s+color|select\s+style|choose\s+style|^style$|choose\s+size|selected\s+size|size\s*\*|^size$)/;
  var SARANONI_SWATCH_PROBE_DIRS = [
    "/v/vspfiles/swatches/saranoni/",
    "/v/vspfiles/swatches/lush/",
    "/v/vspfiles/swatches/luxe/",
    "/v/vspfiles/swatches/blankets/",
    "/v/vspfiles/images/saranoni/",
    "/v/vspfiles/photos/",
  ];

  function saranoniColorSlug(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildSaranoniSwatchCandidates(productCode, optionId, label) {
    var slug = saranoniColorSlug(label);
    var fileNames = [];
    if (productCode && optionId) {
      fileNames.push(productCode + "-" + optionId + "-S.jpg");
      fileNames.push(productCode + "-" + optionId + "-T.jpg");
      fileNames.push(productCode + "-" + optionId + "S.jpg");
      fileNames.push(productCode + "-" + optionId + "T.jpg");
      fileNames.push(productCode + "_" + optionId + ".jpg");
      fileNames.push(productCode + "_" + optionId + "S.jpg");
      fileNames.push("options/" + productCode + "-" + optionId + "-S.jpg");
      fileNames.push("options/" + optionId + "-S.jpg");
    }
    if (slug) {
      fileNames.push("saranoni-" + slug + ".jpg");
      fileNames.push("SAR-" + slug + "-S.jpg");
      fileNames.push(slug + "-S.jpg");
    }
    var out = [];
    var fi;
    for (fi = 0; fi < fileNames.length; fi++) {
      var built = buildConfiguredColorImageCandidates(fileNames[fi]);
      var bi;
      for (bi = 0; bi < built.length; bi++) {
        if (built[bi] && out.indexOf(built[bi]) === -1) out.push(built[bi]);
      }
    }
    if (slug) {
      var storeFolder = "";
      try {
        storeFolder = String(
          global.global_Config_StoreFolderName || global.Config_StoreFolderName || ""
        ).trim();
      } catch (eStore) {}
      var dirPrefixes = SARANONI_SWATCH_PROBE_DIRS.slice();
      if (storeFolder) {
        dirPrefixes.unshift(storeFolder.replace(/\/?$/, "/") + "v/vspfiles/swatches/saranoni/");
        dirPrefixes.unshift(storeFolder.replace(/\/?$/, "/") + "v/vspfiles/photos/");
      }
      var di;
      for (di = 0; di < dirPrefixes.length; di++) {
        var prefix = dirPrefixes[di];
        var path = prefix + slug + ".jpg";
        if (path.indexOf("//") === 0) path = "https:" + path;
        if (path.indexOf("/") === 0) path = path;
        if (out.indexOf(path) === -1) out.push(path);
        path = prefix + slug + ".png";
        if (path.indexOf("//") === 0) path = "https:" + path;
        if (out.indexOf(path) === -1) out.push(path);
      }
    }
    return out;
  }

  function saranoniOptionLabelHaystack(select) {
    if (!select) return "";
    try {
      var row = select.closest ? select.closest("tr") : null;
      /* Volusion puts "Select Style" in a prior table-row; the select's own tr only
         has option values. Include the parent options table so Style/Color labels match. */
      var table = select.closest ? select.closest("table") : null;
      return String(
        (select.getAttribute("title") || "") +
          " " +
          (row ? row.textContent : "") +
          " " +
          (table ? table.textContent : "") +
          " " +
          (select.options[0] && select.options[0].text ? select.options[0].text : "")
      ).toLowerCase();
    } catch (eLbl) {
      return "";
    }
  }

  function saranoniOptionLabelsLookLikeSizes(select) {
    if (!select || !select.options) return false;
    var sizeRe =
      /^(mini|receiving|toddler|xl|xs|s|m|l|large|small|medium|crib|king|queen|twin|throw|adult|one\s*size)\b/i;
    var hits = 0;
    var n = 0;
    var i;
    for (i = 0; i < select.options.length; i++) {
      var t = String(select.options[i].text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || /^(--|please\b|select\b|choose\b|size\b|color\b|style\b)/i.test(t)) continue;
      n += 1;
      var name = t.split(/[:(]/)[0].replace(/\s+/g, " ").trim();
      if (sizeRe.test(name)) hits += 1;
    }
    return n > 0 && hits >= Math.ceil(n / 2);
  }

  function saranoniOptionLabelsLookLikeStyles(select) {
    if (!select || !select.options) return false;
    var styleRe =
      /^(bear|elephant|puppy|bunny|rabbit|fox|unicorn|dinosaur|giraffe|lion|tiger|deer|owl|lamb|sheep|cat|dog|moose|penguin|duck|chick)\b/i;
    var hits = 0;
    var n = 0;
    var i;
    for (i = 0; i < select.options.length; i++) {
      var t = String(select.options[i].text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || /^(--|please\b|select\b|choose\b|size\b|color\b|style\b)/i.test(t)) continue;
      n += 1;
      var name = t.split(/[:(]/)[0].replace(/\s+/g, " ").trim();
      if (styleRe.test(name)) hits += 1;
    }
    return n > 0 && hits >= Math.ceil(n / 2);
  }

  function isSaranoniColorSelect(select) {
    if (!select || !select.name) return false;
    if (select.classList && select.classList.contains("mc-native-leather")) return false;
    if (!/^SAR/i.test(parseProductCodeFromSelectName(select.name))) return false;
    /* Style options mislabeled "Size" in Volusion (Bear/Elephant/Puppy rockers). */
    if (saranoniOptionLabelsLookLikeStyles(select)) return true;
    if (parseOptionCategoryFromSelectName(select.name) === SARANONI_COLOR_OPTION_CATEGORY) return true;
    var labelHay = saranoniOptionLabelHaystack(select);
    /* Select Style (Bear/Bunny/etc. on Stuffed Animal Loveys) is this product's only
       option axis — treat it like color so the horizontal swatch rail builds. */
    return /(choose\s+color|selected\s+color|color\s*\*|^color$|cover\s+color|select\s+style|choose\s+style|^style$)/.test(labelHay);
  }

  function isSaranoniSizeSelect(select) {
    if (!select || !select.name) return false;
    if (select.classList && select.classList.contains("mc-native-leather")) return false;
    if (!/^SAR/i.test(parseProductCodeFromSelectName(select.name))) return false;
    /* Never treat animal/style options as Size — even if Volusion labels the
       option "Size" (Stuffed Animal Rockers). */
    if (saranoniOptionLabelsLookLikeStyles(select)) return false;
    if (!saranoniOptionLabelsLookLikeSizes(select)) return false;
    if (parseOptionCategoryFromSelectName(select.name) === SARANONI_SIZE_OPTION_CATEGORY) return true;
    var labelHay = "";
    try {
      var row = select.closest ? select.closest("tr") : null;
      labelHay = String(
        (select.getAttribute("title") || "") +
          " " +
          (row ? row.textContent : "") +
          " " +
          (select.options[0] && select.options[0].text ? select.options[0].text : "")
      ).toLowerCase();
    } catch (eLbl) {}
    return /(choose\s+size|selected\s+size|size\s*\*|^size$)/.test(labelHay);
  }

  function getConfiguredVariantAxis(ctx) {
    return ctx && ctx.variantAxis === "size" ? "size" : "color";
  }

  function configuredVariantChooseLabel(ctx, isSar) {
    if (getConfiguredVariantAxis(ctx) === "size") {
      return isSar ? "Choose size: " : "Selected size: ";
    }
    return isSar ? "Selected color: " : "Selected color: ";
  }

  function configuredVariantPickerHeading(ctx) {
    if (getConfiguredVariantAxis(ctx) === "size") {
      return "Selected size: ";
    }
    return "Selected color: ";
  }

  function configuredVariantPickerPlaceholder(ctx) {
    return getConfiguredVariantAxis(ctx) === "size" ? "Choose a size" : "Choose a color";
  }

  function buildConfiguredColorThumbCandidates(entry, productCode) {
    var out = buildProductScopedColorImageCandidates(productCode, entry.swatchImage);
    if (entry.swatchImageAlt) {
      buildProductScopedColorImageCandidates(productCode, entry.swatchImageAlt).forEach(function (candidate) {
        if (candidate && out.indexOf(candidate) === -1) out.push(candidate);
      });
    }
    // Saranoni swatches use per-option -S files; do not reuse hero (-T) images in the rail
    // unless the -S stub is missing (rocker numeric optionIds).
    if (!/^SAR/i.test(String(productCode || "")) || !out.length) {
      buildProductScopedColorImageCandidates(productCode, entry.mainImage).forEach(function (candidate) {
        if (candidate && out.indexOf(candidate) === -1) out.push(candidate);
      });
      if (entry.mainImageAlt) {
        buildProductScopedColorImageCandidates(productCode, entry.mainImageAlt).forEach(function (candidate) {
          if (candidate && out.indexOf(candidate) === -1) out.push(candidate);
        });
      }
    }
    return out;
  }

  function normalizeConfiguredColorAssetUrl(url) {
    return String(url || "")
      .replace(/\?.*$/, "")
      .split("#")[0]
      .toLowerCase();
  }

  function findConfiguredColorSwatchContext() {
    // Bean bag PDPs have their own native swatch system (#beanbag-swatch-wrapper);
    // never let the configured-color swatches take over those pages.
    if (isBeanBagPdpPage()) return null;
    var pagePc = resolveConfiguredColorProductCode(null);
    var selects = global.document.querySelectorAll("#options_table select, #v65-product-parent select");
    var best = null;
    var i;
    // Saranoni products share option category 23 and use uploaded per-option
    // photos named {ProductCode}-{optionId}-S/T.jpg. Prefer that live option
    // list over any legacy one-off config so every available variant renders.
    for (i = 0; i < selects.length; i++) {
      var sarSel = selects[i];
      if (sarSel.classList && sarSel.classList.contains("mc-native-leather")) continue;
      var sarPc = parseProductCodeFromSelectName(sarSel.name);
      if (!/^SAR/i.test(sarPc)) continue;
      if (pagePc && sarPc !== pagePc) continue;
      if (!isSaranoniColorSelect(sarSel)) continue;
      var sarEntries = buildDataDrivenSaranoniEntries(sarSel, sarPc);
      if (!sarEntries.length) continue;
      return {
        productCode: sarPc,
        select: sarSel,
        entries: sarEntries,
        score: sarEntries.length,
        dataDriven: true,
        variantAxis: "color",
      };
    }
    for (i = 0; i < selects.length; i++) {
      var select = selects[i];
      var productCode = parseProductCodeFromSelectName(select.name);
      var entries = PDP_CONFIGURED_COLOR_SWATCHS[productCode];
      if (!entries || !entries.length) continue;
      var score = 0;
      var ei;
      for (ei = 0; ei < entries.length; ei++) {
        if (findConfiguredColorOption(select, entries[ei])) score++;
      }
      if (!score) continue;
      if (!best || score > best.score) {
        best = {
          productCode: productCode,
          select: select,
          entries: entries,
          score: score,
          dataDriven: false,
          variantAxis: "color",
        };
      }
    }
    if (best) return best;
    // Data-driven fallback for any Saranoni (SAR-*) product whose color select is the
    // shared color option-category (23). Swatches are probe-mounted, so a product
    // whose photos are not uploaded yet keeps its native dropdown visible.
    for (i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (sel.classList && sel.classList.contains("mc-native-leather")) continue;
      var pc = parseProductCodeFromSelectName(sel.name);
      if (!/^SAR/i.test(pc)) continue;
      if (pagePc && pc !== pagePc) continue;
      if (!isSaranoniColorSelect(sel)) continue;
      var dynEntries = buildDataDrivenSaranoniEntries(sel, pc);
      if (!dynEntries.length) continue;
      return {
        productCode: pc,
        select: sel,
        entries: dynEntries,
        score: dynEntries.length,
        dataDriven: true,
        variantAxis: "color",
      };
    }
    return null;
  }

  var saranoniSizeActiveOptionId = "";
  var saranoniSizeActiveImageFile = "";

  function extractVolusionCacheQuery(src) {
    var m = String(src || "").match(/[?&]v-cache=([^&]+)/i);
    return m ? "?v-cache=" + m[1] : "?v-cache=" + Date.now();
  }

  function dismissSaranoniProductPhotoLoading() {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg) return;
    var scopes = [];
    if (mainImg.closest) {
      var anchor = mainImg.closest("a");
      if (anchor && anchor.parentNode) scopes.push(anchor.parentNode);
      var td = mainImg.closest("td");
      if (td) scopes.push(td);
    }
    if (!scopes.length) scopes.push(global.document.getElementById("v65-product-parent"));
    scopes.forEach(function (scope) {
      if (!scope || !scope.querySelectorAll) return;
      scope.querySelectorAll("div, span, font, td, b").forEach(function (el) {
        if (el === mainImg || (el.contains && el.contains(mainImg))) return;
        var t = String(el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (t !== "loading..." && t !== "loading") return;
        try {
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("visibility", "hidden", "important");
        } catch (eHide) {}
      });
    });
    try {
      mainImg.style.setProperty("opacity", "1", "important");
      mainImg.style.removeProperty("visibility");
    } catch (eImg) {}
  }

  function getSaranoniSelectedOptionId() {
    var selects = global.document.querySelectorAll(
      "#options_table select[name*='___23'], #options_table select[name*='___58'], #v65-product-parent select[name*='___23'], #v65-product-parent select[name*='___58']"
    );
    var i;
    for (i = 0; i < selects.length; i++) {
      var selected = selects[i].options && selects[i].options[selects[i].selectedIndex];
      if (selected && String(selected.value || "").trim()) return String(selected.value).trim();
    }
    return "";
  }

  function syncSaranoniOptionPriceFromVolusion() {
    var pwo =
      global.document.getElementById("priceWithOptions") ||
      global.document.getElementById("priceWithOptionsNoTax");
    if (!pwo) return;
    var baseAmt =
      parseMoney(
        (pwo.getAttribute && (pwo.getAttribute("value") || pwo.getAttribute("content"))) || ""
      ) || 0;
    var amt =
      parseMoney(
        (pwo.getAttribute && (pwo.getAttribute("value") || pwo.getAttribute("content"))) ||
          pwo.textContent ||
          ""
      ) || 0;
    var sizeCtx = findSaranoniSizeVariantContext();
    if (sizeCtx && sizeCtx.select && sizeCtx.select.selectedIndex >= 0) {
      var add = extractAdditionalFromOptionText(
        sizeCtx.select.options[sizeCtx.select.selectedIndex].text ||
          sizeCtx.select.options[sizeCtx.select.selectedIndex].innerText ||
          ""
      );
      var base = baseAmt > 0 ? baseAmt : amt;
      if (base > 0) {
        var computed = base + add;
        if (computed > 0 && computed > amt + 0.009) {
          amt = computed;
        }
      }
    }
    var productCode = resolveSoftGoodsProductCode();
    var catalog = global.MC_SARANONI_VARIANT_PRICING || {};
    var pricing = catalog[productCode];
    if (pricing) {
      var selectedId = getSaranoniSelectedOptionId();
      var selected = selectedId && pricing.variants ? pricing.variants[selectedId] : null;
      // Supplier sale prices are never advertised on Saranoni PDPs.  Use the
      // regular supplier value until a checkout promotion explicitly applies.
      amt = selected && selected.regular > 0 ? Number(selected.regular) : Number(pricing.regular || amt);
    }
    if (!(amt > 0)) return;
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (host) {
      host.querySelectorAll(".mc-pdp-stack-retail-amt, .product_list_price").forEach(function (el) {
        try {
          el.textContent = fmtMoney(amt);
        } catch (eAmt) {}
      });
      host.querySelectorAll("[itemprop='price']").forEach(function (el) {
        try {
          el.setAttribute("content", amt.toFixed(2));
          el.textContent = fmtMoney(amt);
        } catch (eMeta) {}
      });
    }
    if (typeof global.updateBNPLMessaging === "function") {
      try {
        global.updateBNPLMessaging(Math.round(amt * 100));
      } catch (eBnpl) {}
    }
  }

  function setSaranoniSizePhotoSrc(resolvedSrc, label, productCode) {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg || !resolvedSrc) return;
    if (productCode && !configuredColorImageBelongsToProduct(resolvedSrc, productCode)) return;
    var full = resolvedSrc.replace(/-T\.jpg/i, ".jpg").replace(/-S\.jpg/i, ".jpg");
    function finishHeroSwap() {
      dismissSaranoniProductPhotoLoading();
      try {
        if (global.vZoom && typeof global.vZoom.add === "function") {
          global.vZoom.add(mainImg, extractVolusionCacheQuery(resolvedSrc));
        }
      } catch (eVz) {}
    }
    try {
      mainImg.onload = finishHeroSwap;
      if ((mainImg.getAttribute("src") || "") !== resolvedSrc) mainImg.src = resolvedSrc;
      if (mainImg.hasAttribute("srcset")) mainImg.removeAttribute("srcset");
      mainImg.style.setProperty("opacity", "1", "important");
      if (label) {
        mainImg.title = label;
        mainImg.alt = label;
      }
      if (mainImg.complete && mainImg.naturalWidth > 0) finishHeroSwap();
    } catch (eSrc) {}
    ["product_photo_zoom_url", "product_photo_zoom_url2"].forEach(function (id) {
      var zoom = global.document.getElementById(id);
      if (!zoom) return;
      try {
        zoom.href = full;
        if (label) zoom.title = label;
      } catch (eZoom) {}
    });
  }

  function scheduleSaranoniSizeHeroLock(productCode, fileName, label) {
    [0, 120, 400, 900].forEach(function (delay) {
      global.setTimeout(function () {
        if (saranoniSizeActiveImageFile !== fileName) return;
        loadProductScopedColorImage(productCode, fileName, function (resolvedSrc) {
          if (!resolvedSrc || saranoniSizeActiveImageFile !== fileName) return;
          setSaranoniSizePhotoSrc(resolvedSrc, label, productCode);
        });
      }, delay);
    });
  }

  function applySaranoniSizeHeroPhoto(productCode, fileName, label) {
    if (!productCode || !fileName) return;
    saranoniSizeActiveImageFile = fileName;
    loadProductScopedColorImage(productCode, fileName, function (resolvedSrc) {
      if (!resolvedSrc || saranoniSizeActiveImageFile !== fileName) return;
      setSaranoniSizePhotoSrc(resolvedSrc, label, productCode);
      scheduleSaranoniSizeHeroLock(productCode, fileName, label);
    });
  }

  function syncSaranoniSizeSelect(select, opt) {
    if (!select || !opt) return false;
    try {
      select.dataset.mcConfiguredColorSyncing = "1";
    } catch (eSyncFlag) {}
    select.value = opt.value;
    try {
      select.selectedIndex = opt.index;
    } catch (eIdx) {}
    var catRaw = parseOptionCategoryFromSelectName(select.name);
    var catId = catRaw ? parseInt(catRaw, 10) : 58;
    // Skip change_option for size-only Saranoni — it hijacks #product_photo with a
    // stuck "loading..." overlay when option photos live on our CDN, not Volusion.
    if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
      try {
        global.AutoUpdatePriceWithSelectedOptions(opt.value, catId);
      } catch (ePrice) {}
    }
    try {
      select.disabled = false;
      select.removeAttribute("disabled");
    } catch (eEn) {}
    [0, 80, 250, 600].forEach(function (delay) {
      global.setTimeout(syncSaranoniOptionPriceFromVolusion, delay);
    });
    global.setTimeout(function () {
      try {
        delete select.dataset.mcConfiguredColorSyncing;
      } catch (eSyncClear) {
        try {
          select.dataset.mcConfiguredColorSyncing = "0";
        } catch (eSyncClear2) {}
      }
    }, 0);
    return true;
  }

  function findSaranoniSizeVariantContext() {
    if (isBeanBagPdpPage()) return null;
    var pagePc = resolveConfiguredColorProductCode(null);
    var selects = global.document.querySelectorAll("#options_table select, #v65-product-parent select");
    var i;
    for (i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (sel.classList && sel.classList.contains("mc-native-leather")) continue;
      var pc = parseProductCodeFromSelectName(sel.name);
      if (!/^SAR/i.test(pc)) continue;
      if (pagePc && pc !== pagePc) continue;
      if (!isSaranoniSizeSelect(sel)) continue;
      var entries = buildDataDrivenSaranoniEntries(sel, pc);
      if (!entries.length) continue;
      return {
        productCode: pc,
        select: sel,
        entries: entries,
        score: entries.length,
        dataDriven: true,
        variantAxis: "size",
      };
    }
    return null;
  }

  function findPdpMediaTd() {
    var photo = global.document.getElementById("product_photo");
    if (photo && photo.closest) {
      var td = photo.closest("td");
      if (td) return td;
    }
    return (
      global.document.querySelector("#v65-product-parent td.mc-pdp-media-td") ||
      global.document.getElementById("product_photo_td")
    );
  }

  var VARIANT_SWATCH_SELECTOR =
    "#beanbag-swatch-wrapper, #mc-configured-color-swatch-wrapper, #mc-saranoni-size-thumbs, " +
    "#mc-bb-size-section, #mc-saranoni-color-picker, .mc-saranoni-color-picker";

  function findPdpInfoTd() {
    return (
      findPdpHeroColumnTd() ||
      global.document.querySelector("#v65-product-parent td.mc-pdp-options-td") ||
      global.document.querySelector("#v65-product-parent td.mc-unified-pdp-info")
    );
  }

  function relocateVariantSwatchesFromMediaColumn() {
    if (!isProductPdp()) return;
    var mediaTd = findPdpMediaTd();
    var infoTd = findPdpInfoTd();
    if (!mediaTd || !infoTd || mediaTd === infoTd) return;
    var nodes = [];
    global.document.querySelectorAll(VARIANT_SWATCH_SELECTOR).forEach(function (el) {
      if (el && mediaTd.contains(el) && nodes.indexOf(el) === -1) nodes.push(el);
    });
    if (!nodes.length) return;
    nodes.forEach(function (node) {
      try {
        if (isSaranoniPdpPage() && node.id === "mc-configured-color-swatch-wrapper") {
          mountSaranoniSwatchWrapper(node);
          return;
        }
        if (node.id === "beanbag-swatch-wrapper") {
          extractSwatchesIntoCol();
          return;
        }
        var anchor =
          global.document.getElementById("mc-pdp-option-block") ||
          global.document.getElementById("mc-configured-color-swatch-wrapper") ||
          global.document.getElementById("beanbag-swatch-wrapper") ||
          global.document.getElementById("messaging-element") ||
          global.document.getElementById("mc-pdp-price-stack-host");
        var features = global.document.getElementById("mc-pdp-features");
        if (features && features.parentNode === infoTd) {
          infoTd.insertBefore(node, features);
        } else if (anchor && anchor.parentNode === infoTd) {
          insertNodeAfter(infoTd, anchor, node);
        } else {
          infoTd.appendChild(node);
        }
      } catch (eMove) {}
    });
  }

  function removeSaranoniColorPickerUi() {
    global.document.querySelectorAll(".mc-saranoni-color-picker").forEach(function (picker) {
      if (picker && picker.parentNode) {
        try {
          picker.parentNode.removeChild(picker);
        } catch (eRm) {}
      }
    });
    dedupeSaranoniConfiguredColorSwatchWrappers();
  }

  function expandSaranoniHeroNestedTables() {
    if (!isSaranoniPdpPage()) return;
    var root = global.document.getElementById("v65-product-parent");
    var row = findSoftGoodsProductRow();
    if (!root || !row || !root.contains(row)) return;
    var walk = row.parentNode;
    while (walk && walk !== root) {
      if (walk.tagName === "TABLE" || walk.tagName === "TD" || walk.tagName === "TBODY") {
        try {
          walk.style.setProperty("width", "100%", "important");
          walk.style.setProperty("max-width", "100%", "important");
          walk.style.setProperty("box-sizing", "border-box", "important");
        } catch (eWalk) {}
      }
      walk = walk.parentNode;
    }
    var desktopTwoCol = false;
    try {
      desktopTwoCol = !!(
        global.matchMedia &&
        global.matchMedia("(min-width: 992px)").matches
      );
    } catch (eMq) {}
    row.querySelectorAll("td.mc-pdp-media-td").forEach(function (cell) {
      try {
        if (cell.parentNode === row) {
          // mc-pdp-media-td is itself the flex media column (direct child of the
          // product row) — size it as the 55% flex item on desktop; full-bleed on mobile.
          cell.style.setProperty("display", "block", "important");
          if (desktopTwoCol) {
            cell.style.setProperty("flex", "1 1 55%", "important");
            cell.style.setProperty("flex-basis", "55%", "important");
            cell.style.setProperty("max-width", "58%", "important");
            cell.style.setProperty("width", "auto", "important");
          } else {
            cell.style.setProperty("flex", "0 0 auto", "important");
            cell.style.setProperty("flex-basis", "auto", "important");
            cell.style.setProperty("max-width", "100%", "important");
            cell.style.setProperty("width", "100%", "important");
          }
          cell.style.setProperty("min-width", "0", "important");
          cell.style.setProperty("box-sizing", "border-box", "important");
        } else {
          // mc-pdp-media-td is the native photo cell nested inside the media
          // column's inner table. Forcing display:block + width:auto here makes
          // it shrink-wrap to the hero image's (circular) min-content width and
          // collapse the image to a few pixels. Keep it a table-cell so it fills
          // the inner table and gives #product_photo a real width to resolve
          // against (the flex column sizing comes from tr.mc-pdp-main-row>td).
          cell.style.setProperty("display", "table-cell", "important");
          cell.style.setProperty("width", "100%", "important");
          cell.style.setProperty("max-width", "none", "important");
          cell.style.setProperty("min-width", "0", "important");
          cell.style.setProperty("box-sizing", "border-box", "important");
        }

        /* Saranoni's hero table includes an empty companion cell after the
           photo cell.  It consumes a fixed sliver of the media column and
           keeps the hero image below its approved width.  Remove only that
           empty companion cell; leave any populated gallery/content cells
           untouched. */
        if (isSaranoniPdpPage() && cell.parentNode && cell.parentNode.children) {
          Array.prototype.forEach.call(cell.parentNode.children, function (sibling) {
            if (sibling === cell || sibling.tagName !== "TD") return;
            if (sibling.querySelector("img, a, input, select, button, video")) return;
            if ((sibling.textContent || "").trim()) return;
            sibling.style.setProperty("display", "none", "important");
            sibling.style.setProperty("width", "0", "important");
            sibling.style.setProperty("min-width", "0", "important");
            sibling.style.setProperty("max-width", "0", "important");
            sibling.style.setProperty("padding", "0", "important");
            sibling.style.setProperty("border", "0", "important");
          });
        }
      } catch (eMedia) {}
    });
    row.querySelectorAll("td.mc-pdp-options-td").forEach(function (cell) {
      try {
        cell.style.setProperty("display", "block", "important");
        // Desktop keeps a fixed info column; mobile must drop the 460px lock or the
        // accordion / purchase stack compresses to ~160px beside the hero.
        if (desktopTwoCol) {
          cell.style.setProperty("flex", "0 0 min(428px, 38vw)", "important");
          cell.style.setProperty("flex-basis", "min(428px, 38vw)", "important");
          cell.style.setProperty("flex-shrink", "0", "important");
          cell.style.setProperty("min-width", "0", "important");
          cell.style.setProperty("max-width", "428px", "important");
          cell.style.setProperty("width", "min(428px, 38vw)", "important");
          cell.style.setProperty("padding-left", "0", "important");
          cell.style.setProperty("padding-right", "0", "important");
        } else {
          cell.style.setProperty("flex", "0 0 auto", "important");
          cell.style.setProperty("flex-basis", "auto", "important");
          cell.style.setProperty("flex-shrink", "1", "important");
          cell.style.setProperty("min-width", "0", "important");
          cell.style.setProperty("max-width", "100%", "important");
          cell.style.setProperty("width", "100%", "important");
        }
        cell.style.setProperty("box-sizing", "border-box", "important");
      } catch (eOpt) {}
    });
    row.querySelectorAll("td > table, td > table table").forEach(function (tbl) {
      try {
        tbl.style.setProperty("width", "100%", "important");
        tbl.style.setProperty("max-width", "100%", "important");
        tbl.style.setProperty("box-sizing", "border-box", "important");
        if (!desktopTwoCol) {
          tbl.style.setProperty("min-width", "0", "important");
          tbl.style.setProperty("display", "block", "important");
        }
      } catch (eTbl) {}
    });
    if (!desktopTwoCol) {
      row.querySelectorAll("td.mc-pdp-options-td, td.mc-pdp-options-td table, td.mc-pdp-options-td tbody, td.mc-pdp-options-td tr, td.mc-pdp-options-td td").forEach(function (node) {
        try {
          node.style.setProperty("width", "100%", "important");
          node.style.setProperty("max-width", "100%", "important");
          node.style.setProperty("min-width", "0", "important");
          node.style.setProperty("box-sizing", "border-box", "important");
          node.style.setProperty("padding-left", "0", "important");
          node.style.setProperty("padding-right", "0", "important");
          node.style.setProperty("margin-left", "0", "important");
          node.style.setProperty("margin-right", "0", "important");
        } catch (eNest) {}
      });
      // Accordion may sit inside a nested colors_pricebox/table chain; walk parents up to the main-row cell.
      var accNode = global.document.getElementById("mc-pdp-accordion");
      var walk = accNode;
      while (walk && walk !== row) {
        try {
          if (walk.tagName === "TABLE" || walk.tagName === "TBODY" || walk.tagName === "TR" || walk.tagName === "TD" || walk.tagName === "DIV") {
            walk.style.setProperty("width", "100%", "important");
            walk.style.setProperty("max-width", "100%", "important");
            walk.style.setProperty("min-width", "0", "important");
            walk.style.setProperty("box-sizing", "border-box", "important");
          }
        } catch (eAccWalk) {}
        walk = walk.parentElement;
      }
      // Remove Volusion spacer gutters that keep the options column ~160px on phones.
      row.querySelectorAll('td').forEach(function (cell) {
        try {
          var kids = cell.children;
          if (
            kids &&
            kids.length === 1 &&
            kids[0].tagName === "IMG" &&
            /clear1x1/i.test(kids[0].getAttribute("src") || "")
          ) {
            cell.style.setProperty("display", "none", "important");
            cell.style.setProperty("width", "0", "important");
            cell.style.setProperty("max-width", "0", "important");
            cell.style.setProperty("padding", "0", "important");
          }
        } catch (eSpacer) {}
      });
      row.querySelectorAll("td.mc-pdp-options-td").forEach(function (cell) {
        try {
          var qtyRow = cell.parentElement;
          if (qtyRow && qtyRow.tagName === "TR") {
            qtyRow.querySelectorAll("td").forEach(function (sib) {
              if (sib === cell) return;
              var txt = String(sib.textContent || "").replace(/\s+/g, " ").trim();
              if (!txt || /^quantity:?$/i.test(txt)) {
                sib.style.setProperty("display", "none", "important");
                sib.style.setProperty("width", "0", "important");
              }
            });
          }
        } catch (eQty) {}
      });
    }
    try {
      if (row.parentElement && row.parentElement.tagName === "TBODY") {
        row.parentElement.style.setProperty("display", "block", "important");
        row.parentElement.style.setProperty("width", "100%", "important");
        row.parentElement.style.setProperty("max-width", "100%", "important");
        row.parentElement.style.setProperty("box-sizing", "border-box", "important");
      }
      row.style.setProperty("width", "100%", "important");
      row.style.setProperty("max-width", "100%", "important");
      row.style.setProperty("display", "flex", "important");
      row.style.setProperty("flex-wrap", "nowrap", "important");
      row.style.setProperty("align-items", "flex-start", "important");
      row.style.setProperty("gap", "0", "important");
      row.style.setProperty("column-gap", "0", "important");

      /* Desktop Saranoni uses the approved Monterey PDP frame: a 690px media
         column, 400px information column, and 28px separation.  This replaces
         the older fluid 55%/460px Saranoni sizing that made the image and
         features land at different horizontal coordinates from Steve Silver. */
      if (desktopTwoCol) {
        var directMedia = row.querySelector(":scope > td.vol-product__top--left");
        var directInfo = row.querySelector(":scope > td.vol-product__top--right");
        row.style.setProperty("width", "1128px", "important");
        row.style.setProperty("max-width", "100%", "important");
        row.style.setProperty("margin-left", "auto", "important");
        row.style.setProperty("margin-right", "auto", "important");
        row.style.setProperty("justify-content", "center", "important");
        row.style.setProperty("gap", "28px", "important");
        row.style.setProperty("column-gap", "28px", "important");
        if (directMedia) {
          directMedia.style.setProperty("display", "flex", "important");
          directMedia.style.setProperty("flex", "0 0 690px", "important");
          directMedia.style.setProperty("flex-basis", "690px", "important");
          directMedia.style.setProperty("flex-shrink", "0", "important");
          directMedia.style.setProperty("width", "690px", "important");
          directMedia.style.setProperty("min-width", "690px", "important");
          directMedia.style.setProperty("max-width", "690px", "important");
          directMedia.style.setProperty("padding", "0 16px", "important");
          directMedia.style.setProperty("box-sizing", "border-box", "important");
        }
        if (directInfo) {
          directInfo.style.setProperty("display", "flex", "important");
          directInfo.style.setProperty("flex-direction", "column", "important");
          directInfo.style.setProperty("align-items", "stretch", "important");
          directInfo.style.setProperty("flex", "0 0 400px", "important");
          directInfo.style.setProperty("flex-basis", "400px", "important");
          directInfo.style.setProperty("flex-shrink", "0", "important");
          directInfo.style.setProperty("width", "400px", "important");
          directInfo.style.setProperty("min-width", "400px", "important");
          directInfo.style.setProperty("max-width", "400px", "important");
          directInfo.style.setProperty("padding", "0 16px", "important");
          directInfo.style.setProperty("box-sizing", "border-box", "important");
        }
      }
    } catch (eRow) {}
  }

  function ensureSaranoniPdpLayoutCss() {
    var st = global.document.getElementById("mc-saranoni-pdp-layout-css");
    if (!st) {
      st = global.document.createElement("style");
      st.id = "mc-saranoni-pdp-layout-css";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
    st.textContent =
      "@media (min-width:992px){html body.mc-saranoni-pdp #v65-product-parent,html body.mc-saranoni-pdp #content_area #v65-product-parent{width:100%!important;max-width:100%!important;table-layout:fixed!important}html body.mc-saranoni-pdp #v65-product-parent table:has(tr.mc-pdp-main-row),html body.mc-saranoni-pdp #v65-product-parent td:has(tr.mc-pdp-main-row),html body.mc-saranoni-pdp #v65-product-parent table:has(td.mc-pdp-media-td),html body.mc-saranoni-pdp #v65-product-parent td:has(td.mc-pdp-media-td){width:100%!important;max-width:100%!important;box-sizing:border-box!important}html body.mc-saranoni-pdp #v65-product-parent tbody:has(>tr.mc-pdp-main-row){display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}html body.mc-saranoni-pdp #content_area tr.mc-pdp-main-row,html body.mc-saranoni-pdp #v65-product-parent tr.mc-pdp-main-row{display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:0!important;width:100%!important;max-width:100%!important}html body.mc-saranoni-pdp tr.mc-pdp-main-row>td{display:block!important;flex:1 1 0%!important;width:auto!important;min-width:0!important;max-width:none!important;box-sizing:border-box!important}html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:first-child{flex:1 1 650px!important;flex-basis:650px!important;max-width:650px!important;min-width:0!important}html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:last-child{flex:0 0 460px!important;flex-basis:460px!important;flex-shrink:0!important;min-width:460px!important;max-width:460px!important;width:460px!important}html body.mc-saranoni-pdp tr.mc-pdp-main-row>td>table,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td>table>tbody,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td>table>tbody>tr,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td>table>tbody>tr>td,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:last-child table,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:last-child table tbody,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:last-child table tr,html body.mc-saranoni-pdp tr.mc-pdp-main-row>td:last-child table td{width:100%!important;max-width:100%!important;box-sizing:border-box!important}html body.mc-saranoni-pdp.mc-saranoni-pdp-ready tr.mc-pdp-main-row>td:last-child table.colors_pricebox:not(:has(#mc-pdp-option-block)):not(:has(#mc-pdp-accordion)):not(:has(#mc-pdp-features)):not(:has(#mc-pdp-purchase-stack)):not(:has(#mc-pdp-price-stack-host)):not(:has(#mc-pdp-title-right)):not(:has(#messaging-element)){display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important}html body.mc-saranoni-pdp td.mc-pdp-media-td{display:table-cell!important;width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important}html body.mc-saranoni-pdp td.mc-pdp-options-td{display:flex!important;flex-direction:column!important;align-items:stretch!important;flex:0 0 460px!important;flex-basis:460px!important;flex-shrink:0!important;width:460px!important;max-width:460px!important;min-width:460px!important;box-sizing:border-box!important}html body.mc-saranoni-pdp td.mc-pdp-media-td img#product_photo,html body.mc-saranoni-pdp td.mc-pdp-media-td a#product_photo_zoom_url{width:auto!important;max-width:min(650px,100%)!important;height:auto!important;max-height:none!important;display:block!important;margin-left:0!important;margin-right:auto!important}}" +
      "html body.mc-saranoni-pdp td.mc-pdp-options-td>table.colors_pricebox,html body.mc-saranoni-pdp td.mc-unified-pdp-info>table.colors_pricebox,html body.mc-saranoni-pdp td.mc-pdp-options-td>#options_table:not(#mc-pdp-option-block #options_table),html body.mc-saranoni-pdp td.mc-pdp-options-td>table:has(>#options_table):not(:has(#mc-pdp-option-block)){display:none!important;visibility:hidden!important;height:0!important;max-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important}" +
      "html body.mc-saranoni-pdp td.mc-unified-pdp-info,html body.mc-saranoni-pdp td.mc-pdp-options-td{display:flex!important;flex-direction:column!important;align-items:stretch!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-brand-logo{order:1!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-title-right{order:2!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-price-stack-host{order:3!important}" +
      "html body.mc-saranoni-pdp #messaging-element{order:4!important}" +
      "html body.mc-saranoni-pdp #mc-configured-color-swatch-wrapper,html body.mc-saranoni-pdp .mc-saranoni-scroll-host:has(>#mc-configured-color-swatch-wrapper),html body.mc-saranoni-pdp .mc-saranoni-scroll-host:has(>.mc-configured-color-swatches){order:5!important}" +
      "html body.mc-saranoni-pdp #mc-saranoni-size-label{order:6!important}" +
      "html body.mc-saranoni-pdp #mc-saranoni-size-thumbs{order:7!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-option-block{order:8!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-accordion{order:9!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack,html body.mc-saranoni-pdp #mc-unified-purchase-controls,html body.mc-saranoni-pdp .mc-unified-purchase-controls,html body.mc-saranoni-pdp .mc-pdp-purchase-controls,html body.mc-saranoni-pdp .mc-saranoni-purchase-stack{order:10!important}" +
      "html body.mc-saranoni-pdp td.mc-unified-pdp-info>.mc-configured-color-swatches,html body.mc-saranoni-pdp td.mc-pdp-options-td>.mc-configured-color-swatches{order:5!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-option-block{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;pointer-events:none!important}";
  }

  /*
   * Volusion sometimes leaves the rebuilt information column inside an extra
   * price-table/quantity-cell chain.  That chain is not part of the rebuilt
   * PDP UI, but table layout still reserves its first cell and pushes the real
   * information column right (and, on Bean Bags, down).  Flatten only that
   * exact nested legacy chain.  A direct information column, such as Steve
   * Silver's, is deliberately a no-op here.
   */
  function normalizeLegacyPdpInfoWrapper() {
    if (!isProductPdp()) return;
    try {
      if (!global.matchMedia || !global.matchMedia("(min-width: 992px)").matches) return;
      var info = global.document.querySelector(
        "#v65-product-parent td.mc-pdp-options-td, #v65-product-parent td.mc-unified-pdp-info"
      );
      if (!info) return;
      var outer = info.closest && info.closest("td.vol-product__top--right");
      if (!outer || info.parentElement === outer) return;

      var priceHost = global.document.getElementById("mc-pdp-price-stack-host");
      if (priceHost) {
        outer.querySelectorAll("table.colors_pricebox").forEach(function (table) {
          if (table.contains(info) || !table.querySelector(".option_pricing")) return;
          if (table.querySelector("input, select, button")) return;
          table.style.setProperty("display", "none", "important");
          table.style.setProperty("visibility", "hidden", "important");
          table.style.setProperty("height", "0", "important");
          table.style.setProperty("max-height", "0", "important");
          table.style.setProperty("margin", "0", "important");
          table.style.setProperty("padding", "0", "important");
          table.style.setProperty("overflow", "hidden", "important");
          var next = table.nextElementSibling;
          while (
            next &&
            (next.tagName === "BR" ||
              (next.tagName === "IMG" && /clear1x1/i.test(next.getAttribute("src") || "")))
          ) {
            next.style.setProperty("display", "none", "important");
            next = next.nextElementSibling;
          }
        });
      }

      outer.querySelectorAll("#product_options_heading").forEach(function (heading) {
        if (heading.contains(info) || info.contains(heading)) return;
        heading.style.setProperty("display", "none", "important");
        heading.style.setProperty("height", "0", "important");
        heading.style.setProperty("margin", "0", "important");
        heading.style.setProperty("padding", "0", "important");
      });

      var infoRow = info.parentElement;
      if (infoRow && infoRow.tagName === "TR") {
        Array.prototype.forEach.call(infoRow.children, function (cell) {
          if (cell === info) return;
          if (!cell.querySelector(".vol-cartqty__toggle")) return;
          if (cell.querySelector('input[name^="QTY"], input[name="quantity"], input[name="btnaddtocart"], button[name="btnaddtocart"]')) return;
          cell.style.setProperty("display", "none", "important");
          cell.style.setProperty("width", "0", "important");
          cell.style.setProperty("min-width", "0", "important");
          cell.style.setProperty("padding", "0", "important");
          cell.style.setProperty("margin", "0", "important");
          cell.style.setProperty("overflow", "hidden", "important");
        });
      }

      var node = info.parentElement;
      while (node && node !== outer) {
        if (/^(TABLE|TBODY|TR|TD)$/.test(node.tagName || "")) {
          node.style.setProperty("display", "block", "important");
          node.style.setProperty("width", "100%", "important");
          node.style.setProperty("max-width", "100%", "important");
          node.style.setProperty("min-width", "0", "important");
          node.style.setProperty("margin", "0", "important");
          node.style.setProperty("padding", "0", "important");
          node.style.setProperty("box-sizing", "border-box", "important");
        }
        node = node.parentElement;
      }
      info.style.setProperty("width", "100%", "important");
      info.style.setProperty("max-width", "100%", "important");
      info.style.setProperty("min-width", "0", "important");
      info.style.setProperty("box-sizing", "border-box", "important");
    } catch (eNormalizeLegacyPdpInfo) {}
  }

  function ensureSaranoniSizeVariantCss() {
    ensureSaranoniPdpLayoutCss();
    ensureSaranoniScrollArrowCss();
    var st = global.document.getElementById("mc-saranoni-size-variant-css");
    if (!st) {
      st = global.document.createElement("style");
      st.id = "mc-saranoni-size-variant-css";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
    st.textContent =
      /* 4-across grid, wrap to next row — no horizontal scrollbar. */
      ".mc-saranoni-size-thumbs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;width:100%!important;max-width:100%!important;margin:12px 0 0!important;padding:0!important;overflow:visible!important;scrollbar-width:none!important;-ms-overflow-style:none!important}" +
      ".mc-saranoni-size-thumbs::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;background:transparent!important}" +
      ".mc-saranoni-size-label{display:block!important;margin:12px 0 6px!important;font:500 13px/1.3 Inter,Arial,sans-serif!important;letter-spacing:.08em!important;color:#444!important;text-transform:none!important}" +
      ".mc-saranoni-size-thumb{appearance:none!important;-webkit-appearance:none!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;width:100%!important;min-width:0!important;min-height:0!important;padding:8px 6px!important;border:1px solid #e8e8e8!important;border-radius:4px!important;background:#fff!important;cursor:pointer!important;overflow:visible!important;box-sizing:border-box!important}" +
      ".mc-saranoni-size-thumb img{display:block!important;width:100%!important;max-width:100%!important;height:auto!important;aspect-ratio:1/1!important;object-fit:cover!important;margin:0!important;padding:0!important;border:0!important;border-radius:2px!important}" +
      ".mc-saranoni-size-thumb .mc-saranoni-size-thumb__label{margin:0!important;font:600 11px/1.15 Inter,Arial,sans-serif!important;max-width:100%!important;color:#444!important;text-align:center!important;white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important;letter-spacing:0!important}" +
      "@media (max-width:991px){.mc-saranoni-size-thumbs{gap:6px!important}.mc-saranoni-size-thumb{padding:8px 2px!important}.mc-saranoni-size-thumb .mc-saranoni-size-thumb__label{font:600 10.5px/1.1 Inter,Arial,sans-serif!important}}" +
      ".mc-saranoni-size-thumb .mc-saranoni-size-thumb__price{margin:0!important;font:500 11px/1.2 Inter,Arial,sans-serif!important;color:#666!important;text-align:center!important;white-space:nowrap!important}" +
      ".mc-saranoni-size-thumb.active{border:1px solid #d8d8d8!important;box-shadow:0 0 0 1px #d8d8d8 inset!important}" +
      /* Size row must never sit in a scroll-host / get rail arrows. */
      ".mc-saranoni-scroll-host:has(> #mc-saranoni-size-thumbs) > .mc-saranoni-scroll-arrow{display:none!important}" +
      "#mc-saranoni-size-thumbs.mc-saranoni-scroll-rail{padding-left:0!important;padding-right:0!important;overflow:visible!important}";
  }

  function splitSaranoniSizeDisplayLabel(rawLabel) {
    var raw = String(rawLabel || "").replace(/\s+/g, " ").trim();
    var additional = extractAdditionalFromOptionText(raw);
    var name = raw
      .replace(/\[\s*Additional\s*\$?[\d,]+(?:\.\d{2})?\s*\]/gi, "")
      .replace(/\(\s*\+\s*\$?[\d,]+(?:\.\d{2})?\s*\)/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return { name: name || raw, additional: additional };
  }

  function updateSaranoniSizeThumbUi(optionId) {
    var id = String(optionId || "");
    global.document.querySelectorAll(".mc-saranoni-size-thumb[data-option-id]").forEach(function (btn) {
      var on = !!(id && btn.getAttribute("data-option-id") === id);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function applySaranoniSizeVariantSelection(ctx, entry, updateHero) {
    if (!ctx || !entry || !ctx.select) return false;
    saranoniSizeActiveOptionId = String(entry.optionId || "");
    try {
      global.__MC_SAR_SIZE_USER_PICKED__ = true;
    } catch (ePick) {}
    var opt = findConfiguredColorOption(ctx.select, entry);
    if (opt) {
      syncSaranoniSizeSelect(ctx.select, opt);
      ensureConfiguredColorCartField(ctx.select, opt, null);
    }
    updateSaranoniSizeThumbUi(entry.optionId);
    if (updateHero !== false) {
      applySaranoniSizeHeroPhoto(ctx.productCode, entry.mainImage, entry.label);
    }
    return true;
  }

  function bindSaranoniSizeVariantSelect(ctx) {
    if (!ctx || !ctx.select || ctx.select.dataset.mcSarSizeBound === "1") return;
    ctx.select.dataset.mcSarSizeBound = "1";
    try {
      ctx.select.setAttribute("onchange", "");
      ctx.select.onchange = null;
    } catch (eInline) {}
    ctx.select.addEventListener("change", function () {
      if (ctx.select.dataset.mcConfiguredColorSyncing === "1") return;
      var entry = readConfiguredColorSelectEntry(ctx);
      if (!entry) return;
      applySaranoniSizeVariantSelection(ctx, entry, true);
    });
  }

  function ensureSaranoniSizeVariantThumbs(ctx) {
    if (!ctx || !ctx.select || !ctx.entries || !ctx.entries.length) return;
    ensureSaranoniSizeVariantCss();
    bindSaranoniSizeVariantSelect(ctx);
    var infoColumn = resolveSaranoniInfoColumn();
    if (!infoColumn) return;
    var row = global.document.getElementById("mc-saranoni-size-thumbs");
    if (!row) {
      row = global.document.createElement("div");
      row.id = "mc-saranoni-size-thumbs";
      row.className = "mc-saranoni-size-thumbs";
      row.setAttribute("data-product-code", ctx.productCode);
      var mountAnchor =
        global.document.getElementById("mc-pdp-option-block") ||
        global.document.getElementById("messaging-element");
      if (mountAnchor && mountAnchor.parentNode === infoColumn) {
        insertNodeAfter(infoColumn, mountAnchor, row);
      } else {
        // Never mount below the ATC button — that causes a visible flash of a
        // second thumb set under the cart button before reorder hoists it up.
        var atcStack = global.document.getElementById("mc-pdp-purchase-stack");
        if (atcStack && atcStack.parentNode === infoColumn) {
          infoColumn.insertBefore(row, atcStack);
        } else {
          infoColumn.appendChild(row);
        }
      }
    }
    var sizeLabel = global.document.getElementById("mc-saranoni-size-label");
    if (!sizeLabel) {
      sizeLabel = global.document.createElement("div");
      sizeLabel.id = "mc-saranoni-size-label";
      sizeLabel.className = "mc-saranoni-size-label";
      sizeLabel.textContent = "Size";
    }
    if (sizeLabel.parentNode !== infoColumn || sizeLabel.nextElementSibling !== row) {
      infoColumn.insertBefore(sizeLabel, row);
    }
    var signature =
      ctx.productCode + "|" + ctx.entries.map(function (e) { return e.optionId; }).join(",");
    if (row.getAttribute("data-mc-signature") === signature && row.querySelector(".mc-saranoni-size-thumb")) {
      if (saranoniSizeActiveOptionId) updateSaranoniSizeThumbUi(saranoniSizeActiveOptionId);
      ensureSaranoniSizeThumbsInInfoColumn();
      return;
    }
    row.setAttribute("data-mc-signature", signature);
    row.innerHTML = "";
    ctx.entries.forEach(function (entry) {
      var opt = findConfiguredColorOption(ctx.select, entry);
      if (!opt) return;
      var btn = global.document.createElement("button");
      btn.type = "button";
      btn.className = "mc-saranoni-size-thumb";
      btn.setAttribute("data-option-id", entry.optionId);
      btn.setAttribute("data-main-image", entry.mainImage || "");
      var parts = splitSaranoniSizeDisplayLabel(entry.label);
      var aria =
        parts.additional > 0
          ? parts.name + " (Additional $" + parts.additional.toFixed(parts.additional % 1 ? 2 : 0) + ")"
          : parts.name;
      btn.setAttribute("aria-label", aria);
      btn.setAttribute("title", aria);
      var priceHtml = "";
      if (parts.additional > 0) {
        var dollars =
          parts.additional % 1
            ? parts.additional.toFixed(2)
            : String(Math.round(parts.additional));
        priceHtml =
          '<span class="mc-saranoni-size-thumb__price">Additional $' +
          escapeHtmlText(dollars) +
          "</span>";
      }
      btn.innerHTML =
        '<img alt="' +
        escapeHtmlText(parts.name) +
        '" />' +
        '<span class="mc-saranoni-size-thumb__label">' +
        escapeHtmlText(parts.name) +
        "</span>" +
        priceHtml;
      var img = btn.querySelector("img");
      var productCode = ctx.productCode || resolveConfiguredColorProductCode(ctx);
      function hideBrokenSizeImg() {
        if (!img) return;
        img.style.setProperty("display", "none", "important");
      }
      if (img && productCode) {
        loadProductScopedColorImage(productCode, entry.swatchImage || entry.mainImage, function (swatchSrc) {
          if (swatchSrc) {
            img.src = swatchSrc;
            img.style.removeProperty("display");
            return;
          }
          loadProductScopedColorImage(productCode, entry.mainImage, function (mainSrc) {
            if (mainSrc) {
              img.src = mainSrc;
              img.style.removeProperty("display");
            } else {
              hideBrokenSizeImg();
            }
          });
        });
        img.onerror = hideBrokenSizeImg;
      } else {
        hideBrokenSizeImg();
      }
      row.appendChild(btn);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        applySaranoniSizeVariantSelection(ctx, entry, true);
      });
    });
    /* Unwrap size row from scroll-host / rail if a prior pass added arrows. */
    try {
      row.classList.remove("mc-saranoni-scroll-rail");
      row.style.setProperty("overflow", "visible", "important");
      row.style.setProperty("padding-left", "0", "important");
      row.style.setProperty("padding-right", "0", "important");
      var sizeHost = row.parentNode;
      if (sizeHost && sizeHost.classList && sizeHost.classList.contains("mc-saranoni-scroll-host")) {
        sizeHost.querySelectorAll(":scope > .mc-saranoni-scroll-arrow").forEach(function (arrow) {
          if (arrow.parentNode) arrow.parentNode.removeChild(arrow);
        });
      }
    } catch (eUnwrapSize) {}
    if (saranoniSizeActiveOptionId) updateSaranoniSizeThumbUi(saranoniSizeActiveOptionId);
    ensureSaranoniSizeThumbsInInfoColumn();
  }

  function hideSaranoniNativeOptionPricing() {
    if (!isSaranoniPdpPage()) return;
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box) return;
    box.querySelectorAll(".option_pricing, font.option_pricing").forEach(function (node) {
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
      } catch (eHide) {}
    });
    var pwo = global.document.getElementById("priceWithOptions");
    if (pwo) {
      try {
        pwo.style.setProperty("position", "absolute", "important");
        pwo.style.setProperty("left", "-9999px", "important");
        pwo.style.setProperty("width", "1px", "important");
        pwo.style.setProperty("height", "1px", "important");
        pwo.style.setProperty("overflow", "hidden", "important");
        pwo.style.setProperty("opacity", "0", "important");
      } catch (ePwo) {}
    }
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (host) hideAllStrayPdpPriceNodes(host);
    syncSaranoniOptionPriceFromVolusion();
  }

  function ensureSaranoniVariantUi() {
    if (!isSaranoniPdpPage()) return;
    ensureSaranoniPdpLayoutCss();
    removeSaranoniColorPickerUi();
    removeLegacySaranoniTemplatePickers();
    var sizeCtx = findSaranoniSizeVariantContext();
    var colorCtx = findConfiguredColorSwatchContext();
    if (sizeCtx) ensureSaranoniSizeVariantThumbs(sizeCtx);
    if (colorCtx && !sizeCtx) ensureConfiguredColorSwatches();
    if (colorCtx && sizeCtx && colorCtx.select !== sizeCtx.select) {
      ensureConfiguredColorSwatches();
    }
    if (sizeCtx && colorCtx && colorCtx.select === sizeCtx.select) {
      var strayWrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
      if (strayWrap && strayWrap.parentNode) {
        try {
          strayWrap.parentNode.removeChild(strayWrap);
        } catch (eRmWrap) {}
      }
    }
    /* Drop orphan Size UI when this product is style/color-only (rockers). */
    if (!sizeCtx) {
      try {
        ["mc-saranoni-size-label", "mc-saranoni-size-thumbs"].forEach(function (id) {
          var el = global.document.getElementById(id);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
      } catch (eRmSize) {}
    }
    if (!colorCtx && !sizeCtx) return;
    hideSaranoniNativeOptionPricing();
  }

  function buildConfiguredColorImageCandidates(fileName, productCode) {
    var candidates = [];
    if (!fileName) return candidates;
    candidates.push(
      "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/" + fileName
    );
    var storeFolder = "";
    try {
      storeFolder = String(
        global.global_Config_StoreFolderName || global.Config_StoreFolderName || ""
      ).trim();
    } catch (eStore) {}
    if (storeFolder) {
      var cdnPath = storeFolder.replace(/\/?$/, "/") + "v/vspfiles/photos/" + fileName;
      if (cdnPath.indexOf("//") === 0) cdnPath = "https:" + cdnPath;
      candidates.push(cdnPath);
    }
    candidates.push("/v/vspfiles/photos/" + fileName);
    candidates.push("/v/vspfiles/images/" + fileName);
    if (!productCode) {
      var mainImg = global.document.getElementById("product_photo");
      var src = mainImg && mainImg.getAttribute ? mainImg.getAttribute("src") || "" : "";
      if (src) candidates.push(src.replace(/[^/]+$/, fileName));
    }
    return candidates.filter(function (item, idx, arr) {
      return item && arr.indexOf(item) === idx;
    });
  }

  var configuredColorImageProbeCache = {};
  var configuredColorImageProbeInflight = {};

  function loadConfiguredColorImage(candidates, done) {
    if (!candidates || !candidates.length) {
      done("");
      return;
    }
    var cacheKey = candidates.join("|");
    if (configuredColorImageProbeCache[cacheKey]) {
      done(configuredColorImageProbeCache[cacheKey]);
      return;
    }
    if (configuredColorImageProbeInflight[cacheKey]) {
      configuredColorImageProbeInflight[cacheKey].push(done);
      return;
    }
    configuredColorImageProbeInflight[cacheKey] = [done];
    var idx = 0;
    function finish(resolved) {
      if (resolved) configuredColorImageProbeCache[cacheKey] = resolved;
      var waiters = configuredColorImageProbeInflight[cacheKey] || [];
      delete configuredColorImageProbeInflight[cacheKey];
      waiters.forEach(function (cb) {
        try {
          cb(resolved || "");
        } catch (eDone) {}
      });
    }
    function tryNext() {
      if (idx >= candidates.length) {
        finish("");
        return;
      }
      var probe = new global.Image();
      var candidate = candidates[idx++];
      probe.onload = function () {
        finish(candidate);
      };
      probe.onerror = tryNext;
      probe.src = candidate;
    }
    tryNext();
  }

  function setConfiguredColorPhotoSrc(resolvedSrc, label, productCode) {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg || !resolvedSrc) return;
    if (productCode && !configuredColorImageBelongsToProduct(resolvedSrc, productCode)) return;
    try {
      if ((mainImg.getAttribute("src") || "") !== resolvedSrc) mainImg.src = resolvedSrc;
      if (mainImg.hasAttribute("srcset")) mainImg.removeAttribute("srcset");
    } catch (eSrc) {}
    try {
      mainImg.style.setProperty("opacity", "1", "important");
    } catch (eOp) {}
    var full = resolvedSrc.replace(/-T\.jpg/i, ".jpg").replace(/-S\.jpg/i, ".jpg");
    ["product_photo_zoom_url", "product_photo_zoom_url2"].forEach(function (id) {
      var zoom = global.document.getElementById(id);
      if (!zoom) return;
      try {
        if ((zoom.getAttribute("href") || "") !== full) zoom.href = full;
        if (label) zoom.title = label;
      } catch (eZoom) {}
    });
    try {
      if (global.vZoom && typeof global.vZoom.add === "function") {
        global.vZoom.add(mainImg, resolvedSrc);
      }
    } catch (eVz) {}
  }

  // Volusion's native option-change logic can asynchronously rewrite (often blank)
  // #product_photo a few hundred ms after the change event. Re-assert our chosen
  // image for a short window so the hero never blanks or reverts.
  function lockConfiguredColorActiveEntry(entry) {
    if (!entry) return;
    configuredColorActiveEntry = entry;
    try {
      global.__MC_CONFIGURED_COLOR_ACTIVE_OPTION_ID__ = String(entry.optionId || "");
    } catch (eLockGlobal) {}
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (wrap) wrap.setAttribute("data-mc-active-option-id", entry.optionId);
    global.document.querySelectorAll(".mc-saranoni-color-picker").forEach(function (picker) {
      picker.setAttribute("data-mc-active-option-id", entry.optionId);
    });
  }

  function restoreConfiguredColorActiveEntry(ctx) {
    if (configuredColorActiveEntry || !ctx || !ctx.entries) return;
    var lockedId = "";
    try {
      lockedId = String(global.__MC_CONFIGURED_COLOR_ACTIVE_OPTION_ID__ || "");
    } catch (eLockedGlobal) {}
    if (!lockedId) {
      var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
      lockedId = wrap ? wrap.getAttribute("data-mc-active-option-id") || "" : "";
    }
    if (!lockedId) {
      var picker = global.document.querySelector(".mc-saranoni-color-picker[data-mc-active-option-id]");
      lockedId = picker ? picker.getAttribute("data-mc-active-option-id") || "" : "";
    }
    if (!lockedId) return;
    var i;
    for (i = 0; i < ctx.entries.length; i++) {
      if (ctx.entries[i].optionId === String(lockedId)) {
        configuredColorActiveEntry = ctx.entries[i];
        return;
      }
    }
  }

  function resolveConfiguredColorEntry(ctx, optionId) {
    if (!ctx || !ctx.entries || !optionId) return null;
    var id = String(optionId);
    var i;
    for (i = 0; i < ctx.entries.length; i++) {
      if (ctx.entries[i].optionId === id) return ctx.entries[i];
    }
    return null;
  }

  function updateConfiguredColorLabels(selected) {
    var label = selected ? selected.label : "";
    var labelEl = global.document.getElementById("mc-configured-color-selected-name");
    if (labelEl) labelEl.textContent = label;
    var sarNameEl = global.document.getElementById("mc-saranoni-selected-color-name");
    if (sarNameEl) sarNameEl.textContent = label;
  }

  function applyConfiguredColorSelection(ctx, entry, forcePhoto) {
    if (!ctx || !entry) return false;
    try {
      global.__MC_CONFIGURED_COLOR_USER_PICKED__ = true;
    } catch (eUserPick) {}
    lockConfiguredColorActiveEntry(entry);
    var opt = findConfiguredColorOption(ctx.select, entry);
    if (opt) {
      syncConfiguredColorSelect(ctx.select, opt);
      ensureConfiguredColorCartField(ctx.select, opt, null);
    }
    syncConfiguredColorSwatchUi(ctx, true, forcePhoto);
    if (isSaranoniPdpPage()) {
      removeSaranoniDuplicateColorPicker();
      finalizeSaranoniInfoColumnOrder();
    }
    return true;
  }

  function applyConfiguredColorMainPhoto(fileName, label, productCode) {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg || !fileName) return;
    var pc = productCode || resolveConfiguredColorProductCode(null);
    var previousSrc = mainImg.getAttribute("src") || "";
    if (
      !configuredColorDefaultSrc &&
      previousSrc &&
      previousSrc.indexOf("/manufacturers/") === -1 &&
      !configuredColorActiveEntry &&
      (!pc || configuredColorImageBelongsToProduct(previousSrc, pc))
    ) {
      configuredColorDefaultSrc = previousSrc;
    }
    var token = String(Date.now()) + ":" + Math.random();
    global.__MC_CONFIGURED_COLOR_IMAGE_TOKEN__ = token;
    loadProductScopedColorImage(pc, fileName, function (resolvedSrc) {
      if (global.__MC_CONFIGURED_COLOR_IMAGE_TOKEN__ !== token) return;
      var finalSrc = resolvedSrc;
      if (!finalSrc && configuredColorActiveEntry) {
        finalSrc = previousSrc;
      }
      if (!finalSrc) finalSrc = previousSrc || configuredColorDefaultSrc;
      if (!finalSrc) return;
      if (pc && !configuredColorImageBelongsToProduct(finalSrc, pc)) return;
      if (
        pc &&
        configuredColorActiveEntry &&
        !configuredColorImageMatchesOption(finalSrc, pc, configuredColorActiveEntry.optionId) &&
        !isConfiguredProductDefaultHero(finalSrc, pc)
      ) {
        return;
      }
      configuredColorActiveSrc = finalSrc;
      configuredColorEnforceUntil = Date.now() + (configuredColorActiveEntry ? 8000 : 2500);
      setConfiguredColorPhotoSrc(finalSrc, label, pc);
      enforceConfiguredColorPhoto(pc);
    });
  }

  function enforceConfiguredColorPhoto(productCode) {
    var pc = productCode || resolveConfiguredColorProductCode(null);
    if (configuredColorEnforceTimer) return;
    configuredColorEnforceTimer = global.setInterval(function () {
      var enforceActive =
        !!configuredColorActiveEntry ||
        Date.now() <= configuredColorEnforceUntil;
      if (!enforceActive || !configuredColorActiveSrc) {
        global.clearInterval(configuredColorEnforceTimer);
        configuredColorEnforceTimer = null;
        return;
      }
      if (pc && !configuredColorImageBelongsToProduct(configuredColorActiveSrc, pc)) {
        global.clearInterval(configuredColorEnforceTimer);
        configuredColorEnforceTimer = null;
        return;
      }
      var mainImg = global.document.getElementById("product_photo");
      if (!mainImg) return;
      var cur = mainImg.getAttribute("src") || "";
      var altOverride = "";
      try {
        altOverride = String(global.__MC_PDP_ALT_VIEW_ACTIVE_SRC__ || "");
      } catch (eAltOverride) {}
      if (altOverride && configuredColorImageBelongsToProduct(altOverride, pc)) {
        if (cur !== altOverride) setConfiguredColorPhotoSrc(altOverride, "", pc);
        return;
      }
      if (cur !== configuredColorActiveSrc) {
        setConfiguredColorPhotoSrc(
          configuredColorActiveSrc,
          configuredColorActiveEntry ? configuredColorActiveEntry.label : "",
          pc
        );
      }
    }, 120);
  }

  // Parse the trailing option-category id out of a Volusion select name,
  // e.g. SELECT___SAR-RUCHED-MINKY-THROW-BLANKET___23 -> "23".
  function parseOptionCategoryFromSelectName(name) {
    var m = String(name || "").match(/___(\d+)\s*$/);
    return m ? m[1] : "";
  }

  function syncConfiguredColorSelect(select, opt) {
    if (!select || !opt) return false;
    try {
      select.dataset.mcConfiguredColorSyncing = "1";
    } catch (eSyncFlag) {}
    select.value = opt.value;
    try {
      select.selectedIndex = opt.index;
    } catch (eIdx) {}
    var catRaw = parseOptionCategoryFromSelectName(select.name);
    var catId = catRaw ? parseInt(catRaw, 10) : 4;
    if (typeof global.change_option === "function") {
      try {
        global.change_option(select.name, opt.value);
      } catch (eOpt) {}
    }
    if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
      try {
        global.AutoUpdatePriceWithSelectedOptions(opt.value, catId);
      } catch (ePrice) {}
    }
    try {
      select.disabled = false;
      select.removeAttribute("disabled");
    } catch (eEn) {}
    // Do not dispatch synthetic change/input here — Volusion handlers can revert
    // size selects to the first option (Mini) and our listener would lock that in.
    global.setTimeout(function () {
      try {
        delete select.dataset.mcConfiguredColorSyncing;
      } catch (eSyncClear) {
        try {
          select.dataset.mcConfiguredColorSyncing = "0";
        } catch (eSyncClear2) {}
      }
    }, 0);
    return true;
  }

  function readConfiguredColorSelectEntry(ctx) {
    if (!ctx || !ctx.select || !ctx.entries) return null;
    var opt =
      ctx.select.options && ctx.select.selectedIndex >= 0
        ? ctx.select.options[ctx.select.selectedIndex]
        : null;
    if (!opt) return null;
    var i;
    for (i = 0; i < ctx.entries.length; i++) {
      if (optionMatchesConfiguredColorEntry(opt, ctx.entries[i])) return ctx.entries[i];
    }
    return null;
  }

  function reassertConfiguredColorActiveSelection(ctx, applyPhoto) {
    if (!ctx || !ctx.select || !configuredColorActiveEntry) return false;
    if (!global.__MC_CONFIGURED_COLOR_USER_PICKED__) return false;
    var opt = findConfiguredColorOption(ctx.select, configuredColorActiveEntry);
    if (!opt) return false;
    var fromSelect = readConfiguredColorSelectEntry(ctx);
    if (!fromSelect || fromSelect.optionId !== configuredColorActiveEntry.optionId) {
      syncConfiguredColorSelect(ctx.select, opt);
    }
    ensureConfiguredColorCartField(ctx.select, opt, null);
    syncConfiguredColorSwatchUi(ctx, !!applyPhoto);
    syncSaranoniAltviewActiveState();
    return true;
  }

  function findSaranoniColorSelect() {
    var selects = global.document.querySelectorAll("#options_table select, #v65-product-parent select");
    var i;
    for (i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (!isSaranoniColorSelect(sel)) continue;
      return sel;
    }
    return null;
  }

  function ensureConfiguredColorCartField(select, opt, form) {
    if (!select || !opt || !select.name) return;
    try {
      select.disabled = false;
      select.removeAttribute("disabled");
    } catch (eEnable) {}
    if (!form) {
      var btn = global.document.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
      form = (btn && btn.form) || (select.closest && select.closest("form")) || null;
    }
    if (!form || form.contains(select)) return;
    var hidden = null;
    var existing = form.querySelectorAll('input[type="hidden"][data-mc-configured-color-cart="1"]');
    var hi;
    for (hi = 0; hi < existing.length; hi++) {
      if (existing[hi].name === select.name) {
        hidden = existing[hi];
        break;
      }
    }
    if (!hidden) {
      hidden = global.document.createElement("input");
      hidden.type = "hidden";
      hidden.name = select.name;
      hidden.setAttribute("data-mc-configured-color-cart", "1");
      form.appendChild(hidden);
    }
    hidden.value = opt.value;
  }

  function ensureColorOptionCommittedBeforeAddToCart(trigger) {
    if (!isSaranoniPdpPage()) return;
    var sizeCtx = findSaranoniSizeVariantContext();
    if (sizeCtx) {
      var sizeEntry = readConfiguredColorSelectEntry(sizeCtx);
      if (!sizeEntry && saranoniSizeActiveOptionId) {
        sizeEntry = resolveConfiguredColorEntry(sizeCtx, saranoniSizeActiveOptionId);
      }
      if (sizeEntry) {
        applySaranoniSizeVariantSelection(sizeCtx, sizeEntry, false);
      }
      return;
    }
    var ctx = findConfiguredColorSwatchContext();
    var select = (ctx && ctx.select) || findSaranoniColorSelect();
    if (!select) return;
    var opt = null;
    if (configuredColorActiveEntry && ctx) {
      opt = findConfiguredColorOption(select, configuredColorActiveEntry);
    }
    if (!opt) {
      var activeBtn = global.document.querySelector(".mc-configured-color-swatch.active");
      if (activeBtn && ctx) {
        var oid = activeBtn.getAttribute("data-option-id");
        var ei;
        for (ei = 0; ei < ctx.entries.length; ei++) {
          if (ctx.entries[ei].optionId === oid) {
            opt = findConfiguredColorOption(select, ctx.entries[ei]);
            break;
          }
        }
      }
    }
    if (!opt && select.selectedIndex >= 0) {
      var cur = select.options[select.selectedIndex];
      if (cur && String(cur.value || "").trim()) opt = cur;
    }
    if (opt) {
      syncConfiguredColorSelect(select, opt);
      var form = trigger && trigger.tagName === "FORM" ? trigger : trigger && trigger.form ? trigger.form : null;
      ensureConfiguredColorCartField(select, opt, form);
    }
  }

  function installSaranoniColorAtcGuard() {
    if (global.__MC_SAR_COLOR_ATC_GUARD__) return;
    global.__MC_SAR_COLOR_ATC_GUARD__ = true;
    global.document.addEventListener(
      "click",
      function (eAtc) {
        if (!isSaranoniPdpPage()) return;
        var btn =
          eAtc.target && eAtc.target.closest
            ? eAtc.target.closest('input[name="btnaddtocart"], button[name="btnaddtocart"]')
            : null;
        if (!btn) return;
        ensureColorOptionCommittedBeforeAddToCart(btn);
      },
      true
    );
    global.document.addEventListener(
      "submit",
      function (eSub) {
        if (!isSaranoniPdpPage()) return;
        var form = eSub.target;
        if (!form || !form.querySelector) return;
        if (
          !form.querySelector(
            'input[name="btnaddtocart"], button[name="btnaddtocart"], input[name="ProductCode"]'
          )
        ) {
          return;
        }
        ensureColorOptionCommittedBeforeAddToCart(form);
      },
      true
    );
  }

  function restoreConfiguredColorNativeSelect(select) {
    if (!select || select.dataset.mcConfiguredColorHidden !== "1") return;
    select.dataset.mcConfiguredColorHidden = "0";
    try {
      select.style.removeProperty("position");
      select.style.removeProperty("width");
      select.style.removeProperty("height");
      select.style.removeProperty("padding");
      select.style.removeProperty("margin");
      select.style.removeProperty("border");
      select.style.removeProperty("overflow");
      select.style.removeProperty("clip");
      select.style.removeProperty("clip-path");
      select.style.removeProperty("white-space");
      select.style.removeProperty("opacity");
      select.style.removeProperty("pointer-events");
    } catch (eRestore) {}
  }

  function syncSaranoniAltviewActiveState() {
    if (!isSaranoniPdpPage()) return;
    var ctx = findConfiguredColorSwatchContext();
    if (ctx) syncConfiguredColorSwatchUi(ctx, false, false);
  }

  function syncSaranoniColorPicker(ctx) {
    if (!isSaranoniPdpPage()) return;
    removeSaranoniDuplicateColorPicker();
    if (ctx) updateConfiguredColorLabels(resolveDisplayedColorEntry(ctx));
    finalizeSaranoniInfoColumnOrder();
  }
  function hideSaranoniHeroAltviews() {
    if (!isSaranoniPdpPage()) return;
    var alt =
      global.document.getElementById("altviews") ||
      global.document.querySelector("span#altviews, #content_area .altviews, #v65-product-parent .altviews");
    if (!alt) return;
    /* Always hide native Volusion #altviews on Saranoni — color option images
       duplicate the swatch rail, and the legacy negative-margin desktop rule
       collapses the media cell so the hero covers Related Items. Gallery alts
       come from #mc-pdp-alt-view-row (probed -altviewN.jpg) instead. */
    alt.classList.remove("mc-saranoni-color-altviews");
    if (alt.getAttribute("data-mc-sar-alt-signature")) {
      alt.removeAttribute("data-mc-sar-alt-signature");
      alt.innerHTML = "";
    }
    try {
      alt.style.setProperty("display", "none", "important");
      alt.style.setProperty("visibility", "hidden", "important");
      alt.style.setProperty("height", "0", "important");
      alt.style.setProperty("max-height", "0", "important");
      alt.style.setProperty("overflow", "hidden", "important");
      alt.style.setProperty("margin", "0", "important");
      alt.style.setProperty("padding", "0", "important");
      alt.style.setProperty("position", "absolute", "important");
      alt.style.setProperty("left", "-9999px", "important");
    } catch (eHideAlt) {}
    ensureFreshSaranoniAltViewRowScript();
  }

  /* Force the SARFIX5 alt-view probe (cached Image .complete fix) even when
     baked PDPs still request an older ?v= cache key for alt-view-row.js. */
  function ensureFreshSaranoniAltViewRowScript() {
    /* Despite the name (originally Saranoni-only), mc-pdp-alt-view-row.js is
       shared by every unified-family PDP (Saranoni, Steve Silver, Mahjong
       House, closeout). Its script tag uses a static ?v= with no per-load
       cache-bust, so once a browser/CDN caches a copy under that URL it can
       keep serving stale JS indefinitely even after the server file is
       updated -- confirmed live: a fix to this file's alt-view click
       handler (setHero) took effect on the server but a Steve Silver PDP
       kept running old cached JS with no way to self-heal, because this
       guard only ever forced a fresh copy on Saranoni pages. */
    if (
      !isSaranoniPdpPage() &&
      !isSteveSilverPdpPage() &&
      !isCloseoutPdpPage() &&
      !isMahjongHousePdpPage()
    ) {
      return;
    }
    /* MC_ALT_VIEW_ROW_20260723close1 — gate on newest flag so stale caches
       still force a fresh fetch with closeout altview-only probing. */
    var want = "20260723close1";
    try {
      if (global["__MC_TMH_ALT_VIEW_ROW_20260723close1__"]) {
        global.document.documentElement.setAttribute("data-mc-alt-view-row-fp", want);
        return;
      }
      global.document.querySelectorAll('script[src*="mc-pdp-alt-view-row.js"]').forEach(function (old) {
        try {
          old.remove();
        } catch (eRmAlt) {}
      });
      try {
        delete global.__MC_TMH_ALT_VIEW_ROW_20260723close1__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260723mob1__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260721B__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX5__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX4__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX3__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260720SARFIX1__;
        delete global.__MC_TMH_ALT_VIEW_ROW_20260716__;
      } catch (eFlags) {}
      var s = global.document.createElement("script");
      s.src = "/v/vspfiles/js/mc-pdp-alt-view-row.js?v=" + want + "&mcrd=" + Date.now();
      s.async = false;
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eAltBoot) {}
  }

  function restoreSaranoniNativeColorUi(select) {
    if (!select || !isSaranoniPdpPage()) return;
    restoreConfiguredColorNativeSelect(select);
    var row = select.closest ? select.closest("tr") : null;
    if (row) {
      try {
        row.style.removeProperty("height");
        row.style.removeProperty("max-height");
        row.style.removeProperty("overflow");
        row.style.removeProperty("margin");
        row.style.removeProperty("padding");
        row.style.removeProperty("border");
        row.style.removeProperty("line-height");
        row.style.removeProperty("display");
      } catch (eRow) {}
      var prev = row.previousElementSibling;
      var prevText = String(prev && prev.textContent ? prev.textContent : "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (prev && SARANONI_VARIANT_LABEL_PATTERNS.test(prevText)) {
        try {
          prev.style.removeProperty("display");
          prev.style.removeProperty("visibility");
          prev.style.removeProperty("height");
          prev.style.removeProperty("overflow");
        } catch (ePrev) {}
      }
    }
    var table = select.closest ? select.closest("#options_table, table[id*='options_table']") : null;
    if (!table) return;
    table.querySelectorAll(".productoptionname, td.productoptionname, label").forEach(function (lab) {
      var txt = String(lab.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!SARANONI_VARIANT_LABEL_PATTERNS.test(txt)) return;
      if (lab.contains && lab.contains(select)) return;
      try {
        lab.style.removeProperty("display");
        lab.style.removeProperty("visibility");
        lab.style.removeProperty("height");
        lab.style.removeProperty("overflow");
      } catch (eLab) {}
    });
    try {
      table.style.removeProperty("display");
      table.style.removeProperty("visibility");
      table.style.removeProperty("height");
      table.style.removeProperty("max-height");
      table.style.removeProperty("overflow");
    } catch (eTable) {}
  }

  function showSaranoniNativeColorFallback(select) {
    if (!select || !isSaranoniPdpPage()) return;
    ensureSaranoniVariantOptionBlock();
    restoreSaranoniNativeColorUi(select);
    var host = global.document.getElementById("mc-pdp-option-block");
    if (host) {
      try {
        host.style.removeProperty("display");
        host.style.removeProperty("visibility");
        host.style.removeProperty("height");
        host.style.removeProperty("overflow");
      } catch (eHost) {}
    }
  }

  function applySaranoniTextOnlyColorSwatch(btn, entry) {
    if (!btn || !entry) return;
    btn.classList.add("mc-saranoni-text-swatch");
    btn.innerHTML =
      '<span class="mc-configured-color-swatch__text">' + escapeHtmlText(entry.label) + "</span>";
    btn.style.display = "";
    btn.setAttribute("aria-label", entry.label);
    btn.setAttribute("title", entry.label);
  }

  function countSaranoniVisibleSwatches(wrap) {
    var visible = 0;
    if (!wrap) return visible;
    wrap.querySelectorAll(".mc-configured-color-swatch").forEach(function (btn) {
      if (btn.style.display === "none") return;
      visible++;
    });
    return visible;
  }

  function syncSaranoniSwatchReadyState(wrap, select, visibleCount) {
    var body = global.document.body;
    var ctx = findConfiguredColorSwatchContext();
    if (!body) return;
    if (!visibleCount && wrap) visibleCount = countSaranoniVisibleSwatches(wrap);
    if (visibleCount > 0 && wrap && wrap.querySelector(".mc-configured-color-swatch")) {
      body.classList.add("mc-saranoni-swatches-ready");
      hideConfiguredColorNativeSelect(select);
      hideSaranoniNativeColorUi(select); hideSaranoniStrayVariantLabels();
      try {
        wrap.style.removeProperty("display");
        wrap.style.removeProperty("visibility");
        wrap.style.removeProperty("height");
        wrap.style.removeProperty("overflow");
        wrap.style.removeProperty("margin");
        wrap.style.removeProperty("padding");
        wrap.removeAttribute("aria-hidden");
      } catch (eShowWrap) {}
      removeSaranoniDuplicateColorPicker();
      mountSaranoniSwatchWrapper(wrap);
      if (ctx) scheduleSaranoniLayoutPass(false);
      return;
    }
    body.classList.remove("mc-saranoni-swatches-ready");
    removeSaranoniDuplicateColorPicker();
    if (wrap && wrap.parentNode) {
      try {
        wrap.parentNode.removeChild(wrap);
      } catch (eRm) {}
    }
    if (select && select.options && select.options.length > 1) {
      showSaranoniNativeColorFallback(select);
      if (ctx) scheduleSaranoniLayoutPass(false);
      return;
    }
    restoreConfiguredColorNativeSelect(select);
  }

  
  function hideSaranoniStrayVariantLabels() {
    if (!isSaranoniPdpPage()) return;
    try {
      if (global.document.body) global.document.body.classList.add("mc-saranoni-style-rail-active");
    } catch (eB) {}
    var root = global.document.getElementById("v65-product-parent") || global.document;
    root.querySelectorAll("td, font, label, span, b, strong, div, .productoptionname").forEach(function (el) {
      if (!el) return;
      if (el.closest && el.closest("#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch, #mc-pdp-accordion")) return;
      var txt = String(el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (!/^(select\s+style|choose\s+style|selected\s+color|choose\s+color|selected\s+style|style|color)\s*\*?$/.test(txt)) return;
      if (el.querySelector && el.querySelector("select, input, img, button, a")) return;
      try {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("height", "0", "important");
        el.style.setProperty("overflow", "hidden", "important");
        el.style.setProperty("margin", "0", "important");
        el.style.setProperty("padding", "0", "important");
      } catch (eH) {}
    });
    root.querySelectorAll("img[id^='optionimg_']").forEach(function (img) {
      if (img.closest && img.closest("#mc-configured-color-swatch-wrapper, #altviews, #mc-pdp-alt-view-row, #product_photo_td")) return;
      try {
        img.style.setProperty("display", "none", "important");
        var row = img.closest && img.closest("tr");
        if (row) row.style.setProperty("display", "none", "important");
      } catch (eI) {}
    });
  }

  function hideSaranoniNativeColorUi(select) {
    if (!select || !isSaranoniPdpPage()) return;
    hideSaranoniStrayVariantLabels();
    alignSaranoniInfoToHeroTop();
    try {
      if (global.document && global.document.body) {
        global.document.body.classList.add("mc-saranoni-style-rail-active");
      }
    } catch (eBody) {}
    hideConfiguredColorNativeSelect(select);
    var row = select.closest ? select.closest("tr") : null;
    if (row) {
      try {
        row.style.setProperty("display", "none", "important");
        row.style.setProperty("height", "0", "important");
        row.style.setProperty("max-height", "0", "important");
        row.style.setProperty("overflow", "hidden", "important");
        row.style.setProperty("margin", "0", "important");
        row.style.setProperty("padding", "0", "important");
        row.style.setProperty("border", "0", "important");
        row.style.setProperty("line-height", "0", "important");
      } catch (eRow) {}
      var prev = row.previousElementSibling;
      var prevText = String(prev && prev.textContent ? prev.textContent : "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (prev && SARANONI_VARIANT_LABEL_PATTERNS.test(prevText)) {
        try {
          prev.style.setProperty("display", "none", "important");
          prev.style.setProperty("visibility", "hidden", "important");
          prev.style.setProperty("height", "0", "important");
          prev.style.setProperty("overflow", "hidden", "important");
        } catch (ePrev) {}
      }
    }
    /* Baked lovey HTML has no #options_table id — fall back to parent table / PDP root. */
    var table =
      (select.closest && select.closest("#options_table, table[id*='options_table']")) ||
      (select.closest && select.closest("table")) ||
      null;
    var scope =
      table ||
      global.document.getElementById("v65-product-parent") ||
      global.document;
    if (table) {
      table.querySelectorAll(".productoptionname, td.productoptionname, label").forEach(function (lab) {
        var txt = String(lab.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (!SARANONI_VARIANT_LABEL_PATTERNS.test(txt)) return;
        if (lab.contains && lab.contains(select)) return;
        try {
          lab.style.setProperty("display", "none", "important");
          lab.style.setProperty("visibility", "hidden", "important");
          lab.style.setProperty("height", "0", "important");
          lab.style.setProperty("overflow", "hidden", "important");
        } catch (eLab) {}
      });
    }

    /* Stray "SELECT STYLE" can sit above the brand logo outside the options table. */
    try {
      var info =
        global.document.querySelector(
          "#v65-product-parent td.mc-unified-pdp-info, #v65-product-parent td.mc-pdp-options-td, #v65-product-parent .colors_pricebox"
        ) || global.document.getElementById("v65-product-parent");
      if (info) {
        info.querySelectorAll("td, font, label, span, b, strong, div").forEach(function (el) {
          if (!el || (el.children && el.children.length > 3)) return;
          var txt = String(el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (!/^(select\s+style|choose\s+style|style)\s*\*?$/.test(txt)) return;
          if (el.closest && el.closest("#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch")) return;
          try {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("visibility", "hidden", "important");
            el.style.setProperty("height", "0", "important");
            el.style.setProperty("overflow", "hidden", "important");
            el.style.setProperty("margin", "0", "important");
            el.style.setProperty("padding", "0", "important");
          } catch (eLab2) {}
        });
      }
    } catch (eInfoLab) {}

    /* Hide stray SELECT STYLE / SELECTED COLOR above brand logo. */
    try {
      var info =
        global.document.querySelector(
          "#v65-product-parent td.mc-unified-pdp-info, #v65-product-parent td.mc-pdp-options-td, #v65-product-parent .colors_pricebox"
        ) || global.document.getElementById("v65-product-parent");
      if (info) {
        info.querySelectorAll("td, font, label, span, b, strong, div, .productoptionname").forEach(function (el) {
          if (!el || (el.children && el.children.length > 4)) return;
          var txt = String(el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (!/^(select\s+style|choose\s+style|selected\s+color|choose\s+color|color|style)\s*\*?$/.test(txt)) return;
          if (el.closest && el.closest("#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch")) return;
          try {
            el.style.setProperty("display", "none", "important");
            el.style.setProperty("visibility", "hidden", "important");
            el.style.setProperty("height", "0", "important");
            el.style.setProperty("overflow", "hidden", "important");
          } catch (e2) {}
        });
      }
    } catch (eInfoLab) {}

    /* Style option photos (optionimg_*) stack beside the hero when the rail builds —
       hide them anywhere under the PDP, but never the product photo / altviews / rail. */
    scope.querySelectorAll("img[id^='optionimg_']").forEach(function (img) {
      if (
        img.closest &&
        img.closest(
          "#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch, #product_photo_td, #altviews, #product_photo, #mc-pdp-alt-view-row, #mc-centered-altviews-wrap, #mc-steve-silver-altviews-wrap, .mc-pdp-alt-view-row"
        )
      ) {
        return;
      }
      if (img.id === "product_photo" || (img.classList && img.classList.contains("vCSS_img_product_photo"))) {
        return;
      }
      try {
        img.style.setProperty("display", "none", "important");
        img.style.setProperty("visibility", "hidden", "important");
        img.style.setProperty("width", "0", "important");
        img.style.setProperty("height", "0", "important");
        var link = img.closest ? img.closest("a") : null;
        if (link && !(link.querySelector && link.querySelector("#product_photo, img#product_photo"))) {
          link.style.setProperty("display", "none", "important");
          link.style.setProperty("visibility", "hidden", "important");
        }
        var imgRow = img.closest ? img.closest("tr") : null;
        if (
          imgRow &&
          !imgRow.querySelector(
            "#mc-configured-color-swatch-wrapper, .mc-configured-color-swatch, #product_photo, img#product_photo"
          )
        ) {
          imgRow.style.setProperty("display", "none", "important");
          imgRow.style.setProperty("height", "0", "important");
        }
      } catch (eImg) {}
    });
  }

  function hideSaranoniNestedStrayMediaCol() {
    if (!isSaranoniPdpPage()) return;
    var canonicalMedia = findPdpMediaTd();
    global.document
      .querySelectorAll("#v65-product-parent td.mc-pdp-hero-media-col, #v65-product-parent td.mc-pdp-media-td")
      .forEach(function (td) {
        if (!td || td.classList.contains("mc-pdp-options-td")) return;
        if (
          canonicalMedia &&
          (td === canonicalMedia || td.contains(canonicalMedia) || canonicalMedia.contains(td))
        ) {
          return;
        }
        if (td.querySelector("#product_photo, img#product_photo, #product_photo_zoom_url, #product_photo_td")) return;
        try {
          td.classList.remove("mc-pdp-hero-media-col", "mc-pdp-media-td");
          td.style.setProperty("display", "none", "important");
          td.style.setProperty("visibility", "hidden", "important");
          td.style.setProperty("width", "0", "important");
          td.style.setProperty("max-width", "0", "important");
          td.style.setProperty("padding", "0", "important");
          td.style.setProperty("margin", "0", "important");
          td.style.setProperty("overflow", "hidden", "important");
          td.setAttribute("aria-hidden", "true");
        } catch (eHideStray) {}
      });
  }

  function hideSaranoniStrayHeroCopy(infoColumn) {
    if (!infoColumn || !isSaranoniPdpPage()) return;
    infoColumn.querySelectorAll(
      "#ProductDetail_ProductDetails_div, #ProductDetail_ProductDetails_div2, #product_description"
    ).forEach(function (node) {
      if (node.closest("#mc-pdp-description-below-features")) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("padding", "0", "important");
      } catch (eHide) {}
    });
    var mediaTd = findPdpMediaTd();
    if (!mediaTd) return;
    mediaTd
      .querySelectorAll(
        "#ProductDetail_ProductDetails_div, #ProductDetail_ProductDetails_div2, #product_description, table.colors_descriptionbox"
      )
      .forEach(function (node) {
        var host = global.document.getElementById("mc-pdp-description-below-features");
        if (host && (host === node || host.contains(node))) return;
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("overflow", "hidden", "important");
          node.style.setProperty("margin", "0", "important");
          node.style.setProperty("padding", "0", "important");
        } catch (eMediaHide) {}
      });
  }

  function hideConfiguredColorNativeSelect(select) {
    if (!select || select.dataset.mcConfiguredColorHidden === "1") return;
    select.dataset.mcConfiguredColorHidden = "1";
    try {
      select.style.setProperty("position", "absolute", "important");
      select.style.setProperty("left", "-9999px", "important");
      select.style.setProperty("top", "auto", "important");
      select.style.setProperty("width", "1px", "important");
      select.style.setProperty("height", "1px", "important");
      select.style.setProperty("padding", "0", "important");
      select.style.setProperty("margin", "0", "important");
      select.style.setProperty("border", "0", "important");
      select.style.setProperty("overflow", "hidden", "important");
      select.style.setProperty("clip", "rect(0 0 0 0)", "important");
      select.style.setProperty("clip-path", "inset(50%)", "important");
      select.style.setProperty("white-space", "nowrap", "important");
      select.style.setProperty("opacity", "0", "important");
      select.tabIndex = -1;
    } catch (eHide) {}
  }

  function ensureConfiguredColorSwatchCss() {
    ensureSaranoniScrollArrowCss();
    var st = global.document.getElementById("mc-configured-color-swatch-css");
    if (!st) {
      st = global.document.createElement("style");
      st.id = "mc-configured-color-swatch-css";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
    st.textContent =
      ".mc-configured-color-swatch-wrapper{display:block!important;width:100%!important;max-width:460px!important;margin:12px 0 0!important}" +
      ".mc-configured-color-swatch-label{display:block!important;margin-bottom:8px!important;font:700 12px/1.4 Inter,Arial,sans-serif!important;letter-spacing:.03em!important;text-transform:none!important;color:#444!important}" +
      ".mc-configured-color-swatch-label span{font-weight:600!important;letter-spacing:.03em!important;text-transform:none!important}" +
      ".mc-configured-color-swatches{display:flex!important;flex-wrap:wrap!important;gap:12px!important}" +
      "html body.mc-saranoni-pdp .mc-configured-color-swatches.mc-saranoni-swatches,html body.mc-saranoni-pdp .mc-saranoni-swatches{display:flex!important;flex-wrap:nowrap!important;gap:12px!important;overflow-x:auto!important;overflow-y:hidden!important;width:100%!important;max-width:100%!important;padding:0 0 6px!important;-webkit-overflow-scrolling:touch!important;scroll-behavior:smooth!important;scrollbar-width:none!important;-ms-overflow-style:none!important}" +
      "html body.mc-saranoni-pdp .mc-configured-color-swatches.mc-saranoni-swatches::-webkit-scrollbar,html body.mc-saranoni-pdp .mc-saranoni-swatches::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;background:transparent!important}" +
      ".mc-configured-color-swatch{appearance:none!important;-webkit-appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:82px!important;height:82px!important;padding:0!important;border:0!important;border-radius:4px!important;background:#fff!important;cursor:pointer!important;overflow:hidden!important}" +
      ".mc-configured-color-swatch img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important}" +
      ".mc-configured-color-swatch.active{border:2px solid #111!important;box-shadow:0 0 0 1px #111 inset!important}" +
      ".mc-configured-color-swatch.mc-saranoni-text-swatch{width:auto!important;height:auto!important;min-width:72px!important;min-height:36px!important;border-radius:4px!important;padding:6px 12px!important}" +
      ".mc-configured-color-swatch__text{font:600 11px/1.2 Inter,Arial,sans-serif!important;color:#444!important;white-space:normal!important;text-align:center!important}" +
      ".mc-configured-color-swatch:focus-visible{outline:2px solid #111!important;outline-offset:2px!important}";
  }

  function ensureSaranoniScrollArrowCss() {
    var st = global.document.getElementById("mc-saranoni-scroll-arrow-css");
    if (!st) {
      st = global.document.createElement("style");
      st.id = "mc-saranoni-scroll-arrow-css";
      (global.document.head || global.document.documentElement).appendChild(st);
    }
    st.textContent =
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-host{position:relative!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-host .mc-saranoni-scroll-rail{padding-left:28px!important;padding-right:28px!important;scrollbar-width:none!important;-ms-overflow-style:none!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-host .mc-saranoni-scroll-rail::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;background:transparent!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-arrow{appearance:none!important;-webkit-appearance:none!important;position:absolute!important;top:50%!important;transform:translateY(-50%)!important;z-index:5!important;width:22px!important;height:38px!important;border:1px solid #ddd!important;border-radius:999px!important;background:rgba(255,255,255,.96)!important;color:#444!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;margin:0!important;font:700 18px/1 Arial,sans-serif!important;cursor:pointer!important;box-shadow:0 1px 3px rgba(0,0,0,.08)!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-arrow--prev{left:0!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-arrow--next{right:0!important}" +
      "html body.mc-saranoni-pdp .mc-saranoni-scroll-arrow[disabled]{opacity:.25!important;pointer-events:none!important}";
  }

  function ensureSaranoniRailArrows() {
    if (!isSaranoniPdpPage()) return;
    /* Mobile: hide rail arrows — they sit absolute left/right and visually
       appear on the sides of the main product image. Touch-scroll still works. */
    try {
      if (global.matchMedia && global.matchMedia("(max-width: 991px)").matches) {
        global.document.querySelectorAll(".mc-saranoni-scroll-arrow").forEach(function (btn) {
          try {
            btn.style.setProperty("display", "none", "important");
          } catch (eHideArr) {}
        });
        return;
      }
    } catch (eMq) {}
    ensureSaranoniScrollArrowCss();
    [
      global.document.querySelector(".mc-configured-color-swatches.mc-saranoni-swatches")
      /* Size options use a 4-column wrap grid — never a scroll rail. */
    ].forEach(function (rail) {
      if (!rail || !rail.parentNode) return;
      var host = rail.parentNode;
      /* Never promote the whole info column into a scroll host — that orphans
         the rail above the logo and parks arrow buttons as column siblings. */
      if (
        host &&
        host.matches &&
        host.matches(
          "td.mc-unified-pdp-info, td.mc-pdp-options-td, td.mc-pdp-media-td, td.mc-unified-pdp-media"
        )
      ) {
        var wrapHost = global.document.getElementById("mc-configured-color-swatch-wrapper");
        if (wrapHost) {
          try {
            wrapHost.appendChild(rail);
            host = wrapHost;
          } catch (eRehost) {
            return;
          }
        } else {
          return;
        }
      }
      host.classList.add("mc-saranoni-scroll-host");
      rail.classList.add("mc-saranoni-scroll-rail");
      var id = rail.id || rail.getAttribute("data-mc-rail-id") || ("mc-saranoni-rail-" + Math.random().toString(36).slice(2));
      rail.setAttribute("data-mc-rail-id", id);

      function makeButton(dir) {
        var cls = "mc-saranoni-scroll-arrow--" + (dir < 0 ? "prev" : "next");
        var btn = host.querySelector(":scope > ." + cls);
        if (!btn) {
          btn = global.document.createElement("button");
          btn.type = "button";
          btn.className = "mc-saranoni-scroll-arrow " + cls;
          btn.setAttribute("aria-label", dir < 0 ? "Scroll variants left" : "Scroll variants right");
          btn.textContent = dir < 0 ? "‹" : "›";
          if (dir < 0) host.insertBefore(btn, rail);
          else host.insertBefore(btn, rail.nextSibling);
        }
        btn.onclick = function (event) {
          event.preventDefault();
          event.stopPropagation();
          var amount = Math.max(Math.round((rail.clientWidth || 220) * 0.72), 150);
          try {
            rail.scrollBy({ left: dir * amount, behavior: "smooth" });
          } catch (eScrollBy) {
            rail.scrollLeft += dir * amount;
          }
          global.setTimeout(refresh, 180);
        };
        return btn;
      }

      var prev = makeButton(-1);
      var next = makeButton(1);
      function refresh() {
        var max = Math.max(0, rail.scrollWidth - rail.clientWidth - 2);
        var hasOverflow = max > 4;
        prev.style.setProperty("display", hasOverflow ? "flex" : "none", "important");
        next.style.setProperty("display", hasOverflow ? "flex" : "none", "important");
        prev.disabled = !hasOverflow || rail.scrollLeft <= 2;
        next.disabled = !hasOverflow || rail.scrollLeft >= max;
      }
      if (rail.dataset.mcSaranoniArrowBound !== "1") {
        rail.dataset.mcSaranoniArrowBound = "1";
        rail.addEventListener("scroll", refresh, { passive: true });
        global.addEventListener("resize", refresh, { passive: true });
      }
      refresh();
      global.setTimeout(refresh, 250);
      global.setTimeout(refresh, 900);
    });
  }

  function mountSaranoniSwatchWrapper(wrap) {
    if (!wrap || !isSaranoniPdpPage()) return;
    wrap.setAttribute("data-mc-saranoni-swatches", "1");
    var col = findPdpHeroColumnTd();
    if (col) {
      try {
        // Always place after price when possible — even if wrap is already in col
        // but sitting above the logo from an earlier race.
        var priceAnchor = global.document.getElementById("mc-pdp-price-stack-host");
        if (priceAnchor && priceAnchor.parentNode === col) {
          insertNodeAfter(col, priceAnchor, wrap);
        } else if (wrap.parentNode !== col) {
          col.appendChild(wrap);
        }
      } catch (eCol) {}
    }
    try {
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("max-width", "100%", "important");
      wrap.style.setProperty("margin", "12px 0 8px 0", "important");
      wrap.style.setProperty("padding", "0", "important");
    } catch (eWrapStyle) {}
    try {
      ensureSaranoniVariantsBelowPrice();
    } catch (eOrd) {}
    ensureSaranoniRailArrows();
  }

  function finishDataDrivenSaranoniSwatchProbe(wrap, select, ctx, probeState) {
    if (probeState.pending > 0) return;
    syncSaranoniSwatchReadyState(wrap, select, probeState.loaded);
  }

  function hideConfiguredColorLegacyRows(select) {
    if (!select || select.dataset.mcConfiguredColorRowsHidden === "1") return;
    select.dataset.mcConfiguredColorRowsHidden = "1";
    var row = select.closest ? select.closest("tr") : null;
    if (row) {
      try {
        row.style.setProperty("display", "none", "important");
      } catch (eRow) {}
      var prev = row.previousElementSibling;
      var prevText = String(prev && prev.textContent ? prev.textContent : "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (prev && SARANONI_VARIANT_LABEL_PATTERNS.test(prevText)) {
        try {
          prev.style.setProperty("display", "none", "important");
        } catch (ePrev) {}
      }
    }
  }

  function renderConfiguredColorSwatches(ctx) {
    if (!ctx || !ctx.select || !ctx.entries || !ctx.entries.length) return null;
    ensureConfiguredColorSwatchCss();
    var isSar = /^SAR/i.test(ctx.productCode || "");
    // Verified (hardcoded) products hide the native select immediately. Data-driven
    // products hide it only after a real swatch image loads, so a product without
    // uploaded photos keeps its native dropdown as a working fallback.
    if (!ctx.dataDriven) {
      hideConfiguredColorNativeSelect(ctx.select);
      hideConfiguredColorLegacyRows(ctx.select);
    }
    if (isSar) dedupeSaranoniConfiguredColorSwatchWrappers();
    var wrap = isSar ? getConfiguredColorSwatchWrapper() : global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-configured-color-swatch-wrapper";
      wrap.className = "mc-configured-color-swatch-wrapper";
    }
    if (isSar) wrap.classList.add("mc-saranoni-swatch-wrapper");
    wrap.setAttribute("data-product-code", ctx.productCode);
    // Build the swatch markup exactly once per product (idempotent). Rebuilding
    // innerHTML on every MutationObserver tick would wipe the active ring/label
    // the user just selected and cause the block to "bounce".
    var signature = ctx.productCode + "|" + ctx.entries.map(function (e) { return e.optionId; }).join(",");
    if (wrap.getAttribute("data-mc-signature") !== signature || !wrap.querySelector(".mc-configured-color-swatch")) {
      wrap.setAttribute("data-mc-signature", signature);
      wrap.innerHTML =
        '<div class="mc-configured-color-swatch-label">' +
        configuredVariantChooseLabel(ctx, isSar) +
        '<span id="mc-configured-color-selected-name"></span></div>' +
        '<div class="mc-configured-color-swatches' + (isSar ? " mc-saranoni-swatches" : "") + '"></div>';
      var rail = wrap.querySelector(".mc-configured-color-swatches");
      var probeState = { pending: 0, loaded: 0, usedSrc: {} };
      ctx.entries.forEach(function (entry) {
        var opt = findConfiguredColorOption(ctx.select, entry);
        if (!opt) return;
        var btn = global.document.createElement("button");
        btn.type = "button";
        btn.className = "mc-configured-color-swatch";
        btn.setAttribute("aria-label", entry.label);
        btn.setAttribute("title", entry.label);
        btn.setAttribute("data-option-id", entry.optionId);
        btn.setAttribute("data-main-image", entry.mainImage);
        btn.setAttribute("data-label", entry.label);
        btn.innerHTML = '<img alt="' + escapeHtmlText(entry.label) + '" />';
        var img = btn.querySelector("img");
        var productCode = resolveConfiguredColorProductCode(ctx);
        var candidates = buildConfiguredColorThumbCandidates(entry, productCode);
        if (ctx.dataDriven) {
          probeState.pending++;
          var primarySrc =
            (isSar && entry.swatchImage
              ? "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/" + entry.swatchImage
              : "") ||
            candidates[0] ||
            "";
          var settled = false;
          function settleDataDrivenSwatch(resolvedSrc) {
            if (settled) return;
            settled = true;
            probeState.pending--;
            var liveSrc =
              resolvedSrc ||
              (img && img.complete && img.naturalWidth > 0 ? img.getAttribute("src") || "" : "");
            var normalized = normalizeConfiguredColorAssetUrl(liveSrc);
            if (
              liveSrc &&
              configuredColorImageMatchesOption(
                liveSrc,
                productCode,
                entry.optionId,
                entry.label || entry.labelSlug
              ) &&
              (!normalized || !probeState.usedSrc[normalized])
            ) {
              if (normalized) probeState.usedSrc[normalized] = true;
              probeState.loaded++;
              img.src = liveSrc;
              btn.style.display = "";
              hideConfiguredColorNativeSelect(ctx.select);
              hideSaranoniNativeColorUi(ctx.select);
            } else {
              probeState.loaded++;
              applySaranoniTextOnlyColorSwatch(btn, entry);
              hideConfiguredColorNativeSelect(ctx.select);
              hideSaranoniNativeColorUi(ctx.select);
            }
            finishDataDrivenSaranoniSwatchProbe(wrap, ctx.select, ctx, probeState);
          }
          function acceptResolvedSrc(resolvedSrc, next) {
            if (
              resolvedSrc &&
              configuredColorImageMatchesOption(
                resolvedSrc,
                productCode,
                entry.optionId,
                entry.label || entry.labelSlug
              )
            ) {
              settleDataDrivenSwatch(resolvedSrc);
            } else if (typeof next === "function") {
              next();
            } else {
              settleDataDrivenSwatch("");
            }
          }
          if (primarySrc) {
            img.src = primarySrc;
            btn.style.display = "";
            img.onload = function () {
              acceptResolvedSrc(primarySrc, function () {
                loadProductScopedColorImage(productCode, entry.swatchImage, function (swatchSrc) {
                  acceptResolvedSrc(swatchSrc, function () {
                    loadProductScopedColorImage(productCode, entry.mainImage, function (mainSrc) {
                      acceptResolvedSrc(mainSrc, function () {
                        settleDataDrivenSwatch("");
                      });
                    });
                  });
                });
              });
            };
            img.onerror = function () {
              loadProductScopedColorImage(productCode, entry.swatchImage, function (swatchSrc) {
                acceptResolvedSrc(swatchSrc, function () {
                  loadProductScopedColorImage(productCode, entry.swatchImageAlt || entry.mainImage, function (altSrc) {
                    acceptResolvedSrc(altSrc, function () {
                      loadProductScopedColorImage(productCode, entry.mainImage, function (mainSrc) {
                        acceptResolvedSrc(mainSrc, function () {
                          settleDataDrivenSwatch("");
                        });
                      });
                    });
                  });
                });
              });
            };
            global.setTimeout(function () {
              if (settled) return;
              if (img.complete && img.naturalWidth > 0) {
                var curSrc = img.getAttribute("src") || "";
                acceptResolvedSrc(curSrc, function () {
                  settleDataDrivenSwatch("");
                });
              }
            }, 250);
          } else {
            loadProductScopedColorImage(productCode, entry.swatchImage, function (swatchSrc) {
              acceptResolvedSrc(swatchSrc, function () {
                loadProductScopedColorImage(productCode, entry.mainImage, function (mainSrc) {
                  acceptResolvedSrc(mainSrc, function () {
                    settleDataDrivenSwatch("");
                  });
                });
              });
            });
          }
        } else {
          loadProductScopedColorImage(productCode, entry.swatchImage, function (resolvedSrc) {
            var normalized = normalizeConfiguredColorAssetUrl(resolvedSrc);
            if (resolvedSrc && normalized && probeState.usedSrc[normalized]) {
              applySaranoniTextOnlyColorSwatch(btn, entry);
              return;
            }
            if (resolvedSrc && normalized) probeState.usedSrc[normalized] = true;
            img.src = resolvedSrc || "";
          });
        }
        rail.appendChild(btn);
      });
      if (ctx.dataDriven && probeState.pending === 0) {
        finishDataDrivenSaranoniSwatchProbe(wrap, ctx.select, ctx, probeState);
      }
    } else if (ctx.dataDriven && isSar) {
      var visibleSwatches = 0;
      wrap.querySelectorAll(".mc-configured-color-swatch").forEach(function (btn) {
        if (btn.style.display !== "none") visibleSwatches++;
      });
      syncSaranoniSwatchReadyState(wrap, ctx.select, visibleSwatches);
    }
    if (isSar) {
      mountSaranoniSwatchWrapper(wrap);
    } else if (!isPdpLayoutMounted()) {
      var host = global.document.getElementById("mc-pdp-option-block");
      if (host && wrap.parentNode !== host) {
        try {
          host.appendChild(wrap);
        } catch (eHost) {}
      } else if (ctx.select.parentNode && wrap.parentNode !== ctx.select.parentNode) {
        try {
          ctx.select.insertAdjacentElement("afterend", wrap);
        } catch (eIns) {
          ctx.select.parentNode.appendChild(wrap);
        }
      } else if (ctx.select.nextSibling !== wrap) {
        try {
          ctx.select.insertAdjacentElement("afterend", wrap);
        } catch (eMv) {}
      }
    }
    return wrap;
  }

  function findConfiguredColorSelectedEntry(ctx) {
    if (!ctx || !ctx.select || !ctx.entries) return null;
    if (configuredColorActiveEntry && global.__MC_CONFIGURED_COLOR_USER_PICKED__) {
      var locked = resolveConfiguredColorEntry(ctx, configuredColorActiveEntry.optionId);
      if (locked) return locked;
    }
    return readConfiguredColorSelectEntry(ctx);
  }

  function resolveDisplayedColorEntry(ctx) {
    if (configuredColorActiveEntry) return configuredColorActiveEntry;
    return findConfiguredColorSelectedEntry(ctx);
  }

  function syncConfiguredColorSwatchUi(ctx, applyPhoto, forcePhoto) {
    if (!ctx) return;
    var selected = resolveDisplayedColorEntry(ctx);
    updateConfiguredColorLabels(selected);
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (wrap) {
      wrap.querySelectorAll(".mc-configured-color-swatch").forEach(function (btn) {
        var active = !!selected && btn.getAttribute("data-option-id") === selected.optionId;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    if (applyPhoto && selected) {
      if (
        forcePhoto ||
        selected.optionId !== configuredColorLastAppliedOptionId ||
        !configuredColorActiveSrc
      ) {
        applyConfiguredColorMainPhoto(
          selected.mainImage,
          selected.label,
          resolveConfiguredColorProductCode(ctx)
        );
        configuredColorLastAppliedOptionId = selected.optionId;
      }
    }
  }

  function bindConfiguredColorSwatchSelect(select) {
    if (!select || select.dataset.mcConfiguredColorBound === "1") return;
    select.dataset.mcConfiguredColorBound = "1";
    select.addEventListener("change", function () {
      if (select.dataset.mcConfiguredColorSyncing === "1") return;
      var ctx = findConfiguredColorSwatchContext();
      if (!ctx || ctx.select !== select) return;
      if (
        configuredColorActiveEntry &&
        global.__MC_CONFIGURED_COLOR_USER_PICKED__
      ) {
        var fromSelect = readConfiguredColorSelectEntry(ctx);
        if (
          fromSelect &&
          fromSelect.optionId !== configuredColorActiveEntry.optionId
        ) {
          reassertConfiguredColorActiveSelection(ctx, true);
          return;
        }
      }
      var entry = readConfiguredColorSelectEntry(ctx);
      if (entry) applyConfiguredColorSelection(ctx, entry, true);
    });
  }

  function selectConfiguredColorByOptionId(optionId) {
    if (!optionId) return false;
    var ctx = findConfiguredColorSwatchContext();
    if (!ctx) return false;
    var entry = resolveConfiguredColorEntry(ctx, optionId);
    if (!entry) return false;
    return applyConfiguredColorSelection(ctx, entry, true);
  }

  function handleConfiguredColorSwatchClick(btn) {
    if (!btn) return;
    selectConfiguredColorByOptionId(btn.getAttribute("data-option-id"));
  }

  function ensureConfiguredColorSwatches() {
    var ctx = findConfiguredColorSwatchContext();
    if (isSaranoniPdpPage()) dedupeSaranoniConfiguredColorSwatchWrappers();
    var wrap = getConfiguredColorSwatchWrapper();
    if (!ctx) {
      if (wrap && wrap.parentNode) {
        try {
          wrap.parentNode.removeChild(wrap);
        } catch (eRm) {}
      }
      return;
    }
    var productCode = resolveConfiguredColorProductCode(ctx);
    resetConfiguredColorStateForProduct(productCode);
    bindConfiguredColorHeroGuard(productCode);
    renderConfiguredColorSwatches(ctx);
    bindConfiguredColorSwatchSelect(ctx.select);
    restoreConfiguredColorActiveEntry(ctx);
    if (!configuredColorDefaultSrc) {
      var hero = global.document.getElementById("product_photo");
      var heroSrc = hero ? hero.getAttribute("src") || "" : "";
      if (heroSrc && heroSrc.indexOf("/manufacturers/") === -1) configuredColorDefaultSrc = heroSrc;
    }
    // Saranoni: keep category/default hero until shopper picks a color swatch.
    var applyInitialPhoto =
      !global.__MC_CONFIGURED_COLOR_INIT__ &&
      !!configuredColorActiveEntry &&
      (!isSaranoniPdpPage() || !!global.__MC_CONFIGURED_COLOR_USER_PICKED__);
    syncConfiguredColorSwatchUi(ctx, applyInitialPhoto);
    if (!global.__MC_CONFIGURED_COLOR_INIT__) global.__MC_CONFIGURED_COLOR_INIT__ = true;
    if (
      isSaranoniPdpPage() &&
      productCode &&
      !global.__MC_CONFIGURED_COLOR_USER_PICKED__ &&
      !configuredColorActiveEntry
    ) {
      loadProductScopedColorImage(productCode, productCode + "-2T.jpg", function (resolved) {
        if (!resolved || global.__MC_CONFIGURED_COLOR_USER_PICKED__) return;
        configuredColorDefaultSrc = resolved;
        setConfiguredColorPhotoSrc(resolved, "", productCode);
      });
    }
    if (isSaranoniPdpPage()) {
      hideSaranoniHeroAltviews();
      removeSaranoniDuplicateColorPicker();
      scheduleSaranoniLayoutPass(false);
    }
  }

  function looksLikePrimaryColorOptionsTable(table) {
    if (!table || !table.querySelector) return false;
    if (!table.querySelector("select")) return false;
    var txt = String(table.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return /(choose color|selected color|color\*|color:|cover|choose cover)/.test(txt);
  }

  function findPrimaryOptionMountNode() {
    if (!isProductPdp()) return null;
    if (isSectionalPdpPage()) return null;
    var beanbag = global.document.getElementById("beanbag-swatch-wrapper");
    if (beanbag) return null;
    var configured = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (configured) return configured;
    var table =
      global.document.getElementById("options_table") ||
      global.document.querySelector("#v65-product-parent table[id*='options_table']") ||
      global.document.querySelector("table[id*='options_table']");
    if (isSaranoniPdpPage() && looksLikeSaranoniSizeOptionsTable(table)) return table;
    if (looksLikePrimaryColorOptionsTable(table)) return table;
    return null;
  }

  function shouldUseDescriptionBelowFeaturesLayout() {
    // Unified layout for every standard product PDP: title/price, then options
    // (if any), then features, then description, with the qty+ATC purchase stack
    // centered below. Sectional PDPs own their own layout.
    if (!isProductPdp()) return false;
    if (isSectionalPdpPage()) return false;
    // Mahjong House keeps its complete description and specifications in
    // separate accordion panels; it must never create the desktop-only,
    // image-height-clamped description block.
    if (isMahjongHousePdpPage()) return false;
    return true;
  }

  function mountPrimaryOptionBlock() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage()) return;
    if (isPdpLayoutMounted()) return;
    var node = findPrimaryOptionMountNode();
    if (!node) return;
    var col = findPdpHeroColumnTd();
    if (!col) return;
    var host = global.document.getElementById("mc-pdp-option-block");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-option-block";
      host.className = "mc-pdp-option-block";
    }
    var features = global.document.getElementById("mc-pdp-features");
    var heroStack = global.document.getElementById("mc-pdp-hero-stack");
    if (isSaranoniPdpPage()) {
      if (node.parentNode !== host) {
        try {
          host.appendChild(node);
        } catch (eSarNode) {}
      }
      return;
    }
    var targetParent = (features && features.parentNode) || heroStack || col;
    if (host.parentNode !== targetParent) {
      try {
        targetParent.appendChild(host);
      } catch (eHost) {}
    }
    if (node.parentNode !== host) {
      try {
        host.appendChild(node);
      } catch (eNode) {}
    }
    var desc = global.document.getElementById("mc-pdp-description-below-features");
    var beforeNode = desc || features;
    if (beforeNode && host.parentNode === beforeNode.parentNode && host !== beforeNode) {
      if (host.nextElementSibling !== beforeNode) {
        try {
          host.parentNode.insertBefore(host, beforeNode);
        } catch (ePos) {}
      }
    } else if (features && host.parentNode === features.parentNode && host.nextElementSibling !== features) {
      try {
        host.parentNode.insertBefore(host, features);
      } catch (ePosFeat) {}
    }
  }

  function mountBeanBagSwatchesAboveFeatures() {
    if (!isProductPdp()) return;
    if (!isBeanBagPdpPage() && !global.document.getElementById("beanbag-swatch-wrapper")) return;
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.setAttribute("data-mc-beanbag-swatches", "1");
    wrap.dataset.moved = "1";
    var labelWrap = global.document.getElementById("beanbag-selected-cover");
    if (labelWrap) {
      try {
        labelWrap.style.setProperty("display", "block", "important");
      } catch (eLab) {}
    }
    try {
      wrap.style.setProperty("width", "100%", "important");
      wrap.style.setProperty("max-width", "440px", "important");
      wrap.style.setProperty("margin", "12px 0 8px 0", "important");
      wrap.style.setProperty("padding", "0 0 0 1.1em", "important");
      wrap.style.setProperty("display", "block", "important");
      wrap.style.setProperty("clear", "both", "important");
      wrap.style.setProperty("text-align", "left", "important");
    } catch (eWrap) {}
  }

  function withMoPaused(fn) {
    global.__MC_PDP_MO_PAUSE__ = (global.__MC_PDP_MO_PAUSE__ || 0) + 1;
    try {
      fn();
    } catch (eFn) {}
    var release = function () {
      global.__MC_PDP_MO_PAUSE__ = Math.max(0, (global.__MC_PDP_MO_PAUSE__ || 1) - 1);
    };
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(release);
    } else {
      release();
    }
  }

  function tagHeroMediaCol() {
    if (isSaranoniPdpPage()) return;
    var opt = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (!opt) return;
    if (!opt.classList.contains("mc-pdp-options-td")) {
      opt.classList.add("mc-pdp-options-td");
    }
    var media = opt.previousElementSibling;
    if (media && media.tagName === "TD") {
      media.classList.add("mc-pdp-hero-media-col", "mc-pdp-media-td");
    }
  }

  function hideUniformQty() {
    var root = global.document.getElementById("v65-product-parent") || global.document;
    root
      .querySelectorAll(
        'input.v65-productdetail-cartqty, input[name^="QTY."], input[name="QTY"], input[name="quantity"]'
      )
      .forEach(function (q) {
        if (q.closest("#mc-pdp-price-atc-row")) return;
        try {
          q.style.setProperty("position", "absolute", "important");
          q.style.setProperty("width", "1px", "important");
          q.style.setProperty("height", "1px", "important");
          q.style.setProperty("overflow", "hidden", "important");
          q.style.setProperty("clip", "rect(0 0 0 0)", "important");
          q.style.setProperty("opacity", "0", "important");
          q.style.setProperty("pointer-events", "none", "important");
        } catch (eQ) {}
      });
    var qr = global.document.getElementById("mc-pdp-qty-row");
    if (qr && qr.parentNode) {
      try {
        qr.parentNode.removeChild(qr);
      } catch (eRm) {}
    }
    try {
      hideVolusionQuantityRows();
    } catch (eVol) {}
  }

  function ensureBeanBagPriceAtcRow() {
    if (!isBeanBagPdpPage()) return null;
    var col = findPdpHeroColumnTd();
    if (!col) return null;
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    if (!price) return null;
    var target = resolveAtcPurchaseTarget();
    var atc = target ? target.wrap : null;
    var row = global.document.getElementById("mc-pdp-price-atc-row");
    if (!row) {
      row = global.document.createElement("div");
      row.id = "mc-pdp-price-atc-row";
      row.className = "mc-pdp-price-atc-row";
    }
    if (!col.contains(row)) {
      try {
        col.appendChild(row);
      } catch (eC) {}
    }
    if (price.parentNode !== row) {
      try {
        row.insertBefore(price, row.firstChild);
      } catch (eP) {}
    }
    if (atc && atc.parentNode !== row) {
      try {
        row.appendChild(atc);
      } catch (eA) {}
    }
    if (atc && price.nextElementSibling !== atc && price.parentNode === row && atc.parentNode === row) {
      try {
        row.insertBefore(price, atc);
      } catch (eO) {}
    }
    return row;
  }

  function mountDescriptionBelowFeatures() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage()) return;
    if (!shouldUseDescriptionBelowFeaturesLayout()) return;
    if (
      isPdpLayoutMounted() &&
      !isUnifiedAccordionPdp()
    ) {
      return;
    }
    var col = findPdpHeroColumnTd();
    if (!col) {
      col = global.document.querySelector("td.mc-unified-pdp-info, td.mc-pdp-options-td");
    }
    if (col && isNestedAtcInfoCell(col)) {
      col = findVolProductRightColumn() || findPdpHeroColumnTd();
    }
    if (!col) return;
    var descDiv =
      global.document.getElementById("ProductDetail_ProductDetails_div") ||
      global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (isMahjongHousePdpPage() && !descDiv) {
      descDiv = findMahjongDescriptionSource();
    }
    if (!descDiv) return;
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-below-features";
      host.className = "mc-pdp-description-below-features";
    }
    if (isSaranoniPdpPage() || isMahjongHousePdpPage()) {
      if (descDiv.parentNode !== host) {
        try {
          var sarBox = descDiv.closest("table.colors_descriptionbox");
          descDiv.querySelectorAll("script").forEach(function (s) {
            try {
              s.remove();
            } catch (eS) {}
          });
          host.appendChild(descDiv);
          if (sarBox && !sarBox.contains(descDiv)) {
            sarBox.setAttribute("data-mc-empty-desc", "1");
          }
          var sarAltBox = global.document.getElementById("ProductDetail_ProductDetails_div2");
          if (sarAltBox && sarAltBox !== descDiv && !sarAltBox.contains(descDiv)) {
            var sarAltWrap = sarAltBox.closest("table.colors_descriptionbox");
            if (sarAltWrap && !sarAltWrap.contains(descDiv)) {
              sarAltWrap.setAttribute("data-mc-empty-desc", "1");
            }
          }
          var sarHdr = global.document.getElementById("Header_ProductDetail_ProductDetails");
          if (sarHdr) sarHdr.setAttribute("data-mc-empty-desc", "1");
        } catch (eSarDesc) {}
      }
      try {
        host.style.setProperty("width", "100%", "important");
        host.style.setProperty(
          "max-width",
          isMahjongHousePdpPage() ? "100%" : "460px",
          "important"
        );
        host.style.setProperty("margin", "10px 0 0 0", "important");
        host.style.setProperty(
          "padding",
          isMahjongHousePdpPage() ? "0" : "0 0 0 1.1em",
          "important"
        );
        host.style.setProperty("box-sizing", "border-box", "important");
        host.style.setProperty("text-align", "left", "important");
        host.style.setProperty("overflow", "visible", "important");
      } catch (eHostStyle) {}
      if (host.parentNode !== col && !host.closest("#mc-pdp-accordion")) {
        try {
          col.appendChild(host);
        } catch (eSarHost) {}
      }
      try {
        hideNativeVolusionTabPanels();
      } catch (eSarHide) {}
      ensureDescriptionBelowFeaturesInner(host);
      syncPdpDescriptionViewMore();
      try {
        ensureSaranoniPdpAccordion();
        repairGenericAccordionProductDetails();
      } catch (eSarAccDesc) {}
      if (isMahjongHousePdpPage()) {
        applyMahjongHouseInfoColumnOrder(col);
      }
      return;
    }
    if (!col.contains(host)) {
      try {
        var swatchAnchor =
          global.document.getElementById("beanbag-swatch-wrapper") ||
          global.document.getElementById("mc-configured-color-swatch-wrapper");
        var featuresBlockForDesc = global.document.getElementById("mc-pdp-features");
        var optAnchor = global.document.getElementById("mc-pdp-option-block");
        var purchaseAnchor =
          global.document.querySelector(".mc-unified-purchase-controls") ||
          global.document.getElementById("mc-pdp-purchase-stack");
        if (isSteveSilverPdpPage() && purchaseAnchor && purchaseAnchor.parentNode === col) {
          col.insertBefore(host, purchaseAnchor);
        } else if (swatchAnchor && swatchAnchor.parentNode === col) {
          insertNodeAfter(col, swatchAnchor, host);
        } else if (featuresBlockForDesc && featuresBlockForDesc.parentNode === col) {
          insertNodeAfter(col, featuresBlockForDesc, host);
        } else if (optAnchor && optAnchor.parentNode === col) {
          insertNodeAfter(col, optAnchor, host);
        } else {
          col.appendChild(host);
        }
      } catch (eH) {}
    }
    if (col && host.parentNode !== col) {
      try {
        var purchaseMove =
          global.document.querySelector(".mc-unified-purchase-controls") ||
          global.document.getElementById("mc-pdp-purchase-stack");
        if (isSteveSilverPdpPage() && purchaseMove && purchaseMove.parentNode === col) {
          col.insertBefore(host, purchaseMove);
        } else {
          col.appendChild(host);
        }
      } catch (eMoveHost) {}
    }
    try {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "460px", "important");
      host.style.setProperty("margin", "10px 0 0 0", "important");
      host.style.setProperty("padding", "0 0 0 1.1em", "important");
      host.style.setProperty("box-sizing", "border-box", "important");
      host.style.setProperty("text-align", "left", "important");
    } catch (eHostStyle) {}
    if (descDiv.parentNode !== host) {
      try {
        var box = descDiv.closest("table.colors_descriptionbox");
        descDiv.querySelectorAll("script").forEach(function (s) {
          try {
            s.remove();
          } catch (eS) {}
        });
        host.appendChild(descDiv);
        if (box && !box.contains(descDiv)) {
          box.setAttribute("data-mc-empty-desc", "1");
        }
        var altBox = global.document.getElementById("ProductDetail_ProductDetails_div2");
        if (altBox && altBox !== descDiv && !altBox.contains(descDiv)) {
          var altWrap = altBox.closest("table.colors_descriptionbox");
          if (altWrap && !altWrap.contains(descDiv)) {
            altWrap.setAttribute("data-mc-empty-desc", "1");
          }
        }
        var hdr = global.document.getElementById("Header_ProductDetail_ProductDetails");
        if (hdr) hdr.setAttribute("data-mc-empty-desc", "1");
      } catch (eMove) {}
    }
    try {
      descDiv.style.setProperty("width", "100%", "important");
      descDiv.style.setProperty("max-width", "100%", "important");
      descDiv.style.setProperty("margin", "0", "important");
      descDiv.style.setProperty("padding", "0", "important");
      descDiv.style.setProperty("text-align", "left", "important");
      descDiv.style.setProperty("line-height", "1.65", "important");
    } catch (eDescStyle) {}
    try {
      pruneDescriptionDuplicateFeatures();
    } catch (ePrune) {}
    ensureDescriptionBelowFeaturesInner(host);
    syncPdpDescriptionViewMore();
    try {
      hideNativeVolusionTabPanels();
    } catch (eDescHide) {}
  }

  function repositionDescriptionViewMoreToggle(host) {
    if (!host) return;
    var toggle = host.querySelector(":scope > .mc-pdp-description-view-more");
    if (toggle) host.appendChild(toggle);
  }

  function ensureDescriptionBelowFeaturesInner(host) {
    if (!host) return null;
    var inner = host.querySelector(":scope > .mc-pdp-description-below-features__inner");
    if (!inner) {
      inner = global.document.createElement("div");
      inner.className = "mc-pdp-description-below-features__inner";
      var child;
      while ((child = host.firstElementChild)) {
        if (child.classList && child.classList.contains("mc-pdp-description-view-more")) break;
        inner.appendChild(child);
      }
      if (inner.childNodes.length) {
        var toggleBefore = host.querySelector(":scope > .mc-pdp-description-view-more");
        if (toggleBefore) host.insertBefore(inner, toggleBefore);
        else host.appendChild(inner);
      }
    } else {
      var stray;
      while ((stray = host.firstElementChild)) {
        if (stray === inner) break;
        if (stray.classList && stray.classList.contains("mc-pdp-description-view-more")) break;
        inner.appendChild(stray);
      }
    }
    repositionDescriptionViewMoreToggle(host);
    return inner.childNodes.length ? inner : null;
  }

  function clearDescriptionViewMoreClamp(host) {
    if (!host) return;
    var inner = host.querySelector(":scope > .mc-pdp-description-below-features__inner") || host;
    host.classList.remove("mc-pdp-description-below-features--clamped");
    host.classList.remove("mc-pdp-description-below-features--expanded");
    try {
      inner.style.removeProperty("max-height");
      inner.style.removeProperty("overflow");
    } catch (eClear) {}
    var toggle = host.querySelector(".mc-pdp-description-view-more");
    if (toggle) toggle.style.setProperty("display", "none", "important");
  }

  function findPdpDescriptionClampImage() {
    return (
      global.document.getElementById("product_photo") ||
      global.document.querySelector(
        "td.mc-unified-pdp-media img#product_photo, td.mc-pdp-media-td img#product_photo, img#main-image"
      )
    );
  }

  function applyDescriptionViewMoreClamp(host, img) {
    if (!host || !img) return;
    var inner = ensureDescriptionBelowFeaturesInner(host);
    if (!inner || !String(inner.textContent || "").replace(/\s+/g, " ").trim()) return;
    var toggle = host.querySelector(".mc-pdp-description-view-more");
    if (!toggle) {
      toggle = global.document.createElement("button");
      toggle.type = "button";
      toggle.className = "mc-pdp-description-view-more";
      toggle.textContent = "View more";
      toggle.addEventListener("click", function () {
        var expanded = host.classList.toggle("mc-pdp-description-below-features--expanded");
        toggle.textContent = expanded ? "View less" : "View more";
        if (expanded) {
          inner.style.removeProperty("max-height");
          inner.style.removeProperty("overflow");
          host.classList.remove("mc-pdp-description-below-features--clamped");
        } else {
          applyDescriptionViewMoreClamp(host, findPdpDescriptionClampImage());
        }
      });
      host.appendChild(toggle);
    }
    repositionDescriptionViewMoreToggle(host);
    if (host.classList.contains("mc-pdp-description-below-features--expanded")) return;

    var imgRect = img.getBoundingClientRect();
    var hostRect = host.getBoundingClientRect();
    var toggleHeight = toggle.offsetHeight || 28;
    var maxHeight = Math.floor(imgRect.bottom - hostRect.top - toggleHeight - 8);
    if (maxHeight < 72) maxHeight = 72;

    try {
      inner.style.removeProperty("max-height");
      inner.style.removeProperty("overflow");
    } catch (eMeasure) {}
    var fullHeight = inner.scrollHeight;

    if (fullHeight <= maxHeight) {
      clearDescriptionViewMoreClamp(host);
      return;
    }

    host.classList.add("mc-pdp-description-below-features--clamped");
    host.classList.remove("mc-pdp-description-below-features--expanded");
    try {
      inner.style.setProperty("max-height", maxHeight + "px", "important");
      inner.style.setProperty("overflow", "hidden", "important");
      toggle.style.setProperty("display", "inline-block", "important");
    } catch (eClamp) {}
  }

  /* Some native Steve Silver records expose an otherwise empty media-description
     shell. The shared clamp then leaves its lone "View more" control beneath the
     hero. Remove only shells whose complete rendered text is exactly that label;
     real product descriptions remain untouched. */
  function removeStrayMediaViewMore() {
    if (!isProductPdp()) return;
    var normalize = function (value) {
      return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    };
    global.document
      .querySelectorAll(
        "td.mc-unified-pdp-media .mc-unified-pdp-description--media, td.mc-pdp-media-td .mc-unified-pdp-description--media"
      )
      .forEach(function (shell) {
        if (normalize(shell.textContent) === "view more") {
          try {
            shell.remove();
          } catch (eRemoveShell) {}
        }
      });
    global.document
      .querySelectorAll(
        "td.mc-unified-pdp-media .mc-pdp-description-view-more, td.mc-pdp-media-td .mc-pdp-description-view-more"
      )
      .forEach(function (toggle) {
        if (normalize(toggle.textContent) === "view more") {
          try {
            toggle.remove();
          } catch (eRemoveToggle) {}
        }
      });
  }

  function syncPdpDescriptionViewMore() {
    removeStrayMediaViewMore();
    if (isMahjongHousePdpPage()) {
      clearDescriptionViewMoreClamp(
        global.document.getElementById("mc-pdp-description-below-features")
      );
      return;
    }
    if (!shouldUseDescriptionBelowFeaturesLayout()) return;
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host || !String(host.textContent || "").replace(/\s+/g, " ").trim()) return;
    var isDesktop = global.matchMedia && global.matchMedia("(min-width: 992px)").matches;
    if (!isDesktop) {
      clearDescriptionViewMoreClamp(host);
      return;
    }
    var img = findPdpDescriptionClampImage();
    if (!img) return;
    if (img.complete === false) {
      if (img.dataset.mcDescClampBound !== "1") {
        img.dataset.mcDescClampBound = "1";
        img.addEventListener("load", function () {
          syncPdpDescriptionViewMore();
        });
      }
      return;
    }
    applyDescriptionViewMoreClamp(host, img);
  }

  function installDescriptionViewMoreResize() {
    if (global.__MC_DESC_VIEW_MORE_RESIZE__ === VERSION) return;
    global.__MC_DESC_VIEW_MORE_RESIZE__ = VERSION;
    var timer = null;
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = global.setTimeout(function () {
        timer = null;
        try {
          syncPdpDescriptionViewMore();
        } catch (eSync) {}
      }, 120);
    }
    global.addEventListener("resize", schedule);
    global.addEventListener("load", schedule);
  }

  function extractSwatchesIntoCol() {
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.setAttribute("data-mc-beanbag-swatches", "1");
    wrap.dataset.moved = "1";
    var col = findPdpHeroColumnTd();
    var features = global.document.getElementById("mc-pdp-features");
    if (col && wrap.parentNode !== col) {
      try {
        if (features && features.parentNode === col) col.insertBefore(wrap, features);
        else col.appendChild(wrap);
      } catch (eMove) {}
    } else if (col && features && features.parentNode === col && wrap.nextElementSibling !== features) {
      try {
        col.insertBefore(wrap, features);
      } catch (eOrd) {}
    }
    var labelWrap = global.document.getElementById("beanbag-selected-cover");
    if (labelWrap) {
      try {
        labelWrap.style.setProperty("display", "block", "important");
      } catch (eLab) {}
    }
  }

  function ensureBeanBagPurchaseStack() {
    if (!isProductPdp()) return null;
    if (!isBeanBagPdpPage()) return null;
    var col = findPdpHeroColumnTd();
    if (!col) return null;
    var purchaseTarget = resolveAtcPurchaseTarget(global.document);
    if (!purchaseTarget || !purchaseTarget.stackNode) return null;
    var stackNode = purchaseTarget.stackNode;
    try {
      stackNode.style.setProperty("display", "flex", "important");
      stackNode.style.setProperty("visibility", "visible", "important");
      stackNode.style.setProperty("opacity", "1", "important");
      stackNode.style.setProperty("width", "100%", "important");
      stackNode.style.setProperty("max-width", "100%", "important");
      stackNode.style.setProperty("height", "auto", "important");
      stackNode.style.setProperty("max-height", "none", "important");
      stackNode.style.setProperty("overflow", "visible", "important");
    } catch (eNodeShow) {}
    var unified = col.querySelector(".mc-unified-purchase-controls");
    if (unified) {
      try {
        unified.style.setProperty("display", "flex", "important");
        unified.style.setProperty("visibility", "visible", "important");
        unified.style.setProperty("opacity", "1", "important");
        unified.style.setProperty("width", "100%", "important");
        unified.style.setProperty("max-width", "435px", "important");
        unified.style.setProperty("height", "auto", "important");
        unified.style.setProperty("max-height", "none", "important");
        unified.style.setProperty("overflow", "visible", "important");
        unified.removeAttribute("aria-hidden");
      } catch (eUnified) {}
      var qtyRowUnified = global.document.getElementById("mc-pdp-qty-row");
      applySoftGoodsColumnPurchaseStackLayout(unified, qtyRowUnified, stackNode);
      fixAddToCartChrome();
      return unified;
    }
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    if (!stack) {
      stack = global.document.createElement("div");
      stack.id = "mc-pdp-purchase-stack";
    }
    stack.className = "mc-pdp-purchase-stack mc-pdp-purchase-controls mc-pdp-cart-row";
    if (!stack.contains(stackNode)) stack.appendChild(stackNode);
    if (stack.parentNode !== col) {
      try {
        col.appendChild(stack);
      } catch (eStack) {}
    }
    try {
      stack.style.setProperty("display", "flex", "important");
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("flex-wrap", "nowrap", "important");
      stack.style.setProperty("align-items", "stretch", "important");
      stack.style.setProperty("justify-content", "flex-start", "important");
      stack.style.setProperty("text-align", "center", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "435px", "important");
      stack.style.setProperty("margin", "18px auto 0 auto", "important");
      stack.style.setProperty("padding", "0", "important");
      stack.style.setProperty("gap", "10px", "important");
      stack.style.setProperty("clear", "both", "important");
      stack.style.setProperty("visibility", "visible", "important");
      stack.style.setProperty("opacity", "1", "important");
      stack.style.setProperty("height", "auto", "important");
      stack.style.setProperty("max-height", "none", "important");
      stack.style.setProperty("overflow", "visible", "important");
    } catch (eStyle) {}
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    if (qtyRow && !stack.contains(qtyRow)) {
      try {
        stack.insertBefore(qtyRow, stackNode);
      } catch (eQty) {}
    }
    applySoftGoodsColumnPurchaseStackLayout(stack, qtyRow, stackNode);
    fixAddToCartChrome();
    return stack;
  }

  function styleBeanBagPriceAtc() {
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    if (price) {
      price.style.setProperty("display", "block", "important");
      price.style.setProperty("width", "100%", "important");
      price.style.setProperty("max-width", "450px", "important");
      price.style.setProperty("margin", "4px 0 10px 0", "important");
      price.style.setProperty("padding", "0 0 0 1.1em", "important");
      price.style.setProperty("box-sizing", "border-box", "important");
    }
    var messaging = global.document.getElementById("messaging-element");
    if (messaging) {
      messaging.style.setProperty("margin", "0 0 14px 0", "important");
      messaging.style.setProperty("padding", "0 0 0 1.1em", "important");
      messaging.style.setProperty("box-sizing", "border-box", "important");
    }
    var row = global.document.getElementById("mc-pdp-price-atc-row");
    if (row) row.style.setProperty("display", "none", "important");
    applySoftGoodsColumnPurchaseStackLayout(
      global.document.getElementById("mc-pdp-purchase-stack"),
      global.document.getElementById("mc-pdp-qty-row"),
      resolveAtcPurchaseTarget() ? resolveAtcPurchaseTarget().stackNode : null
    );
  }

  function hideLegacyBeanBagPrice() {
    // The clean price now lives in #mc-pdp-price-atc-row; hide the duplicate
    // legacy Volusion price so it does not show at the top of the column.
    global.document
      .querySelectorAll("#v65-product-parent .colors_pricebox .product_productprice")
      .forEach(function (el) {
        if (el.closest("#mc-pdp-price-atc-row")) return;
        try {
          el.style.setProperty("display", "none", "important");
        } catch (ePr) {}
      });
  }

  function patchBeanBagPdp() {
    if (!isProductPdp()) return;
    if (!isBeanBagPdpPage() && !global.document.getElementById("beanbag-swatch-wrapper")) return;
    // Bean bags use the SAME general two-column layout as every other product
    // (built once per runPatch via mountPdpFeaturesBlock / mountDescriptionBelow-
    // Features / ensureQuantityAboveAtc / ensurePurchaseStackCentered). The only
    // bean-bag-specific work left here is hiding the duplicate legacy price and
    // placing the cover swatches above the Features block. We must NOT build a
    // second "hero stack" ordering: buildBeanBagStack() pulled #mc-pdp-features
    // into #mc-pdp-hero-stack while mountPdpFeaturesBlock() pulled it back into
    // the options column on every pass, which made the page bounce indefinitely.
    // Swatch CLICKS are owned solely by the single delegated handler embedded in
    // the product description — no handler is registered here.
    withMoPaused(function () {
      hideLegacyBeanBagPrice();
      mountBeanBagSwatchesAboveFeatures();
      extractSwatchesIntoCol();
      markBeanBagCoverSwatchesReady();
    });
  }

  global.ensureSteveSilverHeroImageSize = ensureSteveSilverHeroImageSize;
  global.ensureSteveSilverHeroPhotoSrc = ensureSteveSilverHeroPhotoSrc;
  global.ensurePdpAccordionVisible = ensurePdpAccordionVisible;
  global.mcMountPdpFeaturesBlock = mountPdpFeaturesBlock;
  global.mcHideNativeVolusionTabPanels = hideNativeVolusionTabPanels;
  global.mcMountDescriptionBelowFeatures = mountDescriptionBelowFeatures;
  global.mcIsUnifiedAccordionPdp = isUnifiedAccordionPdp;
  global.mcFinalizeUnifiedPdpAccordion = finalizeUnifiedPdpAccordion;
  global.mcForceCanonicalUnifiedInfoColumnOrder = forceCanonicalUnifiedInfoColumnOrder;
  global.mcIsGenericUnifiedFurnitureAccordionPdp = isGenericUnifiedFurnitureAccordionPdp;
  global.mcFinalizeGenericFurniturePdpAccordion = finalizeGenericFurniturePdpAccordion;
  global.mcRepairGenericAccordionProductDetails = repairGenericAccordionProductDetails;
  global.mcAppendSteveSilverInfoColumnOrder = appendSteveSilverInfoColumnOrder;
  global.mcAppendMahjongHouseInfoColumnOrder = appendMahjongHouseInfoColumnOrder;
  global.mcEnsureMahjongHousePdpCorrections = ensureMahjongHousePdpCorrections;
  global.mcSyncPdpDescriptionViewMore = syncPdpDescriptionViewMore;
  global.mcMountBeanBagSwatchesAboveFeatures = mountBeanBagSwatchesAboveFeatures;
  global.mcAppendBeanBagInfoColumnOrder = appendBeanBagInfoColumnOrder;
  global.mcHideBeanBagNativeOptionsTable = hideBeanBagNativeOptionsTable;
  global.mcEnsureBeanBagMediaStack = function (main, alt) {
    if (!main) {
      main =
        global.document.getElementById("product_photo") ||
        global.document.querySelector("img#main-image, #v65-product-parent img#product_photo");
    }
    if (!alt) {
      alt =
        global.document.getElementById("altviews") ||
        global.document.querySelector("#content_area .altviews, #v65-product-parent .altviews");
    }
    if (main && alt) ensureBeanBagMediaStack(main, alt);
  };
  global.mcReassertBeanBagHeroMedia = function () {
    if (!isBeanBagPdpPage()) return;
    moveAltViewsUnderMainImage();
    sanitizeBeanBagAltviews();
  };
  global.mcEnsureHeroColumnOrder = ensureHeroColumnOrder;
  global.mcRelocateVariantSwatchesFromMediaColumn = relocateVariantSwatchesFromMediaColumn;

  function findOrCreatePriceStackHost() {
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-price-stack-host";
      host.className = "mc-pdp-price-stack-host";
      host.setAttribute("data-mc-pdp-stack-host", "1");
    }
    placePriceStackHost(host);
    try {
      host.style.setProperty("display", "flex", "important");
      host.style.setProperty("flex-direction", "column", "important");
      host.style.setProperty("gap", "6px", "important");
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "100%", "important");
      host.style.setProperty("margin", "12px 0", "important");
      host.style.setProperty("position", "static", "important");
      host.style.setProperty("visibility", "visible", "important");
      host.style.setProperty("opacity", "1", "important");
      host.style.setProperty("clear", "both", "important");
    } catch (eHost) {}
    return host;
  }

  function readRetailAmountForStack() {
    var fromRow = global.document.querySelector(
      ".mc-pdp-retail-row .mc-pdp-stack-retail-amt, .mc-pdp-retail-row .product_list_price, .mc-pdp-retail-row font.product_list_price"
    );
    if (fromRow) {
      var a = parseMoney(fromRow.textContent || "");
      if (a > 0) return a;
    }
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (box) {
      var pp = box.querySelector(".product_productprice, .product_list_price");
      if (pp) {
        a = parseMoney(pp.textContent || "");
        if (a > 0) return a;
      }
      var re = /\$[\d,]+(?:\.\d{2})?/g;
      var m;
      var text = box.textContent || "";
      var best = 0;
      while ((m = re.exec(text)) !== null) {
        var v = parseMoney(m[0]);
        if (v > best) best = v;
      }
      if (best > 0) return best;
    }
    return readRetailAmountForSale();
  }

  function isGuestPdp() {
    try {
      if (global.document.body && global.document.body.classList.contains("mc-member-logged-in")) {
        return false;
      }
      if (global.sessionStorage.getItem("mc_recent_member_auth")) return false;
    } catch (eGuest) {}
    return true;
  }

  function buildStackHostHtml(retailAmt, saleAmt, guest) {
    var showAmt = retailAmt > 0 ? retailAmt : saleAmt;
    if (!(showAmt > 0)) return "";
    /* Hero column: single price line beneath title (member/retail labels live elsewhere). */
    return (
      '<div class="mc-pdp-retail-row mc-pdp-hero-price-row">' +
      '<div class="mc-pdp-retail-line"><span class="mc-pdp-stack-retail-amt">' +
      fmtMoney(showAmt) +
      "</span></div></div>"
    );
  }

  function hideAllStrayPdpPriceNodes(host) {
    var sel =
      "#v65-product-parent .colors_pricebox .mc-pdp-retail-row, #v65-product-parent .colors_pricebox .mc-pdp-member-pricing, " +
      "#v65-product-parent .colors_pricebox > .mc-pdp-member-line, #v65-product-parent .colors_pricebox .mc-member-price-caption, " +
      "#v65-product-parent .colors_pricebox .product_saleprice, #v65-product-parent .colors_pricebox .product_sale_price, " +
      "#v65-product-parent .colors_pricebox .product_productprice, #v65-product-parent .colors_pricebox > font.product_sale_price, " +
      ".mc-member-price-caption";
    global.document.querySelectorAll(sel).forEach(function (node) {
      if (!node || (host && host.contains(node))) return;
      if (isCanonicalPricingEl(node)) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
      } catch (eHide) {}
    });
    global.document
      .querySelectorAll(
        "#v65-product-parent .mc-pdp-member-line, #content_area .mc-pdp-member-line, #v65-product-parent .mc-pdp-retail-row"
      )
      .forEach(function (node) {
        if (!node || (host && host.contains(node))) return;
        if (isCanonicalPricingEl(node)) return;
        try {
          node.style.setProperty("display", "none", "important");
        } catch (eLoose) {}
      });
  }

  function prunePriceStackHost(host) {
    if (!host) return;
    host.querySelectorAll(
      ".product_saleprice, .product_sale_price, .product_productprice, font.product_sale_price, .mc-member-price-caption"
    ).forEach(function (node) {
      try {
        node.remove();
      } catch (eRm) {}
    });
    host.querySelectorAll(".mtl-product-price-block").forEach(function (pb) {
      try {
        while (pb.firstChild) {
          host.insertBefore(pb.firstChild, pb);
        }
        pb.remove();
      } catch (eUnwrap) {}
    });
    var retailRows = host.querySelectorAll(".mc-pdp-retail-row");
    var ri;
    for (ri = 1; ri < retailRows.length; ri++) {
      try {
        retailRows[ri].remove();
      } catch (eRr) {}
    }
    var row = host.querySelector(".mc-pdp-retail-row");
    if (row) {
      var labels = row.querySelectorAll(".mc-pdp-retail-label");
      var li;
      for (li = 1; li < labels.length; li++) {
        try {
          labels[li].remove();
        } catch (eLbl) {}
      }
    }
    var wraps = host.querySelectorAll(".mc-pdp-member-pricing");
    for (ri = 1; ri < wraps.length; ri++) {
      try {
        wraps[ri].remove();
      } catch (eWrap) {}
    }
    var wrap = host.querySelector(".mc-pdp-member-pricing");
    if (wrap) {
      var locked = wrap.querySelectorAll(".mc-pdp-member-line--locked");
      for (li = 1; li < locked.length; li++) {
        try {
          locked[li].remove();
        } catch (eLock) {}
      }
      var sales = wrap.querySelectorAll(".mc-pdp-member-line--sale");
      for (li = 1; li < sales.length; li++) {
        try {
          sales[li].remove();
        } catch (eSale) {}
      }
    }
    host.querySelectorAll(":scope > .mc-pdp-member-line").forEach(function (node) {
      try {
        node.remove();
      } catch (eLoose) {}
    });
  }

  function forceRebuildCleanPriceStack() {
    if (!isProductPdp()) return;
    /* Closeout/SS often get mc-pdp-unified-ready before a price host exists.
       Only skip rebuild when the host is already present. */
    if (
      isUnifiedPdpReady() &&
      global.document.getElementById("mc-pdp-price-stack-host") &&
      !isCloseoutPdpPage()
    ) {
      return;
    }
    if (isPalliserPdpPage()) return;
    if (isSectionalPdpPage() && !isFixedSectionalUnifiedPdp()) return;
    if (global.document.getElementById("mc-pdp-top-price-panel") || global.__MTL_OWNS_TOP_PRICE__) return;
    if (global.__MTL_TOP_PRICE_MOUNT_GAVE_UP__) return;
    ensurePdpStackCriticalCss();
    var retailAmt = readRetailAmountForStack();
    if (!(retailAmt > 0)) return;
    var saleAmt = resolvePdpSaleAmount();
    if (!(saleAmt > 0)) saleAmt = retailAmt;
    var guest = isGuestPdp();
    var host = findOrCreatePriceStackHost();
    if (!host) return;
    var sig = String(retailAmt) + "|" + String(saleAmt) + "|" + (guest ? "g" : "m");
    if (host.getAttribute("data-mc-stack-sig") === sig) {
      // Price unchanged — skip innerHTML rebuild so the price display never flashes.
      // Still run placement and hiding passes below in case the DOM shifted.
    } else {
      host.innerHTML = buildStackHostHtml(retailAmt, saleAmt, guest);
      host.setAttribute("data-mc-stack-sig", sig);
    }
    host.setAttribute("data-mc-stack-owned", "1");
    prunePriceStackHost(host);
    placePriceStackHost(host);
    hideAllStrayPdpPriceNodes(host);
    hideDuplicatePdpPriceUi();
    // Never move #messaging-element — Stripe has mounted into it and any DOM
    // repositioning triggers network calls to r.stripe.com.  Just ensure its
    // inline visibility is clear so nothing accidentally hides it.
    var bnplVis = global.document.getElementById("messaging-element");
    if (bnplVis) {
      try {
        bnplVis.style.removeProperty("display");
        bnplVis.style.removeProperty("visibility");
        bnplVis.style.removeProperty("opacity");
        bnplVis.style.removeProperty("height");
      } catch (eBnplVis) {}
    }
    if (!isPdpLayoutMounted()) {
      if (global.document.documentElement.dataset.mcPdpNormalized !== "1") {
        if (!isBeanBagPdpPage() && !isSaranoniPdpPage()) {
          ensureHeroColumnOrder();
        }
      }
      mountPdpFeaturesBlock();
    }
    try {
      global.document.body.classList.add("mc-pdp-price-stack");
    } catch (eCls) {}
    if (isSaranoniPdpPage()) {
      markSaranoniPdpReady();
    }
    global.__MC_PDP_STACK_FORCE__ = "20260531a";
  }

  global.mcForceRebuildCleanPriceStack = forceRebuildCleanPriceStack;

  function consolidatePdpPriceStackHost() {
    forceRebuildCleanPriceStack();
  }

  function ensureMemberPricingWrap() {
    var wrap = global.document.querySelector(".mc-pdp-member-pricing");
    if (wrap) return wrap;
    var root =
      global.document.getElementById("v65-product-parent") ||
      global.document.getElementById("content_area");
    if (!root) return null;
    var lines = root.querySelectorAll(".mc-pdp-member-line");
    if (!lines.length) return null;
    wrap = global.document.createElement("div");
    wrap.className = "mc-pdp-member-pricing";
    var first = lines[0];
    if (!first || !first.parentNode) return null;
    first.parentNode.insertBefore(wrap, first);
    var i;
    for (i = 0; i < lines.length; i++) {
      if (lines[i].parentNode !== wrap) wrap.appendChild(lines[i]);
    }
    return wrap;
  }

  function hideMainPriceboxNativeSale() {
    if (!global.document.querySelector(".mc-pdp-retail-row")) return;
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box || !box.querySelectorAll) return;
    box.querySelectorAll(".product_saleprice, .product_sale_price, font.product_sale_price").forEach(function (node) {
      if (!node || (node.closest && node.closest(".mc-pdp-member-line--sale"))) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
      } catch (eBox) {}
    });
    box.querySelectorAll("b, font.pricecolor, font.colors_productprice").forEach(function (wrapEl) {
      if (!wrapEl || (wrapEl.closest && wrapEl.closest(".mc-pdp-member-line"))) return;
      if (
        wrapEl.querySelector(".product_saleprice, .product_sale_price") &&
        !wrapEl.querySelector(".mc-pdp-member-line")
      ) {
        try {
          wrapEl.style.setProperty("display", "none", "important");
          wrapEl.style.setProperty("visibility", "hidden", "important");
          wrapEl.style.setProperty("height", "0", "important");
          wrapEl.style.setProperty("overflow", "hidden", "important");
          wrapEl.style.setProperty("opacity", "0", "important");
        } catch (eWrap) {}
      }
    });
    if (global.document.querySelector(".mc-pdp-retail-row")) {
      box.querySelectorAll(".product_productprice").forEach(function (node) {
        if (!node || (node.closest && node.closest(".mc-pdp-retail-row"))) return;
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
          node.style.setProperty("height", "0", "important");
          node.style.setProperty("opacity", "0", "important");
        } catch (ePp) {}
      });
      box.querySelectorAll("font.text.colors_text, font.colors_text").forEach(function (fontEl) {
        if (!fontEl || (fontEl.closest && fontEl.closest(".mc-pdp-retail-row, .mc-pdp-member-line"))) return;
        if (fontEl.querySelector(".product_productprice")) {
          try {
            fontEl.style.setProperty("display", "none", "important");
            fontEl.style.setProperty("visibility", "hidden", "important");
            fontEl.style.setProperty("height", "0", "important");
            fontEl.style.setProperty("overflow", "hidden", "important");
            fontEl.style.setProperty("opacity", "0", "important");
          } catch (eFont) {}
        }
      });
    }
  }

  function ensureMcCabeRetailStack() {
    if (!isProductPdp()) return;
    if (global.document.getElementById("mc-pdp-price-stack-host")) return;
    if (
      !global.document.querySelector(".mc-pdp-retail-row") &&
      typeof global.mcRenderRetailMemberOnPdp === "function"
    ) {
      try {
        global.mcRenderRetailMemberOnPdp();
      } catch (eRender) {}
    }
  }

  function hideStrayPriceRowsOutsideTopPanel() {
    var top = global.document.getElementById("mc-pdp-top-price-panel");
    var root =
      global.document.getElementById("v65-product-parent") ||
      global.document.getElementById("content_area");
    if (!root) return;
    root.querySelectorAll(".mc-pdp-retail-row, .mc-pdp-member-pricing").forEach(function (node) {
      if (!node || (top && top.contains && top.contains(node))) return;
      if (isCanonicalPricingEl(node)) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eHide) {}
    });
  }

  // OptionID → image filename for Faux Fur Bean Bag covers.
  // Source: Volusion product data. Do not infer by position or text guessing.
  var BB_COVER_IMAGE_BY_OPTION_ID = {
    "799": "https://cordaroys.com/cdn/shop/files/FC-FUR-NV.jpg?v=1763914701",
    "801": "https://cordaroys.com/cdn/shop/files/FC-FUR-PK.jpg?v=1763914701",
    "803": "https://cordaroys.com/cdn/shop/files/FC-FUR-COW.jpg?v=1763914701",
    "805": "https://cordaroys.com/cdn/shop/files/FC-FUR-TN.jpg?v=1762183620",
    "807": "https://cordaroys.com/cdn/shop/files/FC-FUR-WH.jpg?v=1762183620",
    "809": "https://cordaroys.com/cdn/shop/files/FC-FUR-GR.jpg?v=1762183620",
    "811": "https://cordaroys.com/cdn/shop/files/FC-FUR-BK.jpg?v=1762183620"
  };
  var BB_COVER_ASSET_BY_LABEL = {
    "faux fur|pink": ["https://cordaroys.com/cdn/shop/files/FC-FUR-PK.jpg?v=1763914701", "https://cordaroys.com/cdn/shop/files/faux-fur-pink.jpg?v=1759932371&width=80"],
    "faux fur|navy": ["https://cordaroys.com/cdn/shop/files/FC-FUR-NV.jpg?v=1763914701", "https://cordaroys.com/cdn/shop/files/faux-fur-navy.jpg?v=1759932371&width=80"],
    "faux fur|gray": ["https://cordaroys.com/cdn/shop/files/FC-FUR-GR.jpg?v=1762183620", "https://cordaroys.com/cdn/shop/files/faux-fur-gray.jpg?v=1759932371&width=80"],
    "faux fur|grey": ["https://cordaroys.com/cdn/shop/files/FC-FUR-GR.jpg?v=1762183620", "https://cordaroys.com/cdn/shop/files/faux-fur-gray.jpg?v=1759932371&width=80"],
    "faux fur|cow": ["https://cordaroys.com/cdn/shop/files/FC-FUR-COW.jpg?v=1763914701", "https://cordaroys.com/cdn/shop/files/faux-fur-cow.jpg?v=1759932371&width=80"],
    "faux fur|tan": ["https://cordaroys.com/cdn/shop/files/FC-FUR-TN.jpg?v=1762183620", "https://cordaroys.com/cdn/shop/files/faux-fur-tan.jpg?v=1759932371&width=80"],
    "faux fur|black": ["https://cordaroys.com/cdn/shop/files/FC-FUR-BK.jpg?v=1762183620", "https://cordaroys.com/cdn/shop/files/faux-fur-black.jpg?v=1759932371&width=80"],
    "faux fur|white": ["https://cordaroys.com/cdn/shop/files/FC-FUR-WH.jpg?v=1762183620", "https://cordaroys.com/cdn/shop/files/faux-fur-white.jpg?v=1759932371&width=80"],
    "chenille|charcoal": ["https://cordaroys.com/cdn/shop/files/FC-CH-CH.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-charcoal.jpg?v=1759932371&width=80"],
    "chenille|navy": ["https://cordaroys.com/cdn/shop/files/FC-CH-NV.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-navy.jpg?v=1759932371&width=80"],
    "chenille|espresso": ["https://cordaroys.com/cdn/shop/files/FC-CH-EX.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-espresso.jpg?v=1759932370&width=80"],
    "chenille|very peri": ["https://cordaroys.com/cdn/shop/files/FC-CH-VP.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-very-peri-purple.jpg?v=1759932371&width=80"],
    "chenille|tan": ["https://cordaroys.com/cdn/shop/files/FC-CH-TN.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-tan.jpg?v=1759932370&width=80"],
    "chenille|rainforest": ["https://cordaroys.com/cdn/shop/files/FC-CH-RF.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-rainforest.jpg?v=1759932371&width=80"],
    "chenille|moss": ["https://cordaroys.com/cdn/shop/files/FC-CH-MO.jpg?v=1769458046", "https://cordaroys.com/cdn/shop/files/chenille-moss.jpg?v=1759932370&width=80"]
  };

  function bbCoverAsset(label) {
    var normalized = String(label || "").toLowerCase().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    var color = normalized.split("/").pop().replace(/^faux fur\s+/i, "").replace(/^chenille\s+/i, "").trim();
    var codeEl = global.document.querySelector('input[name="ProductCode"],input[name="productcode"]');
    var code = String(global.global_Current_ProductCode || (codeEl && codeEl.value) || "");
    var family = /chenille/i.test(normalized) || /CHENILLE/i.test(code) ? "chenille" : "faux fur";
    var pair = BB_COVER_ASSET_BY_LABEL[family + "|" + color];
    return pair ? { hero: pair[0], thumb: pair[1] } : null;
  }
  global.__MC_BB_COVER_ASSET__ = bbCoverAsset;

  function initBeanBagImageSync() {
    if (!isBeanBagPdpPage()) return;
    if (global.document.documentElement.dataset.mcBbImgBound === "1") return;
    global.document.documentElement.dataset.mcBbImgBound = "1";
    var activeBbImageFile = "";

    function normalizeBbLabel(str) {
      return String(str || "")
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function beanBagSwatchLabel(swatch) {
      if (!swatch) return "";
      return (
        swatch.getAttribute("data-option") ||
        swatch.getAttribute("aria-label") ||
        swatch.getAttribute("title") ||
        (swatch.querySelector("img") ? swatch.querySelector("img").getAttribute("alt") : "") ||
        swatch.textContent ||
        ""
      );
    }

    function bbColorFromSwatchLabel(label) {
      var normalized = normalizeBbLabel(label);
      if (!normalized) return "";
      var parts = normalized.split("/");
      return (parts.length > 1 ? parts[parts.length - 1] : normalized).trim();
    }

    function bbImageForSwatchLabel(label) {
      var asset = bbCoverAsset(label);
      return asset ? asset.hero : null;
    }

    function applyBbImage(imgFile) {
      var mainImg = global.document.getElementById("product_photo");
      if (!mainImg) return;
      activeBbImageFile = imgFile;
      var targetSrc = /^(?:https?:)?\/\//i.test(imgFile) ? imgFile : "/v/vspfiles/images/" + imgFile;
      try {
        if (mainImg.getAttribute("src") !== targetSrc) mainImg.src = targetSrc;
        // A stale srcset lets the browser re-pick the previous cover; remove it.
        if (mainImg.hasAttribute("srcset")) mainImg.removeAttribute("srcset");
        mainImg.style.setProperty("opacity", "1", "important");
      } catch (eSet) {}
      // Point both Volusion zoom-link variants at the selected cover full image.
      ["product_photo_zoom_url", "product_photo_zoom_url2"].forEach(function (id) {
        var lnk = global.document.getElementById(id);
        if (lnk) {
          try { lnk.href = targetSrc; } catch (eZm) {}
        }
      });
      // Re-register the new image with Volusion's zoom plugin if present, so the
      // magnifier shows the chosen cover instead of the original photo.
      try {
        if (global.vZoom && typeof global.vZoom.add === "function") {
          global.vZoom.add(mainImg, targetSrc);
        }
      } catch (eVz) {}
      // Clear any "selected" styling on alternate thumbnails so none conflicts.
      try {
        global.document
          .querySelectorAll("#altviews a, #altviews img, a[id^='alternate_product_photo']")
          .forEach(function (t) {
            if (t.classList) t.classList.remove("active", "selected");
          });
      } catch (eAlt) {}
    }

    function reassertBbImageOnce(imgFile) {
      var mainImg = global.document.getElementById("product_photo");
      if (!mainImg) return;
      if (mainImg && typeof global.MutationObserver === "function") {
        var bbObs = new global.MutationObserver(function (mutations, obs) {
          var src = mainImg.getAttribute("src") || "";
          if (src !== imgFile && src !== imgFile.replace(/^https:/, "")) {
            applyBbImage(imgFile);
          }
          obs.disconnect();
        });
        bbObs.observe(mainImg, { attributes: true, attributeFilter: ["src"] });
        global.setTimeout(function () { try { bbObs.disconnect(); } catch (e) {} }, 2000);
      } else {
        global.setTimeout(function () { applyBbImage(imgFile); }, 600);
      }
    }

    function scheduleBbImageLock(imgFile) {
      [60, 180, 450, 900, 1600, 2800, 5000].forEach(function (ms) {
        global.setTimeout(function () {
          if (activeBbImageFile === imgFile) applyBbImage(imgFile);
        }, ms);
      });
    }

    function selectCoverByLabel(label) {
      var target = bbColorFromSwatchLabel(label) || normalizeBbLabel(label);
      var coverSel =
        global.document.querySelector("#options_table select[name*='___4']") ||
        global.document.querySelector("select[name*='___4']") ||
        global.document.querySelector("#options_table select");
      var imgFile = bbImageForSwatchLabel(label);
      var optVal = "";
      if (coverSel && coverSel.options && coverSel.options.length) {
        var foundIndex = -1;
        var i;
        for (i = 0; i < coverSel.options.length; i++) {
          var optText = normalizeBbLabel(coverSel.options[i].text);
          var optColor = bbColorFromSwatchLabel(coverSel.options[i].text) || optText;
          if (optColor === target || optText === target || optText.indexOf(target) >= 0) {
            foundIndex = i;
            break;
          }
        }
        if (foundIndex >= 0) {
          coverSel.selectedIndex = foundIndex;
          coverSel.value = coverSel.options[foundIndex].value;
          optVal = String(coverSel.options[foundIndex].value || "");
          imgFile = BB_COVER_IMAGE_BY_OPTION_ID[optVal] || imgFile;
        }
      }
      return { coverSel: coverSel, imgFile: imgFile, optVal: optVal };
    }

    // Capture phase so this runs before legacy inline swatch scripts baked into product HTML.
    global.document.addEventListener("click", function (eBb) {
      var swatch = eBb.target && eBb.target.closest ? eBb.target.closest(".beanbag-swatch") : null;
      if (!swatch) return;
      var label = beanBagSwatchLabel(swatch);
      var selected = selectCoverByLabel(label);
      var coverSel = selected.coverSel;
      var imgFile = selected.imgFile;
      var optVal = selected.optVal;

      if (!imgFile) return;

      if (coverSel && optVal) {
        if (typeof global.change_option === "function") {
          try {
            global.change_option(coverSel.name, optVal);
          } catch (eCo) {}
        }
        if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
          try {
            global.AutoUpdatePriceWithSelectedOptions(optVal, 4);
          } catch (eAu) {}
        }
        try {
          coverSel.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (eIn) {}
        try {
          coverSel.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (eCh) {}
      }

      var labelSpan = global.document.getElementById("beanbag-selected-cover-name");
      if (labelSpan) {
        try {
          labelSpan.textContent = label;
        } catch (eLbl) {}
      }

      global.document.querySelectorAll(".beanbag-swatch").forEach(function (node) {
        try {
          node.classList.remove("active");
        } catch (eRm) {}
      });
      try {
        swatch.classList.add("active");
      } catch (eAct) {}

      applyBbImage(imgFile);
      reassertBbImageOnce(imgFile);
      scheduleBbImageLock(imgFile);
    }, true);

    global.document.addEventListener("change", function (eBbChange) {
      var sel = eBbChange.target;
      if (!sel || !sel.matches || !sel.matches("select")) return;
      if (!sel.matches("#options_table select[name*='___4'], select[name*='___4']")) return;
      var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      var imgFile = BB_COVER_IMAGE_BY_OPTION_ID[String(sel.value || "")] || bbImageForSwatchLabel(opt ? opt.text : "");
      if (!imgFile) return;
      applyBbImage(imgFile);
      reassertBbImageOnce(imgFile);
      scheduleBbImageLock(imgFile);
    }, true);
  }

  function initSaranoniImageSync() {
    if (!isSaranoniPdpPage()) return;
    if (global.document.documentElement.dataset.mcSarImgBound === "1") return;
    global.document.documentElement.dataset.mcSarImgBound = "1";

    global.document.addEventListener(
      "change",
      function (eSarSel) {
        if (!isSaranoniPdpPage()) return;
        var sel = eSarSel.target;
        if (!sel || !sel.matches || !sel.matches("select")) return;
        if (!isSaranoniColorSelect(sel)) return;
        var ctx = findConfiguredColorSwatchContext();
        if (!ctx || ctx.select !== sel) return;
        if (sel.dataset.mcConfiguredColorSyncing === "1") return;
        var entry = readConfiguredColorSelectEntry(ctx);
        if (entry) {
          lockConfiguredColorActiveEntry(entry);
          syncConfiguredColorSwatchUi(ctx, true);
          removeSaranoniDuplicateColorPicker();
          finalizeSaranoniInfoColumnOrder();
        }
      },
      true
    );
  }

  // Bean-bag size option (category 58): keep the native select visible + functional,
  // give it a "CHOOSE SIZE" label, and make sure size changes drive Volusion pricing.
  function ensureBeanBagSizeRow() {
    if (!isBeanBagPdpPage()) return;
    var sizeSel =
      global.document.querySelector("#options_table select[name*='___58']") ||
      global.document.querySelector("select[name*='___58']");
    if (!sizeSel) {
      var sels = global.document.querySelectorAll("#options_table select, #v65-product-parent select, #content_area select");
      for (var s = 0; s < sels.length; s++) {
        var hasSize = false;
        for (var o = 0; o < sels[s].options.length; o++) {
          if (/\b(king|queen|full)\b/i.test(sels[s].options[o].text || "")) {
            hasSize = true;
            break;
          }
        }
        if (hasSize) {
          sizeSel = sels[s];
          break;
        }
      }
    }
    if (!sizeSel) return;

    try {
      sizeSel.style.removeProperty("display");
      sizeSel.style.setProperty("display", "inline-block", "important");
    } catch (eShow) {}
    var sizeRow = sizeSel.closest ? sizeSel.closest("tr") : null;
    if (sizeRow) {
      try {
        sizeRow.style.setProperty("display", "table-row", "important");
      } catch (eRow) {}
    }

    if (!global.document.getElementById("mc-bb-size-label")) {
      var lbl = global.document.createElement("div");
      lbl.id = "mc-bb-size-label";
      lbl.className = "mc-bb-size-label";
      lbl.textContent = "CHOOSE SIZE";
      try {
        sizeSel.insertAdjacentElement("beforebegin", lbl);
      } catch (eLbl) {}
    }

    var sizeSection = global.document.getElementById("mc-bb-size-section");
    if (!sizeSection) {
      sizeSection = global.document.createElement("div");
      sizeSection.id = "mc-bb-size-section";
      sizeSection.className = "mc-bb-size-section";
    }
    var sizeLabel = global.document.getElementById("mc-bb-size-label");
    if (sizeLabel && sizeLabel.parentNode !== sizeSection) {
      try {
        sizeSection.appendChild(sizeLabel);
      } catch (eLblSec) {}
    }
    if (!sizeSection.contains(sizeSel)) {
      try {
        sizeSection.appendChild(sizeSel);
      } catch (eSelSec) {}
    }
    var col = findPdpHeroColumnTd();
    if (col && sizeSection.parentNode !== col) {
      try {
        var swatches = global.document.getElementById("beanbag-swatch-wrapper");
        var features = global.document.getElementById("mc-pdp-features");
        if (swatches && swatches.parentNode === col) {
          col.insertBefore(sizeSection, swatches);
        } else if (features && features.parentNode === col) {
          col.insertBefore(sizeSection, features);
        } else {
          col.appendChild(sizeSection);
        }
      } catch (eAttach) {}
    }
    try {
      sizeSection.style.setProperty("display", "block", "important");
      sizeSection.style.setProperty("visibility", "visible", "important");
      sizeSection.style.setProperty("width", "100%", "important");
      sizeSection.style.setProperty("max-width", "440px", "important");
      sizeSection.style.setProperty("margin", "12px 0 10px 0", "important");
      sizeSel.style.setProperty("display", "inline-block", "important");
      sizeSel.style.setProperty("visibility", "visible", "important");
      sizeSel.style.setProperty("opacity", "1", "important");
    } catch (eSecStyle) {}

    if (sizeSel.dataset.mcBbSizeBound !== "1") {
      sizeSel.dataset.mcBbSizeBound = "1";
      sizeSel.addEventListener("change", function () {
        var v = sizeSel.value;
        if (typeof global.change_option === "function") {
          try {
            global.change_option(sizeSel.name, v);
          } catch (eCo) {}
        }
        if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
          try {
            global.AutoUpdatePriceWithSelectedOptions(v, 58);
          } catch (eAu) {}
        }
        try {
          sizeSel.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (eIn) {}
        try {
          ensureBeanBagKingCoverRestriction();
        } catch (eKing) {}
      });
    }
    try {
      ensureBeanBagKingCoverRestriction();
    } catch (eKingInit) {}
    try {
      hideBeanBagNativeOptionsTable();
    } catch (eHideNative) {}
  }

  // Pink (801) and Navy (799) covers are unavailable when King size is selected.
  function ensureBeanBagKingCoverRestriction() {
    if (!isBeanBagPdpPage()) return;
    var sizeSel =
      global.document.querySelector("#options_table select[name*='___58']") ||
      (function () {
        var sels = global.document.querySelectorAll("#options_table select");
        var s;
        for (s = 0; s < sels.length; s++) {
          var o;
          for (o = 0; o < sels[s].options.length; o++) {
            if (/\b(king|queen|full)\b/i.test(sels[s].options[o].text || "")) return sels[s];
          }
        }
        return null;
      })();
    if (!sizeSel || sizeSel.selectedIndex < 0) return;
    var sizeText = String(sizeSel.options[sizeSel.selectedIndex].text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    var isKing = /\bking\b/.test(sizeText);
    var kingExcludedLabels = ["faux fur / pink", "faux fur / navy"];
    var kingExcludedOptionIds = { "799": true, "801": true };
    global.document.querySelectorAll(".beanbag-swatch").forEach(function (swatch) {
      var label = String(swatch.getAttribute("data-option") || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      var hide = isKing && kingExcludedLabels.indexOf(label) !== -1;
      try {
        swatch.style.display = hide ? "none" : "";
      } catch (eDisp) {}
      if (hide && swatch.classList.contains("active")) {
        try {
          swatch.classList.remove("active");
        } catch (eRm) {}
        var nameEl = global.document.getElementById("beanbag-selected-cover-name");
        if (nameEl) nameEl.textContent = "";
      }
    });
    if (isKing) {
      var coverSel = global.document.querySelector("#options_table select[name*='___4']");
      if (coverSel && coverSel.selectedIndex >= 0) {
        var cv = String(coverSel.options[coverSel.selectedIndex].value || "");
        if (kingExcludedOptionIds[cv]) {
          coverSel.selectedIndex = 0;
          try {
            coverSel.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (eCv) {}
        }
      }
    }
  }

  function markSaranoniSwatchesReady() {
    if (!isSaranoniPdpPage()) return;
    var pickerThumb = global.document.querySelector(
      ".mc-saranoni-color-picker .mc-saranoni-color-picker__thumbs a[data-option-id]"
    );
    if (!pickerThumb) return;
    try {
      global.document.body.classList.add("mc-saranoni-swatches-ready");
    } catch (eCls) {}
  }

  function scheduleSaranoniColorRepair() {
    if (!isSaranoniPdpPage()) return;
    if (global.__MC_SAR_COLOR_REPAIR_VER__ === VERSION) return;
    global.__MC_SAR_COLOR_REPAIR_VER__ = VERSION;
    global.setTimeout(function () {
      try {
        if (isStalePdpAuthRun()) return;
        if (isSaranoniPdpPage() && global.document.body) global.document.body.classList.remove("mc-bean-bag-pdp");
        ensureSaranoniBrandLogo(); ensureSaranoniVariantUi(); hideSaranoniHeroAltviews(); removeSaranoniDuplicateColorPicker(); finalizeSaranoniInfoColumnOrder(); ensureSaranoniRailArrows(); markSaranoniPdpReady();
      } catch (eSarRepair) {}
    }, 200);
    [900, 1800, 3500].forEach(function (ms) {
      global.setTimeout(function () {
        try { if (!isSaranoniPdpPage() || isStalePdpAuthRun()) return; removeLegacySaranoniTemplatePickers(); removeSaranoniDuplicateColorPicker(); } catch (eLegacySweep) {}
      }, ms);
    });
  }

  function markBeanBagCoverSwatchesReady() {
    if (!isBeanBagPdpPage()) return;
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap || !wrap.querySelector(".beanbag-swatch")) return;
    try {
      global.document.body.classList.add("mc-bb-cover-swatches-ready");
    } catch (eCls) {}
  }

  /* Final Bean Bag-only ownership pass. Volusion leaves two submit buttons in
     the original quantity wrapper after this script moves its numeric input. */
  function finalizeBeanBagQuantityControl() {
    if (!isBeanBagPdpPage()) return;
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    var atc = stack && stack.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
    if (stack && qtyRow && atc) {
      try {
        if (qtyRow.parentNode !== stack || qtyRow.nextElementSibling !== atc) {
          stack.insertBefore(qtyRow, atc);
        }
        qtyRow.style.setProperty("display", "inline-flex", "important");
        qtyRow.style.setProperty("visibility", "visible", "important");
        qtyRow.style.setProperty("height", "48px", "important");
        qtyRow.style.setProperty("width", "100%", "important");
      } catch (eBbQtyMount) {}
    }
    global.document.querySelectorAll("#v65-product-parent .vol-cartqty__wrap").forEach(function (wrap) {
      if (wrap.closest("#mc-pdp-qty-row")) return;
      /* Once the numeric input has moved, this wrapper contains only the two
         orphaned increment/decrement buttons that show as grey boxes. */
      if (wrap.querySelector('input[name^="QTY."], input[name="QTY"], input[name="quantity"]')) return;
      try {
        wrap.style.setProperty("display", "none", "important");
        wrap.style.setProperty("visibility", "hidden", "important");
        wrap.style.setProperty("height", "0", "important");
        wrap.style.setProperty("overflow", "hidden", "important");
      } catch (eBbOrphanStepper) {}
    });
  }

  /* MC_BEANBAG_RELATED_REVEAL_20260716: the related-items section renders on
     Mahjong PDPs (revealMahjongRelated forces it visible + an observer keeps
     it that way) but there is NO equivalent on Bean Bag PDPs, so something
     leaves #related_products_content collapsed there and nothing un-collapses
     it. The live HTML has exactly ONE clean related table with 5 unique
     products (no duplicates), so a plain reveal is safe. This ONLY touches the
     two related-section elements — no ancestor walking, no dedup — so it
     cannot affect the features column or any other part of the page. */
    function hoistRelatedProductsFullWidth(relatedRoot) {
    if (!relatedRoot) return;
    if (relatedRoot.getAttribute("data-mc-related-hoisted") === "1") return;
    try {
      var host =
        global.document.getElementById("vCSS_mainform") ||
        global.document.getElementById("content_area");
      if (!host) return;
      var anchor =
        relatedRoot.closest(".vol-product__bottom") ||
        global.document.getElementById("v65-product-parent");
      if (!anchor) return;
      while (anchor.parentElement && anchor.parentElement !== host) {
        anchor = anchor.parentElement;
      }
      if (anchor && anchor.contains(relatedRoot) && relatedRoot.parentElement !== host) {
        if (anchor.nextSibling) host.insertBefore(relatedRoot, anchor.nextSibling);
        else host.appendChild(relatedRoot);
        relatedRoot.setAttribute("data-mc-related-hoisted", "1");
      }
    } catch (eHoistRel) {}
  }

    function revealSaranoniRelated() {
    if (!isSaranoniPdpPage()) return;
    var related = global.document.getElementById("related_products_content");
    var relatedRoot = global.document.getElementById("v65-product-related");
    if (!related && !relatedRoot) return;
    hoistRelatedProductsFullWidth(relatedRoot);
    /* One-shot style settle. Re-applying display/width on every saranoni layout
       pass fought CSS + related converter and bounced the rail on mobile. */
    if (
      (relatedRoot && relatedRoot.getAttribute("data-mc-saranoni-related-ready") === "1") ||
      (related && related.getAttribute("data-mc-saranoni-related-ready") === "1")
    ) {
      return;
    }
    try {
      if (related) {
        related.style.setProperty("display", "block", "important");
        related.style.setProperty("visibility", "visible", "important");
        related.style.setProperty("opacity", "1", "important");
        related.style.setProperty("height", "auto", "important");
        related.style.setProperty("max-height", "none", "important");
        related.style.setProperty("width", "100%", "important");
        related.style.setProperty("max-width", "100%", "important");
        related.style.setProperty("margin-left", "0", "important");
        related.style.setProperty("transform", "none", "important");
        related.style.setProperty("overflow", "visible", "important");
        related.setAttribute("data-mc-saranoni-related-ready", "1");
      }
      if (relatedRoot) {
        relatedRoot.style.setProperty("display", "block", "important");
        relatedRoot.style.setProperty("visibility", "visible", "important");
        relatedRoot.style.setProperty("opacity", "1", "important");
        relatedRoot.style.setProperty("width", "100%", "important");
        relatedRoot.style.setProperty("max-width", "100%", "important");
        relatedRoot.style.setProperty("margin-left", "auto", "important");
        relatedRoot.style.setProperty("margin-right", "auto", "important");
        relatedRoot.style.setProperty("padding-left", "0", "important");
        relatedRoot.style.setProperty("padding-right", "0", "important");
        relatedRoot.style.setProperty("height", "auto", "important");
        relatedRoot.style.setProperty("max-height", "none", "important");
        relatedRoot.style.setProperty("overflow", "visible", "important");
        relatedRoot.style.setProperty("transform", "none", "important");
        relatedRoot.style.setProperty("left", "auto", "important");
        relatedRoot.setAttribute("data-mc-saranoni-related-ready", "1");
      }
      var grid = (relatedRoot || related).querySelector(".mc-related-plp-grid");
      if (grid) {
        grid.style.setProperty("display", "flex", "important");
        grid.style.setProperty("visibility", "visible", "important");
        grid.style.setProperty("opacity", "1", "important");
        grid.style.setProperty("width", "100%", "important");
        grid.style.setProperty("max-width", "min(1144px, 100%)", "important");
        grid.style.setProperty("height", "auto", "important");
        grid.style.setProperty("overflow", "visible", "important");
        grid.style.setProperty("transform", "none", "important");
        grid.style.setProperty("margin-left", "auto", "important");
        grid.style.setProperty("margin-right", "auto", "important");
        grid.style.setProperty("justify-content", "center", "important");
      }
    } catch (eSarRelated) {}
  }

function revealBeanBagRelated() {
    if (!isBeanBagPdpPage()) return;
    var related = global.document.getElementById("related_products_content");
    var relatedRoot = global.document.getElementById("v65-product-related");
    if (!related && !relatedRoot) return;
    try {
      if (related) {
        related.style.setProperty("display", "table-cell", "important");
        related.style.setProperty("visibility", "visible", "important");
        related.style.setProperty("opacity", "1", "important");
        related.style.setProperty("height", "auto", "important");
        related.style.setProperty("width", "100%", "important");
      }
      if (relatedRoot) {
        relatedRoot.style.setProperty("display", "table", "important");
        relatedRoot.style.setProperty("visibility", "visible", "important");
        relatedRoot.style.setProperty("width", "100%", "important");
        relatedRoot.style.setProperty("height", "auto", "important");
      }
    } catch (eBbRelated) {}
    if (related && !related.dataset.mcBbRelatedRevealBound) {
      related.dataset.mcBbRelatedRevealBound = "1";
      try {
        var relatedObserver = new global.MutationObserver(function () {
          if (related.style.getPropertyValue("display") === "none") revealBeanBagRelated();
        });
        relatedObserver.observe(related, { attributes: true, attributeFilter: ["style"] });
      } catch (eBbRelObs) {}
    }
  }

  function scheduleBeanBagOptionRepair() {
    if (!isBeanBagPdpPage()) return;
    /* This must run even when an earlier Bean Bag initializer has already
       claimed the page; that earlier initializer hides the real quantity row. */
    global.setTimeout(finalizeBeanBagQuantityControl, 2400);
    /* MC_BEANBAG_RELATED_LATE_SWAP_20260716: the 120/600/1800ms batch below
       ends before Volusion's late related-items content swap (verified
       earlier in a controlled repro: reveals that stopped at 2800ms lost the
       race every time; retrying well past it stuck permanently). The swap can
       also REPLACE the observed cell node, killing the MutationObserver bound
       to the old node — each retry rebinds to whatever node exists then.
       Scheduled outside the version guard so it re-arms on every load. */
    [3500, 6000, 9000, 12000, 16000].forEach(function (msLate) {
      global.setTimeout(revealBeanBagRelated, msLate);
    });
    if (global.__MC_BB_OPTION_REPAIR_VER__ === VERSION) return;
    global.__MC_BB_OPTION_REPAIR_VER__ = VERSION;
    [120, 600, 1800].forEach(function (ms) {
      global.setTimeout(function () {
        try { initBeanBagImageSync(); ensureBeanBagSizeRow(); markBeanBagCoverSwatchesReady(); ensureBeanBagBrandLogo(); ensureBeanBagPdpAccordion(); appendBeanBagInfoColumnOrder(); hideBeanBagNativeOptionsTable(); sanitizeBeanBagAltviews(); applyPdpMainImageCap(); normalizeLegacyPdpInfoWrapper(); revealBeanBagRelated(); revealSaranoniRelated(); } catch (eBbRepair) {}
      }, ms);
    });
  }

  function scheduleSteveSilverLayoutRepair() {
    if (!isSteveSilverPdpPage() && !isCloseoutPdpPage()) return;
    function runCloseoutRepair() {
      try {
        markCloseoutPdpPage();
        prepareDeferredUnifiedPdpHero();
        hideNativeVolusionTabPanels();
        ensurePdpTitleInOptionsColumn();
        forceRebuildCleanPriceStack();
        mountPdpFeaturesBlock();
        mountDescriptionBelowFeatures();
        ensureSaranoniPdpAccordion();
        appendSteveSilverInfoColumnOrder();
        hideCloseoutNativePriceBoxChrome();
        ensurePdpAccordionVisible();
        syncPdpDescriptionViewMore();
        ensureUnifiedPdpLayout();
        if (typeof global.mcNormalizePdpLayout === "function") global.mcNormalizePdpLayout();
      } catch (eSsRepair) {}
    }
    if (global.__MC_SS_LAYOUT_REPAIR_VER__ !== VERSION) {
      global.__MC_SS_LAYOUT_REPAIR_VER__ = VERSION;
      runCloseoutRepair();
      [200, 800, 1800, 3500].forEach(function (ms) {
        global.setTimeout(runCloseoutRepair, ms);
      });
    }
  }

  function scheduleMahjongHouseLayoutRepair() {
    if (!isMahjongHousePdpPage()) return;
    if (!shouldDeferToUnifiedPdpLayout()) return;
    if (global.__MC_TMH_LAYOUT_REPAIR_VER__ === VERSION) return;
    global.__MC_TMH_LAYOUT_REPAIR_VER__ = VERSION;
    if (global.__MC_MAHJONG_PDP_READY__) return;
    try {
      ensureMahjongHousePdpCorrections();
      appendMahjongHouseInfoColumnOrder();
      syncPdpDescriptionViewMore();
    } catch (eTmhRepair) {}
  }

  function installPdpStackApiGuards() {
    global.mcEnsurePdpPriceStack = mcEnsurePdpPriceStack;
    global.mcForceRebuildCleanPriceStack = forceRebuildCleanPriceStack;

    if (
      typeof global.mcRenderRetailMemberOnPdp === "function" &&
      global.mcRenderRetailMemberOnPdp.__mcStackGuardVer !== VERSION
    ) {
      var origRender = global.mcRenderRetailMemberOnPdp;
      global.mcRenderRetailMemberOnPdp = function () {
        if (global.document.getElementById("mc-pdp-price-stack-host")) {
          forceRebuildCleanPriceStack();
          return Promise.resolve(true);
        }
        return origRender.apply(this, arguments);
      };
      global.mcRenderRetailMemberOnPdp.__mcStackGuardVer = VERSION;
      global.mcRenderRetailMemberOnPdp.__mcOrig = origRender;
    }

    if (typeof global.forceProductFixes === "function" && global.forceProductFixes.__mcStackWrapped !== VERSION) {
      var origFixes = global.forceProductFixes;
      global.forceProductFixes = function () {
        var out;
        try {
          out = origFixes.apply(this, arguments);
        } catch (eFix) {
          out = undefined;
        }
        try {
          if (global.document.getElementById("mc-pdp-price-stack-host")) {
            forceRebuildCleanPriceStack();
          }
        } catch (eRebuild) {}
        return out;
      };
      global.forceProductFixes.__mcStackWrapped = VERSION;
      global.forceProductFixes.__mcOrig = origFixes;
    }

    if (
      typeof global.mcRenderPdpRetailAndMember === "function" &&
      global.mcRenderPdpRetailAndMember.__mcSectionalGuard !== VERSION
    ) {
      var origPdpRender = global.mcRenderPdpRetailAndMember;
      global.mcRenderPdpRetailAndMember = function () {
        if (
          global.document.getElementById("mc-pdp-top-price-panel") ||
          global.__MTL_OWNS_TOP_PRICE__
        ) {
          hideStrayPriceRowsOutsideTopPanel();
          return true;
        }
        if (isSectionalPdpPage() && !isPalliserPdpPage()) {
          hideStrayPriceRowsOutsideTopPanel();
          return true;
        }
        return origPdpRender.apply(this, arguments);
      };
      global.mcRenderPdpRetailAndMember.__mcSectionalGuard = VERSION;
      global.mcRenderPdpRetailAndMember.__mcOrig = origPdpRender;
    }
  }

  function extractAdditionalFromOptionText(text) {
    var t = String(text || "");
    var m =
      t.match(/\[\s*Additional\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\]/i) ||
      t.match(/additional\s*\$?\s*([\d,]+(?:\.\d{2})?)/i) ||
      t.match(/\(\s*\+\s*\$?\s*([\d,]+(?:\.\d{2})?)\s*\)/i);
    return m ? parseMoney(m[1]) : 0;
  }

  function findConfigurationSelects() {
    if (typeof global.mcFindConfigurationOptionSelects === "function") {
      try {
        return global.mcFindConfigurationOptionSelects(global.document);
      } catch (eF) {}
    }
    var configSel = null;
    var seatsSel = null;
    global.document.querySelectorAll("#options_table select, #v65-product-parent select").forEach(function (sel) {
      if (sel.classList && sel.classList.contains("mc-native-leather")) return;
      var txt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : "";
      if (!configSel && /additional|sectional configuration|\d+\/\d+/i.test(String(txt))) configSel = sel;
      if (!seatsSel && /seat|straight|curved/i.test(String(txt))) seatsSel = sel;
    });
    return { configSel: configSel, seatsSel: seatsSel };
  }

  function inlineSyncConfigurationPrice() {}

  function syncConfigurationBlockPricing() {}

  function findRetailStackHost() {
    var optTd = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (optTd) {
      var optBox = optTd.querySelector(".colors_pricebox");
      if (optBox) return optBox.querySelector("td") || optBox;
      return optTd;
    }
    var boxes = global.document.querySelectorAll("#v65-product-parent .colors_pricebox");
    if (boxes.length > 1) {
      var second = boxes[boxes.length - 1];
      return second.querySelector("td") || second;
    }
    var box = global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box) return null;
    return box.querySelector("td") || box;
  }

  function hideDuplicatePdpPriceUi() {
    try {
      global.document.querySelectorAll(".mc-member-price-caption").forEach(function (cap) {
        if (!cap || !cap.style) return;
        cap.style.setProperty("display", "none", "important");
        cap.style.setProperty("visibility", "hidden", "important");
        cap.style.setProperty("height", "0", "important");
        cap.style.setProperty("overflow", "hidden", "important");
        cap.style.setProperty("opacity", "0", "important");
      });
      var sumPrice = global.document.getElementById("mtl-sum-price");
      if (sumPrice && global.document.querySelector(".mc-pdp-retail-row")) {
        var priceRow = sumPrice.closest && sumPrice.closest(".mtl-summary-row");
        if (priceRow && priceRow.style) {
          priceRow.style.setProperty("display", "none", "important");
        }
      }
      var wrap = global.document.querySelector(".mc-pdp-member-pricing");
      if (wrap) {
        var sales = wrap.querySelectorAll(".mc-pdp-member-line--sale");
        var locked = wrap.querySelectorAll(".mc-pdp-member-line--locked");
        var si;
        for (si = 1; si < sales.length; si++) {
          try {
            sales[si].remove();
          } catch (eRmSale) {}
        }
        for (si = 1; si < locked.length; si++) {
          try {
            locked[si].remove();
          } catch (eRmLock) {}
        }
      }
      global.document
        .querySelectorAll(
          "#v65-product-parent .colors_pricebox .mc-pdp-retail-row, #v65-product-parent .colors_pricebox .mc-pdp-member-pricing, #v65-product-parent .colors_pricebox > .mc-pdp-member-line, #v65-product-parent .colors_pricebox > font.product_sale_price, #v65-product-parent .colors_pricebox > .mc-member-price-caption"
        )
        .forEach(function (node) {
          if (node.closest && node.closest("#mc-pdp-price-stack-host")) return;
          if (isCanonicalPricingEl(node)) return;
          try {
            node.style.setProperty("display", "none", "important");
            node.style.setProperty("visibility", "hidden", "important");
          } catch (eLoose) {}
        });
      if (wrap) {
        wrap.querySelectorAll(".mc-pdp-member-line--sale, .mc-pdp-sale-preview").forEach(function (saleNode) {
          try {
            saleNode.style.setProperty("display", "none", "important");
            saleNode.style.setProperty("visibility", "hidden", "important");
            saleNode.style.setProperty("height", "0", "important");
            saleNode.style.setProperty("opacity", "0", "important");
          } catch (eSale) {}
        });
      }
    } catch (eHideDup) {}
  }

  function relocateRetailStackToOptionsColumn() {
    var retailRow = global.document.querySelector(".mc-pdp-retail-row");
    if (!retailRow) return;
    var host = findRetailStackHost();
    if (!host || host.contains(retailRow)) return;
    try {
      host.insertBefore(retailRow, host.firstChild || null);
    } catch (eRel) {}
    var wrap = global.document.querySelector(".mc-pdp-member-pricing");
    if (wrap && host && !host.contains(wrap)) {
      try {
        if (retailRow.nextSibling) host.insertBefore(wrap, retailRow.nextSibling);
        else host.appendChild(wrap);
      } catch (eWrap) {}
    }
  }

  function buildMinimalRetailMemberStack() {
    if (!isProductPdp()) return;
    var host = findOrCreatePriceStackHost();
    if (!host) return;
    var box =
      global.document.querySelector("#v65-product-parent td.mc-pdp-options-td .colors_pricebox") ||
      global.document.querySelector("#v65-product-parent .colors_pricebox");
    var retailAmt = 0;
    if (box) {
      var pp = box.querySelector(".product_productprice");
      if (pp) retailAmt = parseMoney(pp.textContent || "");
      if (!(retailAmt > 0)) {
        var re = /\$[\d,]+(?:\.\d{2})?/g;
        var m;
        var text = box.textContent || "";
        while ((m = re.exec(text)) !== null) {
          var v = parseMoney(m[0]);
          if (v > 0) retailAmt = Math.max(retailAmt, v);
        }
      }
    }
    if (!(retailAmt > 0)) return;
    if (!global.document.querySelector(".mc-pdp-retail-row")) {
      var row = global.document.createElement("div");
      row.className = "mc-pdp-retail-row";
      row.innerHTML =
        '<div class="mc-pdp-retail-label">Retail Price</div>' +
        '<div class="mc-pdp-retail-line"><span class="product_list_price">' +
        fmtMoney(retailAmt) +
        "</span></div>";
      host.insertBefore(row, host.firstChild);
    }
    var wrap = ensureMemberPricingWrap();
    if (wrap && !wrap.querySelector(".mc-pdp-member-line")) {
      var locked = global.document.createElement("div");
      locked.className = "mc-pdp-member-line mc-pdp-member-line--locked";
      locked.innerHTML =
        '<span class="mc-pdp-member-line__label">Member Price</span>' +
        '<span class="mc-pdp-member-line__amount"><a href="#" data-mc-open-login>Log in</a> to see member pricing</span>';
      wrap.appendChild(locked);
    }
    if (wrap) layoutMemberLines(wrap);
    forceRebuildCleanPriceStack();
    try {
      global.document.body.classList.add("mc-pdp-price-stack");
    } catch (eCls) {}
  }

  function hideNativeSaleNodes() {
    hideMainPriceboxNativeSale();
    var nodes = global.document.querySelectorAll(
      "#v65-product-parent .product_sale_price, #v65-product-parent .product_saleprice, #v65-product-parent font.product_sale_price, #v65-product-parent .colors_pricebox .product_saleprice, #v65-product-parent .colors_pricebox .product_sale_price"
    );
    nodes.forEach(function (node) {
      if (!node || (node.closest && node.closest(".mc-pdp-member-line--sale"))) return;
      if (node.closest && node.closest(".v-product-grid, .mc-related-carousel, .mc-related-plp-card")) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eH) {}
    });
  }

  function tidyLooseMemberLines() {
    var lines = global.document.querySelectorAll(
      "#v65-product-parent .mc-pdp-member-line, #content_area .mc-pdp-member-line"
    );
    lines.forEach(function (line) {
      if (!line || !line.style) return;
      line.style.setProperty("display", "flex", "important");
      line.style.setProperty("flex-direction", "column", "important");
      line.style.setProperty("align-items", "flex-start", "important");
      line.style.setProperty("gap", "2px", "important");
      line.style.setProperty("width", "100%", "important");
      line.style.setProperty("position", "static", "important");
      line.querySelectorAll(
        ".product_saleprice, .product_sale_price, font.product_sale_price, .mc-member-price-caption"
      ).forEach(function (node) {
        if (node.closest && node.closest(".mc-pdp-member-line__amount, .mc-pdp-member-line__label")) return;
        try {
          node.style.setProperty("display", "none", "important");
          node.style.setProperty("visibility", "hidden", "important");
        } catch (eT) {}
      });
    });
  }

  function layoutMemberLines(wrap) {
    if (!wrap || !wrap.querySelectorAll) return;
    wrap.querySelectorAll(".mc-pdp-member-line").forEach(function (line) {
      try {
        line.style.setProperty("display", "flex", "important");
        line.style.setProperty("flex-direction", "column", "important");
        line.style.setProperty("align-items", "flex-start", "important");
        line.style.setProperty("gap", "2px", "important");
        line.style.setProperty("width", "100%", "important");
        line.style.setProperty("position", "static", "important");
      } catch (eL) {}
    });
  }

  function mcEnsurePdpPriceStack() {
    if (!isProductPdp()) return false;
    try {
      forceRebuildCleanPriceStack();
      return !!global.document.getElementById("mc-pdp-price-stack-host");
    } catch (eStack) {
      return false;
    }
  }

  global.mcEnsurePdpPriceStack = mcEnsurePdpPriceStack;

  function openLoginModal() {
    if (typeof global.mcOpenLoginModal === "function") {
      global.mcOpenLoginModal();
      return;
    }
    global.__MC_PDP_PENDING_LOGIN_MODAL__ = true;
  }

  function openSignupModal() {
    if (typeof global.mcOpenSignupModal === "function") {
      global.mcOpenSignupModal();
      return;
    }
    global.__MC_PDP_PENDING_SIGNUP_MODAL__ = true;
  }

  /* Removed 20260630: planner login gate + room planner wiring — see archive/removed-pdp-features-20260630/ */
  function wirePlannerLoginGate() {}
  function guardConfigurationBlockClick() {}
  function patchCaptionSignInCta() {}

  function tagSoftGoodsBodyClasses() {
    try {
      var body = global.document.body;
      if (!body) return;
      if (isSaranoniPdpPage()) {
        body.classList.add("mc-saranoni-pdp");
        if (!body.classList.contains("mc-saranoni-pdp-ready")) {
          body.classList.add("mc-saranoni-pdp-init");
        }
        body.classList.remove("mc-bean-bag-pdp");
        return;
      }
      if (isMahjongHousePdpPage()) {
        body.classList.add("mc-mahjong-house-pdp");
        body.classList.remove("mc-saranoni-pdp", "mc-saranoni-pdp-init", "mc-saranoni-pdp-ready");
      }
      if (isBeanBagPdpPage()) body.classList.add("mc-bean-bag-pdp");
      if (isCordaroysExtendedPdpPage()) {
        body.classList.add("mc-cordaroys-pdp");
        body.classList.remove("mc-bean-bag-pdp");
      }
    } catch (eTag) {}
  }

  function softGoodsReturnTableColspan(table, row) {
    var max = 0;
    var rows = table.querySelectorAll("tr");
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
      var cs = 0;
      var cells = rows[ri].cells || rows[ri].querySelectorAll("td, th");
      var ci;
      for (ci = 0; ci < cells.length; ci++) {
        cs += parseInt(cells[ci].getAttribute("colspan") || "1", 10);
      }
      if (cs > max) max = cs;
    }
    return max || (row && row.cells ? row.cells.length : 2);
  }

  function findSoftGoodsProductRow() {
    var table = global.document.getElementById("v65-product-parent");
    if (!table) return null;

    var mediaTd = table.querySelector("td.mc-pdp-media-td");
    var optTd = table.querySelector("td.mc-pdp-options-td");
    if (mediaTd && optTd) {
      var sharedRow = mediaTd.closest ? mediaTd.closest("tr") : null;
      if (sharedRow && sharedRow.contains(optTd)) return sharedRow;
    }

    var rows = table.querySelectorAll("tr");
    var best = null;
    var bestScore = -1;
    var bestWidth = 0;
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var directMedia = false;
      var directOpt = false;
      var cells = row.children;
      var ci;
      for (ci = 0; ci < cells.length; ci++) {
        if (cells[ci].tagName !== "TD") continue;
        if (cells[ci].querySelector("td.mc-pdp-media-td, #product_photo, img#product_photo")) {
          directMedia = true;
        }
        if (cells[ci].querySelector("td.mc-pdp-options-td")) directOpt = true;
      }
      if (directMedia && directOpt) {
        var rwDirect = 0;
        try {
          rwDirect = row.getBoundingClientRect ? row.getBoundingClientRect().width : 0;
        } catch (eRwD) {}
        return row;
      }
      var hasMedia = !!row.querySelector("td.mc-pdp-media-td, img#product_photo, #product_photo");
      var hasOpt = !!row.querySelector("td.mc-pdp-options-td");
      if (!hasMedia && !hasOpt) continue;
      var score = (hasMedia ? 2 : 0) + (hasOpt ? 2 : 0);
      var rw = 0;
      try {
        rw = row.getBoundingClientRect ? row.getBoundingClientRect().width : 0;
      } catch (eRw) {}
      if (score > bestScore || (score === bestScore && rw > bestWidth)) {
        best = row;
        bestScore = score;
        bestWidth = rw;
      }
    }
    if (best) return best;

    var opt = table.querySelector("td.mc-pdp-options-td");
    if (opt) {
      var optRow = opt.closest ? opt.closest("tr") : null;
      if (optRow) return optRow;
    }

    var addBtn = table.querySelector(
      'input[name="btnaddtocart"], button[name="btnaddtocart"], input[id*="btnaddtocart" i]'
    );
    if (addBtn) {
      var addRow = addBtn.closest ? addBtn.closest("tr") : null;
      if (addRow) return addRow;
    }

    var photo = table.querySelector("#product_photo, img#product_photo");
    if (photo) {
      var photoRow = photo.closest ? photo.closest("tr") : null;
      if (photoRow) return photoRow;
    }

    var nameEl = table.querySelector(
      "[itemprop='name'], .productnamecolor, .colors_productname, h1"
    );
    if (nameEl) {
      var nameRow = nameEl.closest ? nameEl.closest("tr") : null;
      if (nameRow) return nameRow;
    }

    for (ri = 0; ri < rows.length; ri++) {
      if (
        rows[ri].querySelector(
          "#product_photo, [itemprop='name'], .productnamecolor, input[name='btnaddtocart']"
        )
      ) {
        return rows[ri];
      }
    }

    return rows.length ? rows[0] : null;
  }

  function tagSoftGoodsPdpCells() {
    if (!isSoftGoodsPdpPage()) return;
    var table = global.document.getElementById("v65-product-parent");
    if (!table) return;

    var photo = table.querySelector("#product_photo, img#product_photo");
    if (photo) {
      var mediaTd = photo.closest ? photo.closest("td") : null;
      if (mediaTd) mediaTd.classList.add("mc-pdp-media-td");
    }

    var optTd = table.querySelector("td.mc-pdp-options-td");
    if (!optTd) {
      var addBtn = table.querySelector(
        'input[name="btnaddtocart"], button[name="btnaddtocart"], input[id*="btnaddtocart" i]'
      );
      if (addBtn) optTd = addBtn.closest ? addBtn.closest("td") : null;
    }
    if (!optTd) {
      var sel = table.querySelector("select:not(.mc-native-leather)");
      if (sel) optTd = sel.closest ? sel.closest("td") : null;
    }
    if (optTd) optTd.classList.add("mc-pdp-options-td");

    table.querySelectorAll("tr.mc-pdp-main-row").forEach(function (row) {
      try {
        row.classList.remove("mc-pdp-main-row");
      } catch (eUnTag) {}
    });
    var mainRow = findSoftGoodsProductRow();
    if (mainRow) mainRow.classList.add("mc-pdp-main-row");
  }

  function parseBreadCrumbCategoryIds() {
    var ids = [];
    global.document.querySelectorAll("script").forEach(function (sc) {
      var m = (sc.textContent || "").match(/breadCrumb\s*=\s*["']([^"']+)["']/);
      if (!m) return;
      m[1].split("|").forEach(function (p) {
        if (p && /^\d+$/.test(p)) ids.push(p);
      });
    });
    return ids;
  }

  function lookupPdpCategoryById(catId) {
    var id = String(catId || "");
    if (!/^\d+$/.test(id)) return null;
    var sel =
      'a[href$="-s/' +
      id +
      '.htm"], a[href*="-s/' +
      id +
      '.htm"], a[href*="category-s/' +
      id +
      '.htm"]';
    var roots = [
      global.document.getElementById("display_menu_1"),
      global.document.getElementById("display_menu_2"),
      global.document.getElementById("content_area"),
      global.document.body,
    ];
    var links = [];
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      if (!roots[ri]) continue;
      roots[ri].querySelectorAll(sel).forEach(function (link) {
        if (links.indexOf(link) === -1) links.push(link);
      });
    }
    if (!links.length) {
      global.document.querySelectorAll(sel).forEach(function (link) {
        if (links.indexOf(link) === -1) links.push(link);
      });
    }
    var i;
    for (i = 0; i < links.length; i++) {
      var name = (links[i].textContent || "").replace(/\s+/g, " ").trim();
      var href = links[i].getAttribute("href") || "";
      if (!name || !href || /about us/i.test(name)) continue;
      return { name: name, href: href };
    }
    return { name: "", href: "/category-s/" + id + ".htm" };
  }

  function resolvePdpCategoryFromIds(ids, bcLinks, pc) {
    var BLOCK = { 136: true };
    var filtered = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      if (!BLOCK[ids[i]] && filtered.indexOf(ids[i]) === -1) filtered.push(ids[i]);
    }
    if (!filtered.length) return null;

    function hitForId(id) {
      var j;
      for (j = bcLinks.length - 1; j >= 0; j--) {
        var href = bcLinks[j].getAttribute("href") || "";
        if (
          href.indexOf("-s/" + id) !== -1 ||
          href.indexOf("category-s/" + id) !== -1 ||
          new RegExp("[?&]categoryid=" + id + "\\b", "i").test(href)
        ) {
          var linkName = (bcLinks[j].textContent || "").replace(/\s+/g, " ").trim();
          if (linkName) return { name: linkName, href: href };
        }
      }
      return lookupPdpCategoryById(id);
    }

    var sarLeafOrder = ["209", "208", "207", "206", "196", "205"];
    if (/^SAR/.test(pc || "")) {
      for (i = 0; i < sarLeafOrder.length; i++) {
        if (filtered.indexOf(sarLeafOrder[i]) === -1) continue;
        var sarHit = hitForId(sarLeafOrder[i]);
        if (sarHit && sarHit.name) return sarHit;
      }
    }

    for (i = filtered.length - 1; i >= 0; i--) {
      var hit = hitForId(filtered[i]);
      if (hit && hit.name) return hit;
    }
    return null;
  }

  function mcResolvePdpReturnCategory() {
    var pc = "";
    var title = "";
    var hay = "";
    try {
      pc = resolveSoftGoodsProductCode();
      title = String(
        (global.document.querySelector("[itemprop='name'], h1, .productnamecolor, .colors_productname") || {})
          .textContent || global.document.title || ""
      ).toUpperCase();
      hay = [pc, title, global.location && global.location.pathname || ""].join(" ").toUpperCase();
    } catch (eHay) {}

    if (isBeanBagPdpPage()) {
      return { name: "Bean Bags", href: "/bean-bag-seating-s/103.htm" };
    }
    if (
      /^SAR/.test(pc) &&
      /(PILLOW|PILLOWCASE|QUILT|CRIB|SHEET|DUST[\s-]*RUFFLE|KING|QUEEN|TWIN|FULL)/.test(hay)
    ) {
      return { name: "Bedding", href: "/category-s/209.htm" };
    }
    if (/^SAR/.test(pc) && /(ROBE|SNUGGLE|WEAR|BAMBONI)/.test(hay)) {
      return { name: "Snugglewear", href: "/category-s/208.htm" };
    }
    if (/^SAR/.test(pc) && /(BABY)/.test(hay)) {
      return { name: "Baby Blankets", href: "/category-s/207.htm" };
    }
    if (/^SAR/.test(pc) && /(KID|CHILD|MINI)/.test(hay)) {
      return { name: "Kids Blankets", href: "/category-s/206.htm" };
    }
    if (/^SAR/.test(pc) && /(CHAIR|SAUCER|SOCK|SWADDLE|HAT|RUG)/.test(hay)) {
      var luxeEarly = lookupPdpCategoryById("196");
      if (luxeEarly && luxeEarly.name) return luxeEarly;
      return { name: "Luxe Comforts", href: "/category-s/196.htm" };
    }

    var bcTd = global.document.querySelector(
      "#v65-product-parent .vCSS_breadcrumb_td, #content_area .vCSS_breadcrumb_td"
    );
    var bcLinks = bcTd
      ? Array.prototype.slice.call(bcTd.querySelectorAll('a[href*="-s/"], a[href*="category-s/"]'))
      : [];
    var ids = parseBreadCrumbCategoryIds();
    var fromBc = resolvePdpCategoryFromIds(ids, bcLinks, pc);
    if (fromBc) return fromBc;

    var i;
    for (i = bcLinks.length - 1; i >= 0; i--) {
      var t = (bcLinks[i].textContent || "").replace(/\s+/g, " ").trim();
      var h = bcLinks[i].getAttribute("href") || "";
      if (!t || !h || /about us/i.test(t)) continue;
      return { name: t, href: h };
    }
    if (/^SAR/.test(pc)) {
      return { name: "Adult Blankets", href: "/category-s/205.htm" };
    }
    if (ids.length) {
      var deepest = lookupPdpCategoryById(ids[ids.length - 1]);
      if (deepest && deepest.name) return deepest;
    }
    return null;
  }

  global.mcResolvePdpReturnCategory = mcResolvePdpReturnCategory;

  function resolveSoftGoodsReturnCategory() {
    var resolved = mcResolvePdpReturnCategory();
    if (resolved && resolved.name) return resolved;
    if (isBeanBagPdpPage()) {
      return { name: "Bean Bags", href: "/bean-bag-seating-s/103.htm" };
    }
    if (isSaranoniPdpPage()) {
      return { name: "Adult Blankets", href: "/category-s/205.htm" };
    }
    return null;
  }

  function ensureSaranoniVisibleReturnLink() {
    if (!isSaranoniPdpPage()) return;
    ensureSoftGoodsReturnRow();
    removeSaranoniOutsideReturnLinks();
  }

  function removeSaranoniOutsideReturnLinks() {
    if (!isSaranoniPdpPage()) return;
    global.document
      .querySelectorAll("#mc-saranoni-visible-return-link, #mc-sar-hotfix-return")
      .forEach(function (node) {
        try {
          if (node && node.parentNode) node.parentNode.removeChild(node);
        } catch (eRmSarReturn) {}
      });
  }

  function ensureSoftGoodsReturnRow() {
    if (!isSoftGoodsPdpPage()) return;
    tagSoftGoodsPdpCells();
    var cat = resolveSoftGoodsReturnCategory();
    if (!cat) return;
    var table = global.document.getElementById("v65-product-parent");
    if (!table) return;
    var mainRow = findSoftGoodsProductRow();
    if (!mainRow) return;
    var tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
    var retRow = global.document.querySelector("#v65-product-parent tr.mc-pdp-return-row");
    if (!retRow) {
      retRow = global.document.createElement("tr");
      retRow.className = "mc-pdp-return-row";
      var cell = global.document.createElement("td");
      cell.className = "mc-pdp-return-cell";
      cell.colSpan = softGoodsReturnTableColspan(table, mainRow);
      var link = global.document.createElement("a");
      link.className = "mc-pdp-return-link";
      cell.appendChild(link);
      retRow.appendChild(cell);
    }
    if (mainRow && mainRow.parentNode === tbody) {
      try {
        if (retRow.parentNode !== tbody) {
          tbody.insertBefore(retRow, mainRow);
        } else if (retRow.nextElementSibling !== mainRow) {
          tbody.insertBefore(retRow, mainRow);
        }
      } catch (eRetInsert) {}
    } else if (retRow.parentNode !== tbody) {
      try {
        tbody.insertBefore(retRow, tbody.firstChild);
      } catch (eRetFallback) {}
    }
    var cellEl = retRow.querySelector(".mc-pdp-return-cell") || retRow.querySelector("td");
    if (cellEl) cellEl.colSpan = softGoodsReturnTableColspan(table, mainRow);
    var linkEl = retRow.querySelector(".mc-pdp-return-link");
    if (linkEl) {
      linkEl.href = cat.href;
      linkEl.textContent = "\u2190 RETURN TO " + cat.name.toUpperCase();
      linkEl.setAttribute("aria-label", "Return to " + cat.name);
    }
  }

  global.ensureSoftGoodsReturnRow = ensureSoftGoodsReturnRow;

  function ensureBeanBagReturnLink() {
    if (!isBeanBagPdpPage()) return;
    ensureSoftGoodsReturnRow();
    var link = global.document.querySelector(".mc-return-category__link");
    if (!link) return;
    try {
      link.href = "/bean-bag-seating-s/103.htm";
      link.textContent = "Return to Bean Bags";
      link.setAttribute("aria-label", "Return to Bean Bags");
    } catch (eRet) {}
  }

  function reassertSoftGoodsHeroOrder() {
    if (!isSoftGoodsPdpPage()) return;
    try {
      tagHeroMediaCol();
      ensurePdpTitleInOptionsColumn();
      placeBrandLogoBelowTitle();
      ensureSoftGoodsReturnRow();
    } catch (eLogo) {}
    if (isBeanBagPdpPage()) {
      mountBeanBagSwatchesAboveFeatures();
      extractSwatchesIntoCol();
      ensureBeanBagSizeRow();
      markBeanBagCoverSwatchesReady();
      styleBeanBagPriceAtc();
      ensureBeanBagReturnLink();
      moveAltViewsUnderMainImage();
      sanitizeBeanBagAltviews();
      mountPdpFeaturesBlock();
    } else if (isCordaroysExtendedPdpPage()) {
      ensureBeanBagBrandLogo();
      moveAltViewsUnderMainImage();
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      ensureBeanBagPdpAccordion();
      repairBeanBagDesktopMainRow();
      appendBeanBagInfoColumnOrder();
      finalizeCordaroysPurchaseStack();
    } else if (isSaranoniPdpPage()) {
      ensureSaranoniPdpLayoutCss();
      ensureSaranoniBrandLogo();
      ensureSaranoniVariantOptionBlock();
      mountPdpFeaturesBlock();
      ensureSaranoniVariantUi();
      hideSaranoniHeroAltviews();
      moveAltViewsUnderMainImage();
      relocateVariantSwatchesFromMediaColumn();
      mountDescriptionBelowFeatures();
    }
    ensureQuantityAboveAtc();
    if (!isSaranoniPdpPage()) {
      ensurePurchaseStackCentered();
    }
    if (isBeanBagPdpPage()) {
      ensureBeanBagPurchaseStack();
      appendBeanBagInfoColumnOrder();
      finalizeCordaroysPurchaseStack();
    } else if (isCordaroysExtendedPdpPage()) {
      appendBeanBagInfoColumnOrder();
      finalizeCordaroysPurchaseStack();
    } else if (isSaranoniPdpPage()) {
      appendSaranoniInfoColumnOrder();
      finalizeSaranoniInfoColumnOrder();
      ensurePurchaseStackCentered();
      applySoftGoodsColumnPurchaseStackLayout(
        global.document.getElementById("mc-pdp-purchase-stack"),
        global.document.getElementById("mc-pdp-qty-row"),
        resolveAtcPurchaseTarget() ? resolveAtcPurchaseTarget().stackNode : null
      );
      finalizeSaranoniInfoColumnOrder();
    }
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (host) placePriceStackHost(host);
    if (isSaranoniPdpPage()) {
      if (!global.document.getElementById("mc-pdp-price-stack-host")) {
        forceRebuildCleanPriceStack();
      }
      hideSaranoniNativeOptionPricing();
      finalizeSaranoniInfoColumnOrder();
    }
    fixAddToCartChrome();
  }

  global.mcEnsureSoftGoodsPdpLayout = reassertSoftGoodsHeroOrder;
  global.mcFinalizeSaranoniInfoColumnOrder = finalizeSaranoniInfoColumnOrder;
  global.mcEnsureSaranoniVariantsBelowPrice = ensureSaranoniVariantsBelowPrice;

  function isPdpLayoutReady() {
    return !!global.document.querySelector(
      '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], ' +
        'input[name="btnaddtocart"], button[name="btnaddtocart"]'
    );
  }

  function mountPdpLayoutOnce() {
    if (isPdpLayoutMounted()) return false;
    if (!isProductPdp()) return false;
    if (isSectionalPdpPage()) return false;
    if (shouldDeferToUnifiedPdpLayout()) {
      prepareDeferredUnifiedPdpHero();
      ensureUnifiedPdpLayout();
      return false;
    }
    if (!isPdpLayoutReady()) return false;
    var heroLocked = !!global.__MC_PDP_HERO_READY_LOCKED__;
    try {
      tagHeroMediaCol();
      moveAltViewsUnderMainImage();
      ensurePdpTitleInOptionsColumn();
      placeBrandLogoBelowTitle();
      forceRebuildCleanPriceStack();
      if (!heroLocked && !isSoftGoodsPdpPage()) {
        ensureHeroColumnOrder();
      }
      mountPrimaryOptionBlock();
      if (isSaranoniPdpPage()) {
        ensureSaranoniVariantUi();
      } else {
        ensureConfiguredColorSwatches();
      }
      if (!isBeanBagPdpPage()) {
        mountPdpFeaturesBlock();
      }
      patchBeanBagPdp();
      mountDescriptionBelowFeatures();
      if (!isSaranoniPdpPage()) {
        ensureQuantityAboveAtc();
        ensurePurchaseStackCentered();
      }
      if (isBeanBagPdpPage()) {
        mountBeanBagSwatchesAboveFeatures();
        extractSwatchesIntoCol();
        ensureBeanBagSizeRow();
        mountPdpFeaturesBlock();
        ensureBeanBagPurchaseStack();
        appendBeanBagInfoColumnOrder();
        styleBeanBagPriceAtc();
        ensureBeanBagReturnLink();
      } else if (isSaranoniPdpPage()) {
        scheduleSaranoniLayoutPass(true);
        applySoftGoodsColumnPurchaseStackLayout(
          global.document.getElementById("mc-pdp-purchase-stack"),
          global.document.getElementById("mc-pdp-qty-row"),
          resolveAtcPurchaseTarget() ? resolveAtcPurchaseTarget().stackNode : null
        );
      } else {
        ensurePdpInfoColumnOrder();
        ensurePdpContentColumnOrder();
      }
      applyPdpTitleTypography();
      applyPdpPriceTypography();
      applyPdpDescriptionStyle();
      applyPdpMainImageCap();
      fixAddToCartChrome();
      if (!global.__MC_SOFT_GOODS_ATC_FINAL__ && isSoftGoodsPdpPage()) {
        global.__MC_SOFT_GOODS_ATC_FINAL__ = true;
        global.setTimeout(function () {
          try {
            fixAddToCartChrome();
          } catch (eAtcFinal) {}
        }, 1200);
      }
      if (!heroLocked && !isSoftGoodsPdpPage()) {
        try {
          syncPdpHeroTopAlign();
        } catch (eAlignMount) {}
      }
      scheduleMarkPdpHeroReady();
      markPdpLayoutMounted();
      if (global.__MC_PDP_LAYOUT_MO__ && typeof global.__MC_PDP_LAYOUT_MO__.disconnect === "function") {
        try {
          global.__MC_PDP_LAYOUT_MO__.disconnect();
        } catch (eMoDisc) {}
      }
      return true;
    } catch (eMountOnce) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[McCabe] mountPdpLayoutOnce", eMountOnce);
      }
      return false;
    }
  }

  function prepareDeferredUnifiedPdpHero() {
    if (!shouldDeferToUnifiedPdpLayout() && !isFixedSectionalUnifiedPdp()) return;
    try {
      tagHeroMediaCol();
      moveAltViewsUnderMainImage();
      ensurePdpTitleInOptionsColumn();
      placeBrandLogoBelowTitle();
      if (!global.document.getElementById("mc-pdp-price-stack-host")) {
        forceRebuildCleanPriceStack();
      }
      mountPdpFeaturesBlock();
      mountDescriptionBelowFeatures();
      hideNativeVolusionTabPanels();
      if (isSteveSilverPdpPage() || isCloseoutPdpPage()) {
        markCloseoutPdpPage();
        appendSteveSilverInfoColumnOrder();
      }
      syncPdpDescriptionViewMore();
      applyPdpPriceTypography();
    } catch (ePrep) {}
  }
  global.mcPrepareUnifiedPdpHero = prepareDeferredUnifiedPdpHero;

  function retryDeferredUnifiedNormalize() {
    if (!shouldDeferToUnifiedPdpLayout() && !isFixedSectionalUnifiedPdp()) return;
    function attempt() {
      try {
        if (typeof global.mcNormalizePdpLayout === "function") {
          global.mcNormalizePdpLayout();
        }
      } catch (eNorm) {}
    }
    attempt();
  }

  function ensureUnifiedPdpLayout() {
    if (isMtlSectionalConfiguratorPdp()) return;
    if (isUnifiedPdpReady() || global.__MC_UNIFIED_PDP_STABLE__) return;
    function runNorm() {
      try {
        if (typeof global.mcNormalizePdpLayout === "function") {
          return !!global.mcNormalizePdpLayout();
        }
      } catch (eNorm) {}
      return false;
    }
    if (runNorm()) return;
    if (global.__MC_UNIFIED_PDP_LOADING__) return;
    if (global.document.querySelector('script[src*="mc-unified-pdp-layout.js"]')) {
      global.setTimeout(runNorm, 150);
      return;
    }
    global.__MC_UNIFIED_PDP_LOADING__ = true;
    try {
      var s = global.document.createElement("script");
      s.src = "/v/vspfiles/js/mc-unified-pdp-layout.js?v=20260625ssaccordion1&mcrd=" + Date.now();
      s.onload = function () {
        global.__MC_UNIFIED_PDP_LOADING__ = false;
        runNorm();
      };
      s.onerror = function () {
        global.__MC_UNIFIED_PDP_LOADING__ = false;
      };
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eLoad) {
      global.__MC_UNIFIED_PDP_LOADING__ = false;
    }
  }


  function ensureBedroomCollectionSection() {
    if (global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__) return;
    if (global.__MC_BEDROOM_COLLECTION_SECTION_20260724coll1__) return;
    if (
      global.document.querySelector(
        "script[src*='mc-bedroom-collection-section.js'][src*='20260724coll1']"
      )
    ) {
      return;
    }
    try {
      global.document
        .querySelectorAll('script[src*="mc-bedroom-collection-section.js"]')
        .forEach(function (old) {
          try {
            old.remove();
          } catch (eRmBed) {}
        });
      try {
        delete global.__MC_BEDROOM_COLLECTION_SECTION_20260723mob1__;
        delete global.__MC_BEDROOM_COLLECTION_SECTION_20260620__;
      } catch (eFlagsBed) {}
      global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = true;
      var s = global.document.createElement("script");
      s.src =
        "/v/vspfiles/js/mc-bedroom-collection-section.js?v=20260724coll1&mcrd=" +
        Date.now();
      s.async = true;
      s.onload = function () {
        global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
      };
      s.onerror = function () {
        global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
      };
      (global.document.head || global.document.documentElement).appendChild(s);
    } catch (eLoadCollection) {
      global.__MC_BEDROOM_COLLECTION_SECTION_LOADING__ = false;
    }
  }
  function runPatch() {
    if (isStalePdpAuthRun()) return;
    if (!isProductPdp()) return;
    ensureBedroomCollectionSection();
    var sectional = isSectionalPdpPage();
    // Pause the MutationObserver for the duration of this patch (plus a couple of
    // animation frames) so the DOM moves/styles we apply here don't get observed
    // as "new" mutations and schedule yet another runPatch — that feedback loop is
    // what makes the PDP visibly bounce/reflow. Released on rAF after the browser
    // has applied our changes. Uses a counter so nested/overlapping runs are safe.
    global.__MC_PDP_MO_PAUSE__ = (global.__MC_PDP_MO_PAUSE__ || 0) + 1;
    var mcMoReleased = false;
    var mcReleaseMo = function () {
      if (mcMoReleased) return;
      mcMoReleased = true;
      global.__MC_PDP_MO_PAUSE__ = Math.max(0, (global.__MC_PDP_MO_PAUSE__ || 1) - 1);
    };
    if (typeof global.requestAnimationFrame === "function") {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(mcReleaseMo);
      });
    }
    // Safety net: rAF does not fire in background tabs, so guarantee the pause is
    // always released even if the frame callbacks never run.
    global.setTimeout(mcReleaseMo, 250);
    try {
      tagSoftGoodsBodyClasses();
      ensureMahjongHousePdpCorrections();
      installSaranoniColorAtcGuard();
      installPdpStackApiGuards();
      initBeanBagImageSync();
      initSaranoniImageSync();
      ensureBeanBagSizeRow();
      markBeanBagCoverSwatchesReady();
      ensurePdpStackCriticalCss();
      ensurePdpHeroCriticalCss();
      disableQuantityHiders();
      if (!sectional) {
        if (shouldDeferToUnifiedPdpLayout() || isSoftGoodsPdpPage()) {
          prepareDeferredUnifiedPdpHero();
          forceRebuildCleanPriceStack();
          ensureUnifiedPdpLayout();
          retryDeferredUnifiedNormalize();
          if (
            global.document.body &&
            !global.document.body.classList.contains("mc-pdp-unified-ready")
          ) {
            fixAddToCartChrome();
          }
          stripPriceZeroCents();
        } else if (isUnifiedPdpReady()) {
          stripPriceZeroCents();
        } else if (isPdpLayoutMounted()) {
          forceRebuildCleanPriceStack();
          if (!isSoftGoodsPdpPage()) {
            ensureUnifiedPdpLayout();
          }
          if (
            global.document.body &&
            !global.document.body.classList.contains("mc-pdp-unified-ready")
          ) {
            if (isSoftGoodsPdpPage()) {
              reassertSoftGoodsHeroOrder();
            } else {
              fixAddToCartChrome();
            }
          }
          stripPriceZeroCents();
        } else {
          if (!mountPdpLayoutOnce()) {
            forceRebuildCleanPriceStack();
          }
          if (!isSoftGoodsPdpPage()) {
            ensureUnifiedPdpLayout();
          }
          if (
            global.document.body &&
            !global.document.body.classList.contains("mc-pdp-unified-ready")
          ) {
            if (isSoftGoodsPdpPage()) {
              reassertSoftGoodsHeroOrder();
            } else {
              fixAddToCartChrome();
            }
          }
          stripPriceZeroCents();
        }
      }
      applyPdpDescriptionStyle();
      fixAddToCartChrome();
      scheduleAtcBlackLock();
      scheduleBeanBagOptionRepair();
      scheduleSaranoniColorRepair();
      markCloseoutPdpPage();
      injectPdpTopGapCss();
      scheduleSteveSilverLayoutRepair();
      scheduleMahjongHouseLayoutRepair();
      normalizeLegacyPdpInfoWrapper();
      installDescriptionViewMoreResize();
      syncPdpDescriptionViewMore();
      if (isSaranoniPdpPage()) {
        try {
          finalizeSaranoniInfoColumnOrder();
          ensureSaranoniRailArrows();
        } catch (eSarFinal) {}
      }
      if (isMahjongHousePdpPage()) {
        try {
          ensureMahjongHousePdpCorrections();
          appendMahjongHouseInfoColumnOrder();
        } catch (eTmhFinal) {}
      }
      if (!sectional && isUnifiedAccordionPdp()) {
        try {
          finalizeUnifiedPdpAccordion();
          if (isSteveSilverPdpPage() || isCloseoutPdpPage()) {
            appendSteveSilverInfoColumnOrder();
          }
          if (isMahjongHousePdpPage()) {
            appendMahjongHouseInfoColumnOrder();
          }
          if (isSaranoniPdpPage()) {
            finalizeSaranoniInfoColumnOrder();
            try { ensureSaranoniVariantsBelowPriceMobile(); } catch (eSarMob0) {}
          }
          if (isBeanBagPdpPage()) {
            appendBeanBagInfoColumnOrder();
          }
          forceCanonicalUnifiedInfoColumnOrder();
          [50, 200, 600, 1200, 2500].forEach(function (ms) {
            global.setTimeout(function () {
              try { forceCanonicalUnifiedInfoColumnOrder(); } catch (eForceLater) {}
            }, ms);
          });
        } catch (eUnifiedFinal) {}
      }
      if (shouldDeferToUnifiedPdpLayout() && !isUnifiedPdpReady()) {
        prepareDeferredUnifiedPdpHero();
        ensureUnifiedPdpLayout();
        retryDeferredUnifiedNormalize();
        try {
          if (typeof global.mcNormalizePdpLayout === "function") {
            global.mcNormalizePdpLayout();
          }
        } catch (eNormRetry) {}
      }
    } catch (eRunPatch) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[McCabe] mc-pdp-auth-cta runPatch", eRunPatch);
      }
    }
    try {
      global.document
        .querySelectorAll("#options_table select, #v65-product-parent select")
        .forEach(function (sel) {
          if (sel.dataset.mcConfigPriceBound === "1") return;
          sel.dataset.mcConfigPriceBound = "1";
          sel.addEventListener("change", function () {
            try {
              inlineSyncConfigurationPrice();
            } catch (eCh) {}
          });
        });
    } catch (eBind) {}
  }

  if (!global.__MC_PDP_AUTH_CTA_CAPTURE__) {
    global.__MC_PDP_AUTH_CTA_CAPTURE__ = true;
    global.document.addEventListener(
      "click",
      function (e) {
        if (handleAuthCtaClick(e)) return;
        var configuredColorSwatch =
          e.target && e.target.closest ? e.target.closest(".mc-configured-color-swatch") : null;
        if (configuredColorSwatch) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleConfiguredColorSwatchClick(configuredColorSwatch);
          return;
        }
        if (typeof global.mcHandleLoginCtaClick === "function") {
          global.mcHandleLoginCtaClick(e);
        }
      },
      true
    );
  }

  global.addEventListener("load", function () {
    if (
      global.__MC_PDP_PENDING_LOGIN_MODAL__ &&
      typeof global.mcOpenLoginModal === "function"
    ) {
      global.__MC_PDP_PENDING_LOGIN_MODAL__ = false;
      global.mcOpenLoginModal();
    }
    if (
      global.__MC_PDP_PENDING_SIGNUP_MODAL__ &&
      typeof global.mcOpenSignupModal === "function"
    ) {
      global.__MC_PDP_PENDING_SIGNUP_MODAL__ = false;
      global.mcOpenSignupModal();
    }
  });

  if (!global.__mcPdpHeroAlignListen) {
    global.__mcPdpHeroAlignListen = true;
    global.addEventListener("resize", syncPdpHeroTopAlign);
  }

  // Wrap Volusion's price-update function so .00 is stripped synchronously,
  // with no RAF delay, immediately after any option selection updates the price.
  (function () {
    var orig = global.AutoUpdatePriceWithSelectedOptions;
    if (typeof orig === "function" && !orig.__mcStripped) {
      global.AutoUpdatePriceWithSelectedOptions = function () {
        var r = orig.apply(this, arguments);
        try { stripPriceZeroCents(); } catch (e) {}
        try { global.setTimeout(function () { stripPriceZeroCents(); }, 60); } catch (e) {}
        try { global.setTimeout(function () { stripPriceZeroCents(); }, 200); } catch (e) {}
        return r;
      };
      global.AutoUpdatePriceWithSelectedOptions.__mcStripped = true;
    }
  })();

  /* The page markup is server-rendered.  One pass after DOM readiness is the
     sole layout owner; delayed re-runs and a subtree observer caused scroll
     reflows and could replace a customer’s current variant selection. */
  runPatch();
  global.document.addEventListener("DOMContentLoaded", runPatch);
  global.addEventListener("load", runPatch);
})(window);

/* MC_SS_CLOSEOUT_SARANONI_FRAME_20260719
   Legacy Steve Silver closeout records are rebuilt by the same generic PDP
   pass as Saranoni, which later writes a full-width inline row. Restore the
   approved 690 / 400 / 28 desktop geometry after that pass completes. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_SS_CLOSEOUT_SARANONI_FRAME_20260719__) return;
  g.__MC_SS_CLOSEOUT_SARANONI_FRAME_20260719__ = true;

  function applyCloseoutFrame() {
    if (
      !d.body ||
      !d.body.classList.contains("mc-closeout-pdp") ||
      !g.matchMedia ||
      !g.matchMedia("(min-width: 992px)").matches
    ) {
      return;
    }
    var row = d.querySelector(
      "#v65-product-parent tr.mc-unified-pdp-row, #v65-product-parent tr.mc-pdp-main-row"
    );
    if (!row) return;
    var media = row.querySelector(":scope > td.mc-unified-pdp-media, :scope > td.mc-pdp-media-td");
    var info = row.querySelector(":scope > td.mc-unified-pdp-info, :scope > td.mc-pdp-options-td");
    if (!media || !info) return;
    var parent = row.parentElement;
    if (parent && parent.tagName === "TBODY") {
      parent.style.setProperty("display", "block", "important");
      parent.style.setProperty("width", "100%", "important");
      parent.style.setProperty("max-width", "100%", "important");
    }
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("width", "1128px", "important");
    row.style.setProperty("max-width", "100%", "important");
    row.style.setProperty("margin-left", "auto", "important");
    row.style.setProperty("margin-right", "auto", "important");
    row.style.setProperty("gap", "28px", "important");
    row.style.setProperty("column-gap", "28px", "important");
    row.style.setProperty("align-items", "flex-start", "important");

    media.style.setProperty("display", "flex", "important");
    media.style.setProperty("flex", "0 0 690px", "important");
    media.style.setProperty("flex-basis", "690px", "important");
    media.style.setProperty("width", "690px", "important");
    media.style.setProperty("min-width", "690px", "important");
    media.style.setProperty("max-width", "690px", "important");
    media.style.setProperty("box-sizing", "border-box", "important");

    info.style.setProperty("display", "block", "important");
    info.style.setProperty("flex", "0 0 400px", "important");
    info.style.setProperty("flex-basis", "400px", "important");
    info.style.setProperty("width", "400px", "important");
    info.style.setProperty("min-width", "400px", "important");
    info.style.setProperty("max-width", "400px", "important");
    info.style.setProperty("box-sizing", "border-box", "important");
  }

  function bootCloseoutFrame() {
    [0, 150, 700, 1800, 3600].forEach(function (ms) {
      g.setTimeout(applyCloseoutFrame, ms);
    });
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", bootCloseoutFrame, { once: true });
  } else {
    bootCloseoutFrame();
  }
  g.addEventListener("load", bootCloseoutFrame);
})(window, document);

/* MC_PDP_AUTH_SELF_UPGRADE disabled 20260722manual4 — stop lovey freeze */
(function (g, d) {
  try {
    g.__MC_DEPLOY_FP__ = g.__MC_DEPLOY_FP__ || "20260722manual4";
    if (d && d.documentElement) d.documentElement.setAttribute("data-mc-pdp-auth-reload", "20260722manual4");
  } catch (e) {}
})(window, document);

/* MC_STEVE_SILVER_ALT_VIEWS_20260620 — force -1 piece hero for all SS- PDPs (bedroom + upholstery). */
(function (g, d) {
  var SS_ALT_VER = "20260701sshero2";

  function normalizePhotoUrl(url) {
    if (typeof g.mcNormalizePhotoUrl === "function") return g.mcNormalizePhotoUrl(url);
    return String(url || "")
      .replace(/\?.*$/, "")
      .split("#")[0];
  }

  function setPhotoSrcIfChanged(img, url) {
    if (typeof g.mcSetProductPhotoSrcIfChanged === "function") {
      return g.mcSetProductPhotoSrcIfChanged(img, url);
    }
    if (!img || !url) return false;
    var target = normalizePhotoUrl(url);
    var cur = normalizePhotoUrl(img.getAttribute("src") || img.src || "");
    if (cur === target) return false;
    img.setAttribute("src", url);
    img.src = url;
    img.removeAttribute("srcset");
    return true;
  }

  function isSteveSilverCode(code) {
    return /^SS-/.test(code);
  }

  function productCode() {
    var input = d.querySelector('input[name="ProductCode"]');
    return String(
      (g.global_Current_ProductCode || "") ||
      (input && input.value) ||
      ""
    ).toUpperCase();
  }

  function photo(code, n, thumb) {
    return "/v/vspfiles/photos/" + code + "-" + n + (thumb ? "T" : "") + ".jpg";
  }

  function findMediaCell(img) {
    return (
      (img && img.closest && (
        img.closest("td.mc-pdp-media-td") ||
        img.closest("td.mc-unified-pdp-media") ||
        img.closest("#product_photo_td") ||
        img.closest("td")
      )) ||
      null
    );
  }

  function directChildUnder(parent, node) {
    if (!parent || !node || !parent.contains(node)) return null;
    while (node && node.parentNode !== parent) node = node.parentNode;
    return node || null;
  }

  function mediaDescription(mediaCell) {
    if (!mediaCell) return null;
    var children = Array.prototype.slice.call(mediaCell.children || []);
    for (var i = 0; i < children.length; i++) {
      if (
        children[i].classList &&
        (children[i].classList.contains("mc-unified-pdp-description--media") ||
          children[i].classList.contains("mc-unified-pdp-description"))
      ) {
        return children[i];
      }
    }
    return null;
  }

  function ensureAltViews(code, mediaCell, zoom) {
    var altSlot = 2;
    var alt = d.getElementById("altviews") || d.querySelector("span#altviews");
    var altBuilt =
      alt &&
      alt.getAttribute("data-mc-ss-alt-built") === code &&
      alt.querySelector("img.vCSS_img_alternate_product_photo");
    if (!alt) {
      alt = d.createElement("span");
      alt.id = "altviews";
      alt.className = "mc-steve-silver-altviews";
    }
    if (!altBuilt) {
      alt.setAttribute("data-mc-ss-alt-built", code);
      alt.innerHTML =
        '<button type="button" data-mc-ss-alt="' + altSlot + '" aria-label="Room scene">' +
        '<img id="alternate_product_photo_' + altSlot + '" class="vCSS_img_alternate_product_photo" src="' + photo(code, altSlot, true) + '" alt="Room scene" />' +
        "</button>";
    }

    if (g.__MC_SS_ALT_LAYOUT_VER__ === SS_ALT_VER) {
      alt.querySelectorAll("[data-mc-ss-alt]").forEach(function (a) {
        a.__mcSsAltClickBound = true;
        a.onpointerdown = a.onmousedown = function () {
          setHero(code, altSlot);
          [0, 50, 200, 600].forEach(function (ms) {
            g.setTimeout(function () { setHero(code, altSlot); }, ms);
          });
        };
        a.onclick = function (ev) {
          if (ev) ev.preventDefault();
          setHero(code, altSlot);
          return false;
        };
      });
      return;
    }
    g.__MC_SS_ALT_LAYOUT_VER__ = SS_ALT_VER;

    var wrap = d.getElementById("mc-steve-silver-altviews-wrap");
    if (!wrap) {
      wrap = d.createElement("div");
      wrap.id = "mc-steve-silver-altviews-wrap";
      wrap.className = "mc-steve-silver-altviews-wrap";
    }
    var desc = mediaDescription(mediaCell);
    var zoomChild = directChildUnder(mediaCell, zoom);
    if (mediaCell && wrap.parentNode !== mediaCell) {
      if (desc && desc.parentNode === mediaCell) {
        mediaCell.insertBefore(wrap, desc);
      } else if (zoomChild && zoomChild.parentNode === mediaCell) {
        mediaCell.insertBefore(wrap, zoomChild.nextSibling || null);
      } else {
        mediaCell.appendChild(wrap);
      }
    }
    if (alt.parentNode !== wrap) wrap.appendChild(alt);
    if (mediaCell && wrap.parentNode === mediaCell) {
      desc = mediaDescription(mediaCell);
      zoomChild = directChildUnder(mediaCell, zoom);
      if (desc && desc.parentNode === mediaCell && wrap.nextSibling !== desc) {
        mediaCell.insertBefore(wrap, desc);
      } else if (zoomChild && zoomChild.parentNode === mediaCell && wrap.previousElementSibling !== zoomChild) {
        mediaCell.insertBefore(wrap, zoomChild.nextSibling || null);
      }
    }

    var isDesktop = g.matchMedia && g.matchMedia("(min-width: 992px)").matches;
    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("justify-content", isDesktop ? "flex-start" : "center", "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("max-width", "600px", "important");
    wrap.style.setProperty("margin", isDesktop ? "10px 0 0 0" : "10px auto 0", "important");
    wrap.style.setProperty("padding", "0", "important");
    wrap.style.setProperty("clear", "both", "important");

    alt.style.setProperty("display", "flex", "important");
    alt.style.setProperty("justify-content", isDesktop ? "flex-start" : "center", "important");
    alt.style.setProperty("gap", "8px", "important");
    alt.style.setProperty("margin", isDesktop ? "0" : "0 auto", "important");
    alt.style.setProperty("padding", "0", "important");
    alt.style.setProperty("float", "none", "important");
    alt.style.setProperty("position", "static", "important");

    alt.querySelectorAll("[data-mc-ss-alt]").forEach(function (a) {
      a.style.setProperty("display", "block", "important");
      a.style.setProperty("width", "72px", "important");
      a.style.setProperty("height", "72px", "important");
      a.style.setProperty("padding", "0", "important");
      a.style.setProperty("border", "0", "important");
      a.style.setProperty("background", "transparent", "important");
      a.style.setProperty("cursor", "pointer", "important");
      a.__mcSsAltClickBound = true;
      a.onpointerdown = a.onmousedown = function () {
        setHero(code, altSlot);
        [0, 50, 200, 600].forEach(function (ms) {
          g.setTimeout(function () { setHero(code, altSlot); }, ms);
        });
      };
      a.onclick = function (ev) {
        if (ev) ev.preventDefault();
        setHero(code, altSlot);
        return false;
      };
    });
    alt.querySelectorAll("img").forEach(function (im) {
      im.style.setProperty("display", "block", "important");
      im.style.setProperty("width", "72px", "important");
      im.style.setProperty("height", "72px", "important");
      im.style.setProperty("object-fit", "contain", "important");
    });
  }

  function setHero(code, n) {
    var img = d.querySelector("img#product_photo");
    var zoom = d.querySelector("a#product_photo_zoom_url") || d.querySelector("a#product_photo_zoom_url2");
    var full = photo(code, n, false);
    if (img) {
      if (n === 1 && img.__mcSsUserSelectedAlt) return;
      if (n !== 1) img.__mcSsUserSelectedAlt = true;
      setPhotoSrcIfChanged(img, full);
      if (img.onload) img.onload = null;
      if (!img.__mcSsHeroLock) {
        img.__mcSsHeroLock = true;
        try {
          new g.MutationObserver(function () {
            if (img.__mcSsUserSelectedAlt) return;
            var cur = img.getAttribute("src") || "";
            if (/-2T\.|-2\.jpg/i.test(cur)) {
              setPhotoSrcIfChanged(img, full);
            }
          }).observe(img, { attributes: true, attributeFilter: ["src"] });
        } catch (eObs) {}
      }
    }
    if (zoom) {
      if (typeof g.mcSetLinkHrefIfChanged === "function") {
        g.mcSetLinkHrefIfChanged(zoom, full);
      } else if (normalizePhotoUrl(zoom.getAttribute("href") || "") !== normalizePhotoUrl(full)) {
        zoom.setAttribute("href", full);
      }
      zoom.title = n === 1 ? "Product image" : "Room scene";
    }
    if (typeof g.ensureSteveSilverHeroImageSize === "function") {
      try {
        g.ensureSteveSilverHeroImageSize();
      } catch (eHeroSize) {}
    }
  }

  function normalizeMediaLayout(mediaCell) {
    if (!mediaCell) return;
    try {
      d.body.classList.add("mc-steve-silver-altview-pdp");
    } catch (eBodyClass) {}
    Array.prototype.slice.call(mediaCell.children || []).forEach(function (child) {
      if (child && child.tagName === "TABLE") {
        child.style.setProperty("margin-left", "0", "important");
        child.style.setProperty("margin-right", "0", "important");
      }
    });
    if (typeof g.ensureSteveSilverHeroImageSize === "function") {
      try {
        g.ensureSteveSilverHeroImageSize();
      } catch (eHeroSize) {}
    }
  }

  function run() {
    var code = productCode();
    if (!isSteveSilverCode(code)) return;
    var img = d.querySelector("img#product_photo");
    if (!img) return;
    var zoom = d.querySelector("a#product_photo_zoom_url") || d.querySelector("a#product_photo_zoom_url2");
    var mediaCell = findMediaCell(img);
    normalizeMediaLayout(mediaCell);
    setHero(code, 1);
    ensureAltViews(code, mediaCell, zoom);
  }

  function retryHeroIfWrong() {
    var code = productCode();
    if (!isSteveSilverCode(code)) return;
    var img = d.querySelector("img#product_photo");
    if (!img) return;
    if (img.__mcSsUserSelectedAlt) return;
    var full = photo(code, 1, false);
    var cur = String(img.getAttribute("src") || img.src || "");
    if (/-2T\.|-2\.jpg/i.test(cur) || normalizePhotoUrl(cur) !== normalizePhotoUrl(full)) {
      setHero(code, 1);
    }
  }

  function runOnce() {
    if (g.__MC_SS_ALT_RUN_VER__ === SS_ALT_VER) return;
    g.__MC_SS_ALT_RUN_VER__ = SS_ALT_VER;
    run();
  }

  if (!g.__MC_SS_ALT_WINDOW_CAPTURE__) {
    g.__MC_SS_ALT_WINDOW_CAPTURE__ = true;
    g.addEventListener("click", function (event) {
      var target = event.target && event.target.closest ? event.target.closest("#altviews [data-mc-ss-alt]") : null;
      if (!target) return;
      var code = productCode();
      if (!isSteveSilverCode(code)) return;
      var slot = parseInt(target.getAttribute("data-mc-ss-alt"), 10);
      if (!slot) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setHero(code, slot);
    }, true);
  }

  runOnce();
  [500, 2000, 7600, 9000].forEach(function (ms) {
    g.setTimeout(function () {
      run();
      retryHeroIfWrong();
    }, ms);
  });
  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", runOnce);
  }
})(window, document);

/* MC_PDP_PRICE_STACK_20260522 — load standalone repair if this cached bundle is stale */
(function (g) {
  try {
    if (typeof g.mcEnsurePdpPriceStack === "function") {
      g.mcEnsurePdpPriceStack();
      return;
    }
  } catch (e0) {}
  var d = g.document;
  if (!d || d.getElementById("mc-pdp-price-stack-loader")) return;
  var s = d.createElement("script");
  s.id = "mc-pdp-price-stack-loader";
  s.async = true;
  s.src = "/v/vspfiles/js/mc-pdp-price-stack.js?v=20260531a&mcrd=" + Date.now();
  s.onload = function () {
    try {
      if (typeof g.mcEnsurePdpPriceStack === "function") g.mcEnsurePdpPriceStack();
    } catch (e1) {}
  };
  (d.head || d.documentElement).appendChild(s);
})(window);
/* MC_RETURN_LINK_ONLY_20260620mobile1 */
(function (g, d) {
  function isPdpPage() {
    var b = d.body;
    if (!b) return false;
    return (
      b.classList.contains("productdetails") ||
      b.classList.contains("mc-product-page") ||
      !!d.getElementById("v65-product-parent")
    );
  }

  function getReturnData() {
    if (typeof g.mcResolvePdpReturnCategory === "function") {
      try {
        var cat = g.mcResolvePdpReturnCategory();
        if (cat && cat.name && String(cat.name).toUpperCase() !== "FURNITURE") {
          return {
            text: "\u2190 RETURN TO " + cat.name.toUpperCase(),
            href: cat.href || "/",
          };
        }
      } catch (eRetCat) {}
    }
    if (d.body && /\bmc-bean-bag-pdp\b/.test(d.body.className || "")) {
      return { text: "\u2190 RETURN TO BEAN BAGS", href: "/bean-bag-seating-s/103.htm" };
    }
    return null;
  }

  function rowReturnLinkVisible() {
    var rowLink = d.querySelector("#v65-product-parent tr.mc-pdp-return-row .mc-pdp-return-link");
    if (!rowLink) return false;
    var t = (rowLink.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) return false;
    try {
      var st = g.getComputedStyle(rowLink);
      if (st.display === "none" || st.visibility === "hidden") return false;
      if (parseFloat(st.opacity || "1") < 0.1) return false;
    } catch (eVis) {}
    return rowLink.offsetWidth > 0 || rowLink.offsetHeight > 0;
  }

  function restoreReturnLink() {
    if (!isPdpPage()) return;

    if (typeof g.ensureSoftGoodsReturnRow === "function") {
      try {
        g.ensureSoftGoodsReturnRow();
      } catch (eSoftReturn) {}
    }

    if (rowReturnLinkVisible()) {
      var stale = d.getElementById("mc-pdp-return-link-static");
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      return;
    }

    var data = getReturnData();
    if (!data) return;

    var table = d.getElementById("v65-product-parent");
    var host = (table && table.parentNode) || d.getElementById("content_area");
    if (!host) return;

    var wrap = d.getElementById("mc-pdp-return-link-static");
    if (!wrap) {
      wrap = d.createElement("div");
      wrap.id = "mc-pdp-return-link-static";
      wrap.className = "mc-pdp-return-link-static";

      var link = d.createElement("a");
      link.className = "mc-pdp-return-link";
      wrap.appendChild(link);

      if (table && table.parentNode === host) host.insertBefore(wrap, table);
      else host.insertBefore(wrap, host.firstChild);
    }

    var a = wrap.querySelector("a");
    if (!a) return;

    a.href = data.href;
    a.textContent = data.text;
    a.setAttribute("aria-label", data.text.replace("\u2190 ", ""));
  }

  [0, 400, 1500].forEach(function (ms) {
    g.setTimeout(restoreReturnLink, ms);
  });

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", restoreReturnLink);
  } else {
    restoreReturnLink();
  }
})(window, document);
/* MC_CENTER_ALT_IMAGES_UNDER_MAIN_20260618 */
(function (g, d) {
  var CENTER_ALT_VER = "20260624sarrepair4";

  function isSteveSilverPdp() {
    if (d.body && d.body.classList.contains("mc-steve-silver-altview-pdp")) return true;
    var input = d.querySelector('input[name="ProductCode"]');
    var code = String(
      (g.global_Current_ProductCode || "") ||
      (input && input.value) ||
      ""
    ).toUpperCase();
    return /^SS-/.test(code);
  }

  function centerAltImages() {
    if (!d.body || !/\b(productdetails|mc-product-page)\b/.test(d.body.className || "")) return;
    if (isSteveSilverPdp()) return;
    if (g.__MC_CENTER_ALT_IMAGES_DONE__ === CENTER_ALT_VER) return;

    if (!g.__MC_CENTER_ALT_RELOCATE_DONE__ && typeof g.mcRelocateVariantSwatchesFromMediaColumn === "function") {
      g.__MC_CENTER_ALT_RELOCATE_DONE__ = true;
      try {
        g.mcRelocateVariantSwatchesFromMediaColumn();
      } catch (eRelocate) {}
    }

    var img = d.querySelector("img#product_photo");
    var alt =
      d.querySelector("#altviews") ||
      d.querySelector("span#altviews") ||
      d.querySelector(".mc-unified-altviews");

    if (!img || !alt) return;

    var zoom = d.querySelector("a#product_photo_zoom_url");
    var mediaCell =
      img.closest("td.mc-pdp-media-td") ||
      img.closest("td.mc-unified-pdp-media") ||
      img.closest("#product_photo_td") ||
      img.closest("td");

    if (!mediaCell) return;

    var layoutDone = g.__MC_CENTER_ALT_LAYOUT_VER__ === CENTER_ALT_VER;
    var wrap = d.getElementById("mc-centered-altviews-wrap");
    if (!wrap) {
      wrap = d.createElement("div");
      wrap.id = "mc-centered-altviews-wrap";
      wrap.className = "mc-centered-altviews-wrap";
    }

    function directChildUnder(parent, node) {
      if (!parent || !node || !parent.contains(node)) return null;
      while (node && node.parentNode !== parent) node = node.parentNode;
      return node || null;
    }

    function mediaDescription(parent) {
      var children = Array.prototype.slice.call((parent && parent.children) || []);
      for (var i = 0; i < children.length; i++) {
        if (
          children[i].classList &&
          (children[i].classList.contains("mc-unified-pdp-description--media") ||
            children[i].classList.contains("mc-unified-pdp-description"))
        ) {
          return children[i];
        }
      }
      return null;
    }

    if (!layoutDone) {
      var desc = mediaDescription(mediaCell);
      var zoomChild = directChildUnder(mediaCell, zoom);

      if (wrap.parentNode !== mediaCell) {
        if (desc && desc.parentNode === mediaCell) {
          mediaCell.insertBefore(wrap, desc);
        } else if (zoomChild && zoomChild.parentNode === mediaCell) {
          mediaCell.insertBefore(wrap, zoomChild.nextSibling || null);
        } else {
          mediaCell.appendChild(wrap);
        }
      }

      if (alt.parentNode !== wrap) {
        wrap.appendChild(alt);
      }

      desc = mediaDescription(mediaCell);
      zoomChild = directChildUnder(mediaCell, zoom);
      if (desc && desc.parentNode === mediaCell && wrap.nextSibling !== desc) {
        mediaCell.insertBefore(wrap, desc);
      } else if (zoomChild && zoomChild.parentNode === mediaCell && wrap.previousElementSibling !== zoomChild) {
        mediaCell.insertBefore(wrap, zoomChild.nextSibling || null);
      } else if (!zoomChild) {
        var imgChild = directChildUnder(mediaCell, img);
        if (imgChild && imgChild.parentNode === mediaCell && wrap.previousElementSibling !== imgChild) {
          mediaCell.insertBefore(wrap, imgChild.nextSibling || null);
        }
      }
      g.__MC_CENTER_ALT_LAYOUT_VER__ = CENTER_ALT_VER;
    }

    wrap.style.setProperty("display", "flex", "important");
    wrap.style.setProperty("justify-content", "center", "important");
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("max-width", img.offsetWidth ? img.offsetWidth + "px" : "600px", "important");
    wrap.style.setProperty("margin", "10px auto 0 auto", "important");
    wrap.style.setProperty("padding", "0", "important");
    wrap.style.setProperty("clear", "both", "important");

    alt.style.setProperty("display", "flex", "important");
    alt.style.setProperty("flex-wrap", "wrap", "important");
    alt.style.setProperty("justify-content", "center", "important");
    alt.style.setProperty("gap", "8px", "important");
    alt.style.setProperty("margin", "0 auto", "important");
    alt.style.setProperty("padding", "0", "important");
    alt.style.setProperty("float", "none", "important");
    alt.style.setProperty("position", "static", "important");
    alt.style.setProperty("text-align", "center", "important");
  }

  g.setTimeout(centerAltImages, 0);
  g.setTimeout(centerAltImages, 400);
try {
  if (g.MutationObserver && !g.__MC_CENTER_ALT_IMAGES_OBSERVER__) {
    g.__MC_CENTER_ALT_IMAGES_OBSERVER__ = true;

    var timer = null;
    var observer = new g.MutationObserver(function () {
      if (isSteveSilverPdp() || d.getElementById("mc-steve-silver-altviews-wrap")) return;
      if (g.__MC_CENTER_ALT_LAYOUT_VER__ === CENTER_ALT_VER) return;
      g.clearTimeout(timer);
      timer = g.setTimeout(centerAltImages, 250);
    });

    observer.observe(d.getElementById("v65-product-parent") || d.body, {
      childList: true,
      subtree: true
    });
  }
} catch (eCenterAltObserver) {}
  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", centerAltImages);
  } else {
    centerAltImages();
  }
})(window, document);

/* MC_SS_ALEXANDRIA_MEDIA_CONTAIN_20260701
   Steve Silver PDPs can inherit a legacy 250px media-table gutter from the
   generic thumbnail layout. Keep the 650px hero image inside its media column
   so the accordion/right column cannot overlap it. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_SS_MEDIA_CONTAIN_20260701__) return;
  g.__MC_SS_MEDIA_CONTAIN_20260701__ = true;

  function isSteveSilverPdp() {
    var body = d.body;
    if (body && body.classList && body.classList.contains("mc-gatlin-sectional-pdp")) return false;
    if (body && body.classList && body.classList.contains("mc-steve-silver-altview-pdp")) return true;
    var code = String(g.global_Current_ProductCode || "").toUpperCase();
    if (!code) {
      var codeEl = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
      code = String((codeEl && codeEl.value) || "").toUpperCase();
    }
    return /^SS-/.test(code);
  }

  function setImportant(el, prop, value) {
    if (!el || !el.style) return;
    if (el.style.getPropertyValue(prop) === value && el.style.getPropertyPriority(prop) === "important") return;
    el.style.setProperty(prop, value, "important");
  }

  function normalizeSteveSilverMedia() {
    if (!isSteveSilverPdp()) return;
    if (!g.matchMedia || !g.matchMedia("(min-width: 992px)").matches) return;

    var media = d.querySelector("td.mc-pdp-media-td,td.mc-unified-pdp-media");
    var info = d.querySelector("td.mc-pdp-options-td,td.mc-unified-pdp-info");
    var row = media && media.parentElement;

    if (row) {
      setImportant(row, "display", "flex");
      setImportant(row, "flex-wrap", "nowrap");
      setImportant(row, "align-items", "flex-start");
      setImportant(row, "gap", "28px");
      setImportant(row, "width", "1128px");
      setImportant(row, "max-width", "1128px");
      setImportant(row, "margin", "0 auto");
    }
    if (media) {
      setImportant(media, "display", "flex");
      setImportant(media, "flex-direction", "column");
      setImportant(media, "flex", "0 0 690px");
      setImportant(media, "width", "690px");
      setImportant(media, "min-width", "690px");
      setImportant(media, "max-width", "690px");
      setImportant(media, "align-items", "flex-start");
      setImportant(media, "overflow", "visible");
      setImportant(media, "padding", "0");
    }
    if (info) {
      setImportant(info, "display", "block");
      setImportant(info, "flex", "0 0 400px");
      setImportant(info, "width", "400px");
      setImportant(info, "min-width", "400px");
      setImportant(info, "max-width", "400px");
      setImportant(info, "padding", "30px 0 0 0");
    }

    d.querySelectorAll("td.mc-pdp-media-td > table:has(img#product_photo),td.mc-unified-pdp-media > table:has(img#product_photo)").forEach(function (table) {
      setImportant(table, "display", "block");
      setImportant(table, "margin-left", "0");
      setImportant(table, "margin-right", "auto");
      setImportant(table, "width", "650px");
      setImportant(table, "max-width", "650px");
      setImportant(table, "min-width", "0");
      setImportant(table, "table-layout", "fixed");
      setImportant(table, "border-collapse", "collapse");
      setImportant(table, "border-spacing", "0");
      setImportant(table, "transform", "none");
      setImportant(table, "box-sizing", "border-box");
      table.querySelectorAll("tbody,tr,td").forEach(function (el) {
        setImportant(el, "display", "block");
        setImportant(el, "width", "650px");
        setImportant(el, "max-width", "650px");
        setImportant(el, "min-width", "0");
        setImportant(el, "box-sizing", "border-box");
        setImportant(el, "padding", "0");
        setImportant(el, "margin", "0");
      });
    });

    d.querySelectorAll("td.mc-pdp-media-td img#product_photo,td.mc-unified-pdp-media img#product_photo,td.mc-pdp-media-td a#product_photo_zoom_url,td.mc-unified-pdp-media a#product_photo_zoom_url,td.mc-pdp-media-td a#product_photo_zoom_url2,td.mc-unified-pdp-media a#product_photo_zoom_url2").forEach(function (el) {
      setImportant(el, "display", "block");
      setImportant(el, "margin-left", "0");
      setImportant(el, "margin-right", "auto");
      setImportant(el, "width", "650px");
      setImportant(el, "max-width", "650px");
      setImportant(el, "min-width", "0");
      setImportant(el, "height", "auto");
      setImportant(el, "box-sizing", "border-box");
      setImportant(el, "float", "none");
    });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", normalizeSteveSilverMedia);
  else normalizeSteveSilverMedia();
  g.addEventListener("load", normalizeSteveSilverMedia);
  [100, 400, 1200, 2500].forEach(function (ms) {
    g.setTimeout(normalizeSteveSilverMedia, ms);
  });
  if (g.MutationObserver) {
    try {
      var mo = new g.MutationObserver(function () {
        g.clearTimeout(g.__MC_SS_MEDIA_CONTAIN_TIMER__);
        g.__MC_SS_MEDIA_CONTAIN_TIMER__ = g.setTimeout(normalizeSteveSilverMedia, 120);
      });
      mo.observe(d.getElementById("v65-product-parent") || d.body, { childList: true, subtree: true });
    } catch (eMo) {}
  }
})(window, document);

/* MC_TMH_BB_PDP_REPAIR_20260701
   Late PDP cleanup can leave Mahjong accordions in a narrow native cell and
   bean-bag hero rows hidden. Repair only those product families after all
   layout passes have run. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_TMH_BB_PDP_REPAIR_20260701__) return;
  g.__MC_TMH_BB_PDP_REPAIR_20260701__ = true;

  function productCode() {
    var code = String(g.global_Current_ProductCode || "").toUpperCase();
    if (!code) {
      var el = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
      code = String((el && el.value) || "").toUpperCase();
    }
    return code;
  }

  function isTmhPdp() {
    return /^TMH-/.test(productCode()) || (d.body && d.body.classList.contains("mc-mahjong-house-pdp"));
  }

  function isBeanBagPdp() {
    return /^BB-/.test(productCode()) || (d.body && d.body.classList.contains("mc-bean-bag-pdp"));
  }

  function setImportant(el, prop, value) {
    if (el && el.style) el.style.setProperty(prop, value, "important");
  }

  function show(el, displayValue) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute("hidden");
    el.removeAttribute("aria-hidden");
    setImportant(el, "display", displayValue || "block");
    setImportant(el, "visibility", "visible");
    setImportant(el, "opacity", "1");
    setImportant(el, "height", "auto");
    setImportant(el, "max-height", "none");
    setImportant(el, "overflow", "visible");
  }

  function hide(el) {
    if (!el) return;
    setImportant(el, "display", "none");
    setImportant(el, "visibility", "hidden");
    setImportant(el, "opacity", "0");
    setImportant(el, "height", "0");
    setImportant(el, "max-height", "0");
    setImportant(el, "overflow", "hidden");
    setImportant(el, "pointer-events", "none");
  }

  function repairMahjongAccordion() {
    if (!isTmhPdp()) return;
    if (!g.matchMedia || !g.matchMedia("(min-width: 992px)").matches) return;
    var root = d.getElementById("v65-product-parent");
    var img = d.getElementById("product_photo");
    var acc = d.querySelector("#mc-pdp-accordion,.mc-pdp-accordion");
    if (!root || !img || !acc) return;
    var logo = d.getElementById("mc-pdp-brand-logo");
    var mainRow = null;
    Array.prototype.some.call(root.querySelectorAll(":scope > tbody > tr"), function (row) {
      if (row.contains(img) && row.contains(acc)) {
        mainRow = row;
        return true;
      }
      return false;
    });
    if (!mainRow) return;
    var mediaCol = null;
    var infoCol = null;
    Array.prototype.forEach.call(mainRow.children || [], function (cell) {
      if (cell.contains(img)) mediaCol = cell;
      if (cell.contains(acc)) infoCol = cell;
    });
    if (!mediaCol || !infoCol) return;

    setImportant(root, "display", "block");
    setImportant(root, "width", "1200px");
    setImportant(root, "max-width", "1200px");
    setImportant(root, "min-width", "0px");
    setImportant(root, "margin-left", "auto");
    setImportant(root, "margin-right", "auto");
    setImportant(root, "padding", "0px");
    setImportant(root, "overflow", "visible");
    setImportant(mainRow, "display", "flex");
    setImportant(mainRow, "width", "1110px");
    setImportant(mainRow, "max-width", "1110px");
    setImportant(mainRow, "margin-left", "auto");
    setImportant(mainRow, "margin-right", "auto");
    setImportant(mainRow, "gap", "40px");
    setImportant(mainRow, "align-items", "flex-start");
    [mediaCol, infoCol].forEach(function (cell) {
      setImportant(cell, "display", "flex");
      setImportant(cell, "flex-direction", "column");
      setImportant(cell, "position", "static");
      setImportant(cell, "left", "auto");
      setImportant(cell, "padding", "0px");
      setImportant(cell, "margin", "0px");
      setImportant(cell, "min-width", "0px");
      setImportant(cell, "box-sizing", "border-box");
      setImportant(cell, "overflow", "visible");
    });
    setImportant(mediaCol, "flex", "0 0 650px");
    setImportant(mediaCol, "width", "650px");
    setImportant(mediaCol, "max-width", "650px");
    setImportant(infoCol, "flex", "0 0 420px");
    setImportant(infoCol, "width", "420px");
    setImportant(infoCol, "max-width", "420px");

    var node = img.parentElement;
    while (node && node !== mediaCol) {
      setImportant(node, "display", "block");
      setImportant(node, "width", "650px");
      setImportant(node, "max-width", "650px");
      setImportant(node, "min-width", "0px");
      setImportant(node, "padding", "0px");
      setImportant(node, "margin", "0px");
      setImportant(node, "box-sizing", "border-box");
      node = node.parentElement;
    }
    setImportant(img, "display", "block");
    setImportant(img, "width", "650px");
    setImportant(img, "max-width", "650px");
    setImportant(img, "height", "auto");
    setImportant(img, "margin", "0px");

    var alt = d.querySelector("#altviews,span#altviews,.altviews");
    if (alt && mediaCol.contains(alt)) {
      setImportant(alt, "display", "flex");
      setImportant(alt, "width", "650px");
      setImportant(alt, "max-width", "650px");
      setImportant(alt, "margin", "12px 0 0 0");
      setImportant(alt, "justify-content", "flex-start");
    }
    [acc, logo].forEach(function (el) {
      if (!el) return;
      setImportant(el, "position", "static");
      setImportant(el, "left", "0");
      setImportant(el, "display", "block");
      setImportant(el, "width", "420px");
      setImportant(el, "max-width", "420px");
      setImportant(el, "min-width", "0");
      setImportant(el, "margin-left", "0");
      setImportant(el, "margin-right", "0");
      setImportant(el, "box-sizing", "border-box");
      setImportant(el, "overflow", "visible");
    });
    acc.querySelectorAll(".mc-acc-row,.mc-acc-header,.mc-acc-panel,.mc-acc-content").forEach(function (el) {
      setImportant(el, "width", "100%");
      setImportant(el, "max-width", "100%");
      setImportant(el, "box-sizing", "border-box");
    });
  }

  function repairBeanBagHero() {
    if (!isBeanBagPdp()) return;
    var desktop = !!(g.matchMedia && g.matchMedia("(min-width: 992px)").matches);
    var img = d.getElementById("product_photo");
    var row = img && img.closest("tr.mc-pdp-main-row,tr.mc-unified-pdp-row");
    if (row) {
      show(row, "flex");
      setImportant(row, "flex-direction", desktop ? "row" : "column");
      setImportant(row, "align-items", "flex-start");
      setImportant(row, "gap", desktop ? "40px" : "12px");
      setImportant(row, "width", "100%");
    }
    if (row) {
      Array.prototype.forEach.call(row.children || [], function (el) {
        show(el, "block");
      });
    }
    var media = d.querySelector("td.mc-pdp-media-td,td.mc-unified-pdp-media");
    var info = d.querySelector("td.mc-pdp-options-td,td.mc-unified-pdp-info");
    if (media) {
      show(media, "flex");
      setImportant(media, "flex", desktop ? "0 0 650px" : "0 0 auto");
      setImportant(media, "width", desktop ? "650px" : "100%");
      setImportant(media, "max-width", desktop ? "650px" : "100%");
      setImportant(media, "padding", "0");
    }
    if (info) {
      show(info, "flex");
      setImportant(info, "flex", desktop ? "0 0 420px" : "0 0 auto");
      setImportant(info, "width", desktop ? "420px" : "100%");
      setImportant(info, "max-width", desktop ? "420px" : "100%");
      setImportant(info, "padding", "0");
      setImportant(info, "flex-direction", "column");

    }
    d.querySelectorAll("#mc-pdp-features,#mc-pdp-features *").forEach(function (el) {
      show(el, el.id === "mc-pdp-features" ? "block" : "");
    });
    if (img) {
      show(img, "block");
      setImportant(img, "width", "100%");
      setImportant(img, "max-width", desktop ? "650px" : "100%");
      setImportant(img, "height", "auto");
    }
    var zoom = d.getElementById("product_photo_zoom_url");
    if (zoom) {
      show(zoom, "block");
      setImportant(zoom, "width", "100%");
      setImportant(zoom, "max-width", desktop ? "650px" : "100%");
    }
  }

  function repairBeanBagSwatches() {
    if (!isBeanBagPdp()) return;
    var wrap = d.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    show(wrap, "block");
    setImportant(wrap, "width", "100%");
    setImportant(wrap, "max-width", "100%");
    setImportant(wrap, "margin", "12px 0 8px 0");
    setImportant(wrap, "padding", "0");
    var list = wrap.querySelector(".beanbag-swatches");
    if (list) {
      show(list, "flex");
      setImportant(list, "display", "flex");
      setImportant(list, "flex-wrap", "wrap");
      setImportant(list, "gap", "8px");
      setImportant(list, "align-items", "center");
      setImportant(list, "width", "100%");
    }
    wrap.querySelectorAll("img.beanbag-swatch").forEach(function (swatch) {
      var src = swatch.getAttribute("src") || "";
      var label = swatch.getAttribute("data-option") || swatch.getAttribute("alt") || "";
      var asset = typeof g.__MC_BB_COVER_ASSET__ === "function" ? g.__MC_BB_COVER_ASSET__(label) : null;
      if (asset && asset.thumb && src !== asset.thumb) {
        swatch.setAttribute("src", asset.thumb);
        src = asset.thumb;
      }
      var broken = !asset && swatch.complete && !swatch.naturalWidth;
      if (!broken) {
        setImportant(swatch, "display", "inline-block");
        setImportant(swatch, "width", "54px");
        setImportant(swatch, "height", "54px");
        setImportant(swatch, "object-fit", "cover");
        setImportant(swatch, "border-radius", "50%");
        return;
      }
      var shortLabel = label.replace(/^Faux\s+Fur\s*\/?\s*/i, "").replace(/^Faux\s+Fur\s+/i, "").trim() || label;
      var btn = d.createElement("button");
      btn.type = "button";
      btn.className = swatch.className + " beanbag-swatch--text";
      btn.setAttribute("data-option", label);
      btn.setAttribute("aria-label", label);
      btn.textContent = shortLabel;
      if (swatch.classList && swatch.classList.contains("active")) btn.classList.add("active");
      try {
        swatch.parentNode.replaceChild(btn, swatch);
      } catch (eReplace) {}
    });
    wrap.querySelectorAll(".beanbag-swatch--text").forEach(function (btn) {
      setImportant(btn, "appearance", "none");
      setImportant(btn, "-webkit-appearance", "none");
      setImportant(btn, "display", "inline-flex");
      setImportant(btn, "align-items", "center");
      setImportant(btn, "justify-content", "center");
      setImportant(btn, "min-width", "76px");
      setImportant(btn, "height", "34px");
      setImportant(btn, "padding", "0 10px");
      setImportant(btn, "border", "1px solid #d2d2d2");
      setImportant(btn, "background", "#fff");
      setImportant(btn, "color", "#444");
      setImportant(btn, "font", "400 12px/1 Inter, Arial, sans-serif");
      setImportant(btn, "letter-spacing", "0.08em");
      setImportant(btn, "text-transform", "uppercase");
      setImportant(btn, "cursor", "pointer");
      setImportant(btn, "box-sizing", "border-box");
    });
  }

  function hideBeanBagNoPhotoAlternates() {
    if (!isBeanBagPdp()) return;
    d.querySelectorAll("img.vCSS_img_alternate_product_photo,img[id^='alternate_product_photo']").forEach(function (alt) {
      var src = alt.getAttribute("src") || "";
      if (!/nophoto|no[-_]?photo/i.test(src)) return;
      hide(alt.closest("a") || alt);
      var span = alt.closest("span");
      if (span) hide(span);
    });
  }

  function hideBeanBagStrayPriceBoxes() {
    if (!isBeanBagPdp()) return;
    d.querySelectorAll("#v65-product-parent table.colors_pricebox,#content_area table.colors_pricebox").forEach(function (box) {
      if (
        box.querySelector(
          "#mc-pdp-price-stack-host,#mc-bb-size-section,#beanbag-swatch-wrapper,#mc-pdp-features,#mc-pdp-purchase-stack,.mc-pdp-purchase-controls,input[name='btnaddtocart'],button[name='btnaddtocart']"
        )
      ) {
        return;
      }
      var txt = String(box.textContent || "").replace(/\s+/g, " ").trim();
      if (/\bPRICE\b|\bFREE SHIPPING\b|\$[\d,]+/i.test(txt)) hide(box);
    });
  }

  function runRepair() {
    repairMahjongAccordion();
    repairBeanBagHero();
    repairBeanBagSwatches();
    hideBeanBagNoPhotoAlternates();
    hideBeanBagStrayPriceBoxes();
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", runRepair, { once: true });
  else runRepair();
})(window, document);

/* MC_WINDSOR_HERO_FIX_20260620 — live CDN still caches 4MB slideshow at windsor.mp4; use windsor-home.mp4 */
(function (g, d) {
  if (!g || !d || g.__MC_WINDSOR_HERO_FIX_20260620__) return;
  g.__MC_WINDSOR_HERO_FIX_20260620__ = true;

  var SRC =
    "https://www.mccabestheaterandliving.com/v/vspfiles/windsor-home.mp4?v=20260620windsor1";

  function isHome() {
    var p = String(g.location.pathname || "").toLowerCase();
    return (
      p === "/" ||
      p === "/default.asp" ||
      p === "/default.htm" ||
      p === "/default.html" ||
      p === "/index.htm" ||
      p === "/index.html"
    );
  }

  function applyWindsorHero() {
    if (!isHome()) return;
    var v =
      d.querySelector("#slideshow-container video.mc-hero-video-el") ||
      d.querySelector("video.mc-hero-video-el");
    if (!v) return;

    var srcEl = v.querySelector("source");
    var cur = srcEl
      ? String(srcEl.getAttribute("src") || srcEl.src || "")
      : String(v.getAttribute("src") || v.src || "");
    if (cur.indexOf("windsor-home.mp4") === -1 || v.dataset.mcWindsorHomeApplied !== SRC) {
      if (srcEl) srcEl.setAttribute("src", SRC);
      else v.setAttribute("src", SRC);
      try {
        delete v.dataset.mcStartedAtSeven;
      } catch (eDel) {}
      v.dataset.mcWindsorHomeApplied = SRC;
      try {
        v.load();
      } catch (eLoad) {}
    }

    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.classList.remove("is-preloading");
    v.classList.add("is-ready");
    try {
      v.style.setProperty("opacity", "1", "important");
    } catch (eOp) {}

    function seekPlay() {
      try {
        if (!v.dataset.mcStartedAtSeven) {
          v.dataset.mcStartedAtSeven = "1";
          v.currentTime = 7;
        }
        v.play && v.play().catch(function () {});
      } catch (ePlay) {}
    }

    if (v.readyState >= 1) seekPlay();
    else v.addEventListener("loadedmetadata", seekPlay, { once: true });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", applyWindsorHero);
  else applyWindsorHero();
  g.addEventListener("load", applyWindsorHero);
  [250, 1000, 2500, 5000].forEach(function (ms) {
    g.setTimeout(applyWindsorHero, ms);
  });
})(window, document);

/* Cart checkout CTA — bootstrap from baked template (mc-cart-checkout-fix.js may not be in rebaked HTML). */
(function (g, d) {
  "use strict";
  var p = String(g.location.pathname || "").toLowerCase();
  if (!/shoppingcart|shopcart\.asp|\/cart\b/.test(p)) return;
  function loadCartFix() {
    if (g.__MC_CART_CHECKOUT_FIX__) return;
    var s = d.createElement("script");
    s.src = "/v/vspfiles/js/mc-cart-checkout-fix.js?v=20260620cart3&mcrd=" + Date.now();
    s.async = false;
    (d.head || d.documentElement).appendChild(s);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", loadCartFix);
  else loadCartFix();
})(window, document);
/* MC_SARANONI_EMERGENCY_STABILIZER_20260623_1
   Scope: SAR product pages only.
   Restores the main image and keeps the accordion above purchase controls.
*/
(function () {
  "use strict";

  if (!/\/product-p\/sar-/i.test(String(window.location.pathname || ""))) {
    return;
  }

  if (window.__MC_SARANONI_EMERGENCY_STABILIZER_20260623_1__) {
    return;
  }

  window.__MC_SARANONI_EMERGENCY_STABILIZER_20260623_1__ = true;

  var fixing = false;
  var scheduled = false;

  function showElement(element, displayValue) {
    if (!element || !element.style) {
      return;
    }

    element.hidden = false;
    element.removeAttribute("hidden");
    element.removeAttribute("aria-hidden");

    element.style.setProperty(
      "display",
      displayValue || "block",
      "important"
    );
    element.style.setProperty("visibility", "visible", "important");
    element.style.setProperty("opacity", "1", "important");
    element.style.setProperty("height", "auto", "important");
    element.style.setProperty("max-height", "none", "important");
    element.style.setProperty("overflow", "visible", "important");
    element.style.setProperty("transform", "none", "important");
  }

  function isElementHidden(el) {
    if (!el) return true;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return true;
    } catch (e) {}
    return false;
  }

  function restoreMainImage() {
    var image =
      document.querySelector("#product_photo") ||
      document.querySelector("#product_photo_zoom_url img") ||
      document.querySelector(
        "td.mc-pdp-media-td img[src*='/vspfiles/photos/']"
      );

    if (!image || !isElementHidden(image)) {
      return;
    }

    var immediateCell = image.closest("td.mc-pdp-media-td");

    if (immediateCell) {
      showElement(immediateCell, "table-cell");

      immediateCell.style.setProperty("width", "100%", "important");
      immediateCell.style.setProperty("min-width", "0", "important");
      immediateCell.style.setProperty("max-width", "none", "important");
      immediateCell.style.setProperty("flex", "none", "important");
      immediateCell.style.setProperty(
        "vertical-align",
        "top",
        "important"
      );
    }

    var mediaHost =
      document.querySelector("#product_photo_td") ||
      image.closest(".mc-pdp-media-td") ||
      image.parentElement;

    if (mediaHost) {
      showElement(
        mediaHost,
        mediaHost.tagName === "TD" ? "table-cell" : "block"
      );
    }

    var current = image.parentElement;
    var depth = 0;

    while (current && current !== document.body && depth < 7) {
      current.hidden = false;
      current.removeAttribute("hidden");
      current.removeAttribute("aria-hidden");
      current.style.setProperty("visibility", "visible", "important");
      current.style.setProperty("opacity", "1", "important");
      current.style.setProperty("height", "auto", "important");
      current.style.setProperty("max-height", "none", "important");
      current.style.setProperty("overflow", "visible", "important");

      current = current.parentElement;
      depth += 1;
    }

    showElement(image, "block");

    image.style.setProperty("width", "auto", "important");
    image.style.setProperty("max-width", "650px", "important");
    image.style.setProperty("height", "auto", "important");
    image.style.setProperty("max-height", "none", "important");
    image.style.setProperty("margin", "0 auto", "important");
    image.style.setProperty("object-fit", "contain", "important");
  }

  function findAccordion() {
    return (
      document.querySelector("#mc-pdp-accordion") ||
      document.querySelector(".mc-pdp-accordion") ||
      document.querySelector("[data-mc-pdp-accordion]") ||
      Array.from(
        document.querySelectorAll("section, div")
      ).find(function (element) {
        var text = String(element.textContent || "").toUpperCase();

        return (
          text.indexOf("PRODUCT DETAILS") !== -1 &&
          text.indexOf("FEATURES") !== -1 &&
          element.querySelector("button, [role='button']")
        );
      }) ||
      null
    );
  }

  function findPurchaseControls() {
    var purchase =
      document.querySelector("#mc-pdp-purchase-stack") ||
      document.querySelector(".mc-unified-purchase-controls") ||
      document.querySelector(".mc-atc-button-wrap") ||
      document.querySelector("[data-mc-purchase-controls]");

    if (purchase) {
      return purchase;
    }

    var addToCart =
      document.querySelector("input[name='btnaddtocart']") ||
      document.querySelector("button[name='btnaddtocart']") ||
      document.querySelector("[onclick*='addtocart' i]");

    if (!addToCart) {
      return null;
    }

    return (
      addToCart.closest(
        ".mc-unified-purchase-controls, " +
        ".mc-atc-button-wrap, " +
        ".v65-productdetail-cart, " +
        "form, table, tr, td, div"
      ) || addToCart.parentElement
    );
  }

  function orderRightColumn() {
    var accordion = findAccordion();
    var purchase = findPurchaseControls();

    if (!accordion || !purchase || accordion === purchase) {
      return;
    }

    if (accordion.contains(purchase) || purchase.contains(accordion)) {
      return;
    }

    var sharedParent =
      accordion.parentElement === purchase.parentElement
        ? accordion.parentElement
        : null;

    if (sharedParent) {
      if (accordion.nextElementSibling !== purchase) {
        sharedParent.insertBefore(accordion, purchase);
      }

      return;
    }

    if (purchase.parentElement) {
      purchase.parentElement.insertBefore(accordion, purchase);
    }
  }

  function showPurchaseControls() {
    var quantity =
      document.querySelector("input[name^='QTY.']") ||
      document.querySelector("input[name='quantity']");

    var addToCart =
      document.querySelector("input[name='btnaddtocart']") ||
      document.querySelector("button[name='btnaddtocart']");

    if (quantity && isElementHidden(quantity)) {
      showElement(quantity, "inline-block");
      quantity.style.setProperty("position", "static", "important");
    }

    if (addToCart && isElementHidden(addToCart)) {
      showElement(addToCart, "inline-block");
      addToCart.style.setProperty("position", "static", "important");
    }
  }

  function repair() {
    if (fixing) {
      return;
    }

    fixing = true;

    try {
      restoreMainImage();
      showPurchaseControls();
      // Node ordering (accordion vs purchase controls) is owned solely by the
      // main layout pass (SARANONI_INFO_COLUMN_ORDER / ensureSaranoniPdpAccordion).
      // This stabilizer must not move those nodes too: two observers reordering
      // them in opposite directions caused the ATC to bounce above/below the
      // accordion. Image restore + visibility below are style-only and idempotent.
    } finally {
      fixing = false;
    }
  }

  function scheduleRepair() {
    if (scheduled) {
      return;
    }

    scheduled = true;

    window.requestAnimationFrame(function () {
      scheduled = false;
      repair();
    });
  }

  function start() {
    repair();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true
    });
  } else {
    start();
  }
})();

/* MC_SARANONI_KILL_LEGACY_STABILIZER_20260624
   Live PDP pages still have a CDN-cached ?mcrd=live copy of this file baked into
   their template. That old copy installs an emergency-stabilizer MutationObserver
   (window.__MC_SARANONI_EMERGENCY_OBSERVER__) whose orderRightColumn() forces
   accordion-above-ATC, fighting this fresh copy's ordering and making the ATC
   bounce. This fresh copy is always loaded via ?mcrd=Date.now(), so it can
   disconnect that legacy observer here — leaving the main layout pass as the sole
   owner of column order. Our own (orderRightColumn-free) observer is renamed
   _V2__ above so this never disconnects it. Safe to remove once the template
   (which no longer emits the ?mcrd=live tag) re-bakes onto live pages. */
(function (g) {
  function killLegacyStabilizer() {
    try {
      var obs = g.__MC_SARANONI_EMERGENCY_OBSERVER__;
      if (obs && typeof obs.disconnect === "function") {
        obs.disconnect();
        g.__MC_SARANONI_EMERGENCY_OBSERVER__ = null;
      }
    } catch (eKill) {}
  }
  [0, 100, 400, 1000, 2000].forEach(function (ms) {
    g.setTimeout(killLegacyStabilizer, ms);
  });
  if (g.document && g.document.addEventListener) {
    g.document.addEventListener("DOMContentLoaded", killLegacyStabilizer);
  }
})(window);

/* MC_UNIFIED_PDP_WIDTH_CHAIN_20260713
   Keep Saranoni, bean-bag and Steve Silver PDPs on one mobile geometry.
   Observe inserted nodes only; watching our own style writes caused scroll
   reflows and variant-selection jitter on phones. */
(function (g) {
  "use strict";

  var doc = g.document;
  if (!doc || !g.MutationObserver || !g.matchMedia) return;

  function isUnifiedFamilyPdp() {
    var path = String((g.location && g.location.pathname) || "").toLowerCase();
    if (/\/product-p\/(?:sar-|bb-|ss-)/.test(path)) return true;
    var body = doc.body;
    return !!(
      body &&
      (body.classList.contains("mc-saranoni-pdp") ||
        body.classList.contains("mc-saranoni-product") ||
        body.classList.contains("mc-bean-bag-pdp") ||
        body.classList.contains("mc-steve-silver-pdp"))
    );
  }

  function setImportant(el, prop, value) {
    if (!el || !el.style) return;
    if (
      el.style.getPropertyValue(prop) === value &&
      el.style.getPropertyPriority(prop) === "important"
    ) return;
    el.style.setProperty(prop, value, "important");
  }

  function flatten(node) {
    if (!node || !node.tagName) return;
    /* Never un-hide native price/option/related tables here — writing
       display:block fights Volusion's own display:none toggle on these,
       making the options column height oscillate and jumping Related
       Items while scrolling on mobile. */
    if (
      (node.classList &&
        (node.classList.contains("colors_pricebox") ||
          node.classList.contains("vol-option-name") ||
          node.classList.contains("vol-option-about") ||
          node.classList.contains("vol-option-items"))) ||
      (node.id && (node.id === "options_table" || node.id === "related_products_content")) ||
      (node.closest &&
        node.closest(
          "table.colors_pricebox, #options_table, #v65-product-related, .mc-related-plp-grid"
        ))
    ) {
      return;
    }
    var tag = node.tagName;
    setImportant(node, "width", "100%");
    setImportant(node, "max-width", "100%");
    setImportant(node, "min-width", "0px");
    setImportant(node, "box-sizing", "border-box");
    setImportant(node, "margin-left", "0px");
    setImportant(node, "margin-right", "0px");
    if (tag === "TABLE" || tag === "TBODY" || tag === "TR" || tag === "TD") {
      setImportant(node, "display", "block");
      setImportant(node, "padding-left", "0px");
      setImportant(node, "padding-right", "0px");
      setImportant(node, "float", "none");
      setImportant(node, "transform", "none");
    }
  }

  function repairMobileWidthChain() {
    if (!isUnifiedFamilyPdp() || !g.matchMedia("(max-width: 991px)").matches) return;
    if (g.__MC_UNIFIED_PDP_WIDTH_WRITING__) return;
    var root = doc.getElementById("v65-product-parent");
    if (!root) return;
    g.__MC_UNIFIED_PDP_WIDTH_WRITING__ = true;

    try {
    [
      doc.querySelector("section.content_area-wrapper"),
      doc.getElementById("content_area"),
      root,
    ].forEach(function (node) {
      if (!node) return;
      flatten(node);
      setImportant(node, "padding-left", "0px");
      setImportant(node, "padding-right", "0px");
    });

    root.querySelectorAll(
      "#product_photo, #product_photo_zoom_url, " +
        "#mc-saranoni-size-thumbs, #mc-configured-color-swatch-wrapper, " +
        "#beanbag-swatch-wrapper, #mc-bb-size-section, #mc-pdp-features, " +
        "#mc-pdp-accordion, #mc-pdp-purchase-stack, .mc-pdp-purchase-controls"
    ).forEach(function (start) {
      var node = start;
      while (node && node !== root) {
        flatten(node);
        node.setAttribute("data-mc-pdp-mobile-wide", "1");
        node = node.parentElement;
      }
    });

    var row = root.querySelector("tr.mc-pdp-main-row,tr.mc-unified-pdp-row");
    if (row) {
      flatten(row);
      setImportant(row, "display", "flex");
      setImportant(row, "flex-direction", "column");
      setImportant(row, "align-items", "stretch");
      setImportant(row, "gap", "12px");
      setImportant(row, "flex", "0 0 auto");
      setImportant(row, "flex-basis", "auto");
      Array.prototype.forEach.call(row.children || [], function (cell) {
        flatten(cell);
        setImportant(cell, "display", "flex");
        setImportant(cell, "flex", "0 0 auto");
        setImportant(cell, "flex-direction", "column");
        setImportant(cell, "align-items", "stretch");
        setImportant(cell, "padding", "0px");
      });
    }

    var hero = doc.getElementById("product_photo");
    var zoom = doc.getElementById("product_photo_zoom_url");
    [hero, zoom].forEach(function (node) {
      if (!node) return;
      setImportant(node, "display", "block");
      setImportant(node, "width", "100%");
      setImportant(node, "max-width", "100%");
      setImportant(node, "height", "auto");
      setImportant(node, "margin-left", "auto");
      setImportant(node, "margin-right", "auto");
    });
    } finally {
      g.__MC_UNIFIED_PDP_WIDTH_WRITING__ = false;
    }
  }

  function scheduleRepair() {
    if (g.__MC_UNIFIED_PDP_WIDTH_SCHEDULED__ || g.__MC_UNIFIED_PDP_WIDTH_WRITING__) return;
    g.__MC_UNIFIED_PDP_WIDTH_SCHEDULED__ = true;
    var run = function () {
      g.__MC_UNIFIED_PDP_WIDTH_SCHEDULED__ = false;
      repairMobileWidthChain();
      installTargetObservers();
    };
    if (typeof g.queueMicrotask === "function") g.queueMicrotask(run);
    else g.setTimeout(run, 0);
  }

  function installTargetObservers() {
    if (!isUnifiedFamilyPdp()) return;
    try {
      var observer = g.__MC_UNIFIED_PDP_WIDTH_OBSERVER__;
      if (!observer) {
        observer = new g.MutationObserver(function () {
          if (g.__MC_UNIFIED_PDP_WIDTH_WRITING__) return;
          scheduleRepair();
        });
        g.__MC_UNIFIED_PDP_WIDTH_OBSERVER__ = observer;
      }
      observer.disconnect();
      var root = doc.getElementById("v65-product-parent");
      var row = root && root.querySelector("tr.mc-pdp-main-row,tr.mc-unified-pdp-row");
      var targets = [
        doc.querySelector("section.content_area-wrapper"),
        doc.getElementById("content_area"),
        root,
        row,
      ];
      if (row) Array.prototype.push.apply(targets, Array.prototype.slice.call(row.children || []));
      targets.forEach(function (node) {
        if (node) observer.observe(node, { attributes: true, attributeFilter: ["style", "class"] });
      });
      if (root) observer.observe(root, { childList: true, subtree: true });
    } catch (eObserve) {}
  }

  scheduleRepair();
  doc.addEventListener("DOMContentLoaded", scheduleRepair);
  g.addEventListener("load", scheduleRepair);
  g.addEventListener("resize", scheduleRepair);
  // The currently baked stable helper has a final 7s pass. Reassert twice
  // after that finite window, then stop; no scroll-time polling is needed.
  [100, 400, 1000, 2500, 5000, 7600, 9000].forEach(function (ms) {
    g.setTimeout(scheduleRepair, ms);
  });
})(window);

/* MC_SS_ALT_CLICK_FINAL_20260713
   Window-capture ownership runs before legacy document-level thumbnail hooks,
   so a deliberate room-scene selection cannot be reset to photo 1. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_SS_ALT_CLICK_FINAL_20260713__) return;
  g.__MC_SS_ALT_CLICK_FINAL_20260713__ = true;
  if (d.documentElement) d.documentElement.setAttribute("data-mc-ss-alt-click-final", "1");
  g.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("#altviews [data-mc-ss-alt]") : null;
    if (!link) return;
    var field = d.querySelector('input[name="ProductCode"],input[name="productcode"]');
    var code = String(g.global_Current_ProductCode || (field && field.value) || "").trim().toUpperCase();
    if (!/^SS-/.test(code)) return;
    var slot = parseInt(link.getAttribute("data-mc-ss-alt"), 10);
    var hero = d.getElementById("product_photo");
    if (!slot || !hero) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    d.documentElement.setAttribute("data-mc-ss-last-alt", String(slot));
    hero.__mcSsUserSelectedAlt = true;
    var full = "/v/vspfiles/photos/" + code + "-" + slot + ".jpg";
    function holdSelection() {
      hero.__mcSsUserSelectedAlt = true;
      hero.setAttribute("src", full);
      hero.removeAttribute("srcset");
    }
    holdSelection();
    [0, 50, 200, 600, 1200].forEach(function (ms) { g.setTimeout(holdSelection, ms); });
    var zoom = d.getElementById("product_photo_zoom_url") || d.getElementById("product_photo_zoom_url2");
    if (zoom) zoom.setAttribute("href", full);
  }, true);
})(window, document);

/* MC_RETIRED_MEMBER_UI_20260713
   Member pricing has been retired. Hide both the former custom member-price
   nodes and Volusion's anonymous-account warning if stale code adds them. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_RETIRED_MEMBER_UI_20260713__) return;
  g.__MC_RETIRED_MEMBER_UI_20260713__ = true;
  var selectors = [
    ".mc-pdp-member-pricing", ".mc-pdp-member-line", ".mc-member-price-caption",
    ".mc-planner-login-gate", ".mc-pdp-login-gate", "[data-mc-member-price]",
    "[data-mc-open-login].mc-pdp-member-cta"
  ].join(",");
  function root() {
    return d.getElementById("v65-product-parent") || d.getElementById("content_area");
  }
  function hide(node) {
    if (!node || !node.style) return;
    node.setAttribute("data-mc-retired-member-ui", "1");
    [
      ["display", "none"], ["visibility", "hidden"], ["height", "0px"],
      ["min-height", "0px"], ["margin", "0px"], ["padding", "0px"],
      ["overflow", "hidden"], ["pointer-events", "none"]
    ].forEach(function (pair) { node.style.setProperty(pair[0], pair[1], "important"); });
  }
  function cleanup() {
    var host = root();
    if (!host) return;
    host.querySelectorAll(selectors).forEach(hide);
    var warnings = Array.prototype.filter.call(host.querySelectorAll("div,table,tbody,tr,td,font,span"), function (node) {
      var text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      return text.length > 0 && text.length < 260 &&
        /to access your account/i.test(text) && /e-?mail address/i.test(text) && /password/i.test(text);
    });
    warnings.sort(function (a, b) { return String(a.textContent || "").length - String(b.textContent || "").length; });
    if (!warnings.length) return;
    var box = warnings[0];
    while (box.parentElement && box.parentElement !== host &&
      /to access your account/i.test(box.parentElement.textContent || "") &&
      (box.parentElement.getBoundingClientRect().width || 0) < 520) box = box.parentElement;
    hide(box);
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", cleanup, { once: true });
  else cleanup();
})(window, document);

/* MC_EMPTY_NUMBERED_ALT_RESTORE_20260713
   Restore numbered Volusion product photos only when the gallery is empty.
   Mahjong's working eight-image gallery and bean-bag swatches are untouched. */
(function (g, d) {
  "use strict";
  if (!g || !d || g.__MC_EMPTY_NUMBERED_ALT_RESTORE_20260713__) return;
  g.__MC_EMPTY_NUMBERED_ALT_RESTORE_20260713__ = true;
  function code() {
    var field = d.querySelector('input[name="ProductCode"],input[name="productcode"]');
    return String(g.global_Current_ProductCode || (field && field.value) || "").trim().toUpperCase();
  }
  function full(productCode, slot) {
    return "/v/vspfiles/photos/" + productCode + "-" + slot + ".jpg";
  }
  function thumb(productCode, slot) {
    return "/v/vspfiles/photos/" + productCode + "-" + slot + "T.jpg";
  }
  function setHero(productCode, slot) {
    var hero = d.getElementById("product_photo");
    if (!hero) return;
    hero.setAttribute("src", full(productCode, slot));
    hero.removeAttribute("srcset");
    var zoom = d.getElementById("product_photo_zoom_url") || d.getElementById("product_photo_zoom_url2");
    if (zoom) zoom.setAttribute("href", full(productCode, slot));
  }
  function restore() {
    var productCode = code();
    var hero = d.getElementById("product_photo");
    var root = d.getElementById("v65-product-parent");
    if (!root || !productCode || !hero || /^(?:TMH-|BB-|SS-)/.test(productCode)) return;
    var alt = d.getElementById("altviews") || d.querySelector("span#altviews,.altviews");
    if (alt && alt.querySelector("img")) return;
    if (!alt) {
      alt = d.createElement("span");
      alt.id = "altviews";
      var mediaCell = hero.closest("td");
      if (!mediaCell) return;
      mediaCell.appendChild(alt);
    }
    if (alt.querySelector("[data-mc-numbered-alt]")) return;
    alt.setAttribute("data-mc-numbered-alt-building", productCode);
    alt.classList.remove("mc-altviews-empty");
    alt.classList.add("altviews", "mc-restored-numbered-altviews");
    alt.style.setProperty("display", "none", "important");
    alt.style.setProperty("width", "100%", "important");
    alt.style.setProperty("max-width", "650px", "important");
    alt.style.setProperty("flex-wrap", "wrap", "important");
    alt.style.setProperty("gap", "8px", "important");
    alt.style.setProperty("margin", "12px 0 0", "important");
    alt.style.setProperty("padding", "0", "important");
    var current = String(hero.getAttribute("src") || hero.src || "");
    var match = current.match(/-(\d+)(?:T)?\.(?:jpe?g|png|webp)(?:[?#]|$)/i);
    var currentSlot = match ? parseInt(match[1], 10) : 0;
    for (var slot = 1; slot <= 8; slot += 1) {
      if (slot === currentSlot) continue;
      (function (photoSlot) {
        var link = d.createElement("a");
        var image = d.createElement("img");
        link.href = full(productCode, photoSlot);
        link.setAttribute("data-mc-numbered-alt", String(photoSlot));
        link.style.setProperty("display", "none", "important");
        image.className = "vCSS_img_alternate_product_photo";
        image.alt = "Alternate view";
        image.src = thumb(productCode, photoSlot);
        image.style.setProperty("width", "88px", "important");
        image.style.setProperty("height", "88px", "important");
        image.style.setProperty("object-fit", "cover", "important");
        image.onload = function () {
          link.style.setProperty("display", "inline-flex", "important");
          alt.style.setProperty("display", "flex", "important");
        };
        image.onerror = function () {
          /* Luxe/Cordaroy often ship full-size -N.jpg without -NT.jpg thumbs */
          if (image.getAttribute("data-mc-alt-fallback") !== "1") {
            image.setAttribute("data-mc-alt-fallback", "1");
            image.src = full(productCode, photoSlot);
            return;
          }
          if (link.parentNode) link.parentNode.removeChild(link);
          if (!alt.querySelector("img")) alt.style.setProperty("display", "none", "important");
        };
        link.onclick = function (event) {
          if (event) event.preventDefault();
          setHero(productCode, photoSlot);
          return false;
        };
        link.appendChild(image);
        alt.appendChild(link);
      })(slot);
    }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", restore, { once: true });
  else restore();
})(window, document);

/* MC_PDP_RELATED_FIX_20260630 — NoPhoto thumbs + visible prices when template rail is still native table */
(function (g) {
  function volusionCodeFromHref(href) {
    var h = String(href || "");
    var m =
      h.match(/\/-p\/([^.\/?#]+)/i) ||
      h.match(/\/product-p\/([^.\/?#]+)/i) ||
      h.match(/[?&]ProductCode=([^&]+)/i) ||
      h.match(/[?&]productcode=([^&]+)/i);
    if (!m || !m[1]) return "";
    var raw = String(m[1]);
    try {
      raw = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
    } catch (eDec) {}
    return raw.replace(/\.htm.*/i, "").toUpperCase();
  }

  function isPlaceholderSrc(src) {
    var s = String(src || "").trim();
    if (!s || /^data:/i.test(s)) return true;
    if (/clear1x1\.gif/i.test(s)) return true;
    if (/nophoto/i.test(s)) return true;
    return false;
  }

  function bindThumbSwap(img, code) {
    if (!img || !code) return;
    img.onerror = function () {
      var cur = img.getAttribute("src") || "";
      if (/-1\.(jpg|jpeg|png|webp)(\?|$)/i.test(cur)) {
        img.onerror = null;
        img.setAttribute("src", "/v/vspfiles/photos/" + code + "-2T.jpg");
        return;
      }
      if (/-2T\.(jpg|jpeg|png|webp)(\?|$)/i.test(cur)) {
        img.onerror = null;
        img.setAttribute("src", "/v/vspfiles/photos/" + code + "-1.jpg");
      }
    };
  }

  function fixRelatedNoPhotoImages(root) {
    var scope = root || g.document;
    scope
      .querySelectorAll(
        "#v65-product-related img, #related_products_content img, .mc-related-plp-card__media img"
      )
      .forEach(function (img) {
        try {
          if (!img || img.id === "product_photo" || img.id === "main-image") return;
          var link =
            (img.closest &&
              img.closest(
                'a[href*="-p/"], a[href*="product-p/"], a[href*="ProductCode="], a[href*="productcode="]'
              )) ||
            null;
          if (!link) return;
          var code = volusionCodeFromHref(link.getAttribute("href") || link.href || "");
          if (!code) return;
          if (!isPlaceholderSrc(img.getAttribute("src") || img.src)) return;
          img.setAttribute("src", "/v/vspfiles/photos/" + code + "-1.jpg");
          bindThumbSwap(img, code);
        } catch (eImg) {}
      });
  }

  function showRelatedPrices(root) {
    var scope = root || g.document;
    scope
      .querySelectorAll(
        "#v65-product-related .product_productprice, #related_products_content .product_productprice, " +
          ".mc-related-plp-card__price, .mc-related-plp-card__price .product_productprice, " +
          ".mc-related-plp-card__price .product_price, .mc-related-plp-card__price font.pricecolorsmall"
      )
      .forEach(function (node) {
        try {
          node.style.setProperty("display", "block", "important");
          node.style.setProperty("visibility", "visible", "important");
          node.style.setProperty("opacity", "1", "important");
          node.style.setProperty("height", "auto", "important");
          node.style.setProperty("max-height", "none", "important");
        } catch (eShow) {}
      });
  }

  function runRelatedFix() {
    if (
      !g.document.body ||
      (!g.document.body.classList.contains("productdetails") &&
        !g.document.body.classList.contains("mc-product-page"))
    ) {
      return;
    }
    try {
      if (typeof g.mcRunRelatedFix === "function") g.mcRunRelatedFix();
    } catch (eTpl) {}
    fixRelatedNoPhotoImages(g.document);
    showRelatedPrices(g.document);
  }

  g.mcFixPdpRelatedSection = runRelatedFix;

  function bootRelated() {
    runRelatedFix();
    g.setTimeout(runRelatedFix, 400);
    g.setTimeout(runRelatedFix, 1200);
    g.setTimeout(runRelatedFix, 2800);
  }

  if (g.document.readyState === "loading") {
    g.document.addEventListener("DOMContentLoaded", bootRelated);
  } else {
    bootRelated();
  }
  g.addEventListener("load", bootRelated);

  if (g.MutationObserver && g.document.body) {
    var t;
    var mo = new g.MutationObserver(function () {
      g.clearTimeout(t);
      t = g.setTimeout(runRelatedFix, 150);
    });
    try {
      mo.observe(g.document.body, { childList: true, subtree: true });
    } catch (eMo) {}
  }
})(window);
