/**
 * PDP Sign In / Create Account — modal only, no /login.asp redirect, no room planner on gate clicks.
 * Post-login: close modal first, refresh member/planner pricing in background (works without template rebake).
 * MC_PDP_AUTH_CTA_20260624 — price stack repair MC_PDP_PRICE_STACK_20260522 (no template rebake)
 */
(function (global) {
  "use strict";

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

  var VERSION = "20260616pdp38k";
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
    "SAR-DBL-RCH-FX-FUR": [
      {
        optionId: "1013",
        label: "Snow",
        swatchImage: "SAR-DBL-RCH-FX-FUR-1013-S.jpg",
        mainImage: "SAR-DBL-RCH-FX-FUR-1013-T.jpg",
      },
      {
        optionId: "1014",
        label: "Flax",
        swatchImage: "SAR-DBL-RCH-FX-FUR-1014-S.jpg",
        mainImage: "SAR-DBL-RCH-FX-FUR-1014-T.jpg",
      },
    ],
  };
  // When a configured-color swatch is chosen we "lock" that selection so that
  // MutationObserver-driven re-renders (and Volusion's async option-image logic)
  // cannot wipe the active swatch or blank the hero image.
  var configuredColorActiveEntry = null;
  var configuredColorActiveSrc = "";
  var configuredColorDefaultSrc = "";
  var configuredColorEnforceUntil = 0;
  var configuredColorEnforceTimer = null;
  var PDP_HERO_ANTIFLICKER_SEL =
    "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-brand-logo,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-brand-logo," +
    "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-title-right,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-title-right," +
    "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-price-stack-host,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-price-stack-host," +
    "body.productdetails:not(.mc-pdp-hero-ready) #beanbag-swatch-wrapper,body.mc-product-page:not(.mc-pdp-hero-ready) #beanbag-swatch-wrapper," +
    "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-features,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-features," +
    "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-purchase-stack";
  /* Set immediately so console/deploy checks work even if later init throws */
  global.__MC_PDP_AUTH_CTA_FIX_VER__ = VERSION;

  (function injectPdpHeroAntiFlickerEarly() {
    try {
      if (!global.document || global.document.getElementById("mc-pdp-hero-antiflicker-css")) return;
      var path = String(global.location.pathname || "").toLowerCase();
      if (!/(?:-p\/|product-p\/)/.test(path)) return;
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
          if (!global.__MC_PDP_HERO_READY_LOCKED__) markPdpHeroReady();
        }, 2200);
      }
    } catch (eAf) {}
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
        global.document.getElementById("mc-pdp-purchase-stack")
      );
    }
    return !!global.document.getElementById("mc-pdp-purchase-stack");
  }

  function applyPdpTitleTypography() {
    var wrap = global.document.getElementById("mc-pdp-title-right");
    if (!wrap) return;
    try {
      wrap.style.setProperty("padding-left", "1.1em", "important");
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

  function findPdpMainProductRow() {
    return (
      global.document.querySelector("#v65-product-parent tr.mc-pdp-main-row") ||
      global.document.querySelector("#v65-product-parent > tbody > tr:nth-of-type(2)") ||
      global.document.querySelector("#v65-product-parent > tr:nth-of-type(2)")
    );
  }

  function moveDescriptionContentIntoHost(host, descDiv) {
    if (!host || !descDiv) return;
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
    } catch (eDescStyle) {}
  }

  function mountBeanBagDescriptionBelowHero() {
    if (!isBeanBagPdpPage()) return;
    var descDiv =
      global.document.getElementById("ProductDetail_ProductDetails_div") ||
      global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (!descDiv) return;
    if (descDiv.querySelector("#beanbag-swatch-wrapper")) return;
    var mainRow = findPdpMainProductRow();
    if (!mainRow || !mainRow.parentNode) return;
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-below-features";
      host.className = "mc-pdp-description-below-features";
    }
    var descRow = global.document.getElementById("mc-pdp-description-row");
    if (!descRow) {
      descRow = global.document.createElement("tr");
      descRow.id = "mc-pdp-description-row";
      descRow.className = "mc-pdp-description-row";
      var descCell = global.document.createElement("td");
      descCell.className = "mc-pdp-description-cell";
      descCell.colSpan = 2;
      descRow.appendChild(descCell);
    }
    var descCell = descRow.querySelector("td.mc-pdp-description-cell") || descRow.querySelector("td");
    if (descCell && !descCell.contains(host)) {
      try {
        descCell.appendChild(host);
      } catch (eCell) {}
    }
    if (mainRow.nextElementSibling !== descRow) {
      try {
        mainRow.parentNode.insertBefore(descRow, mainRow.nextElementSibling);
      } catch (eRow) {}
    }
    try {
      host.style.setProperty("display", "block", "important");
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "760px", "important");
      host.style.setProperty("margin", "38px auto 0", "important");
      host.style.setProperty("padding", "0", "important");
      host.style.setProperty("box-sizing", "border-box", "important");
      host.style.setProperty("text-align", "left", "important");
      host.style.setProperty("clear", "both", "important");
    } catch (eHostStyle) {}
    moveDescriptionContentIntoHost(host, descDiv);
    try {
      pruneDescriptionDuplicateFeatures();
    } catch (ePrune) {}
  }

  function mountPdpDescriptionUnderMedia() {
    if (!isProductPdp()) return;
    if (!isBeanBagPdpPage()) return;
    var descDiv = global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (!descDiv) return;
    var mediaTd = findPdpMediaTd();
    if (!mediaTd || mediaTd.contains(descDiv)) return;
    var host = global.document.getElementById("mc-pdp-description-under-media");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-under-media";
      host.className = "mc-pdp-description-under-media";
    }
    var altviews =
      mediaTd.querySelector("#altviews") ||
      mediaTd.querySelector("span#altviews") ||
      global.document.getElementById("altviews");
    if (altviews && altviews.parentNode === mediaTd) {
      try {
        if (altviews.nextSibling) mediaTd.insertBefore(host, altviews.nextSibling);
        else mediaTd.appendChild(host);
      } catch (eIns) {
        mediaTd.appendChild(host);
      }
    } else {
      try {
        mediaTd.appendChild(host);
      } catch (eTd) {}
    }
    if (descDiv.parentNode !== host) {
      try {
        host.appendChild(descDiv);
      } catch (eMove) {}
    }
    try {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "650px", "important");
      host.style.setProperty("margin", "10px 0 0 0", "important");
      host.style.setProperty("padding", "0", "important");
      host.style.setProperty("text-align", "left", "important");
      descDiv.style.setProperty("margin", "0", "important");
      descDiv.style.setProperty("padding", "0", "important");
    } catch (eHost) {}
    pruneDescriptionDuplicateFeatures();
  }

  function applyPdpMainImageCap() {
    if (!isProductPdp()) return;
    var img = global.document.getElementById("product_photo");
    if (img) {
      try {
        img.style.setProperty("max-width", "650px", "important");
        img.style.setProperty("width", "100%", "important");
        img.style.setProperty("height", "auto", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
      } catch (eImg) {}
    }
    global.document.querySelectorAll("#product_photo_zoom_url, a#product_photo_zoom_url2").forEach(function (link) {
      try {
        link.style.setProperty("max-width", "650px", "important");
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
    ".mc-pdp-member-line__amount,.v65-product-price,.mc-member-grid-price__amount";

  function stripPriceZeroCentsInTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var v = node.nodeValue;
    if (!v || v.indexOf(".00") === -1) return;
    var nv = v.replace(/(\$\d[\d,]*)\.00(?!\d)/g, "$1");
    if (nv !== v) node.nodeValue = nv;
  }

  function stripPriceZeroCents(root) {
    root = root || global.document.body;
    if (!root || !root.querySelectorAll) return;
    try {
      root.querySelectorAll(PRICE_ZERO_CENT_SELECTOR).forEach(function (el) {
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
    return (
      "$" +
      n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
      "display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;opacity:0!important}";
  }

  function placePriceStackHost(host) {
    if (!host) return;
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage()) return;
    if (isSoftGoodsPdpPage()) {
      var sgCol = findPdpHeroColumnTd();
      if (!sgCol) return;
      var titleEl = global.document.getElementById("mc-pdp-title-right");
      if (titleEl && titleEl.parentNode === sgCol) {
        if (host.parentNode !== sgCol || host.previousElementSibling !== titleEl) {
          try {
            if (titleEl.nextSibling) {
              sgCol.insertBefore(host, titleEl.nextSibling);
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
    var w = img.naturalWidth || img.width || 0;
    var h = img.naturalHeight || img.height || 0;
    if (w <= 1 && h <= 1) return false;
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
    if (isPdpLayoutMounted()) return;
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

  function moveAltViewsUnderMainImage() {
    var alt =
      global.document.getElementById("altviews") ||
      global.document.querySelector("#content_area .altviews, #v65-product-parent .altviews");
    if (!alt) return;
    var main =
      global.document.getElementById("product_photo") ||
      global.document.querySelector("img#main-image, #v65-product-parent img#product_photo");
    if (!main || !main.parentNode) return;
    if (main.nextElementSibling === alt) return;
    try {
      main.parentNode.insertBefore(alt, main.nextSibling);
    } catch (eAlt) {}
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

  function placeBrandLogoBelowTitle() {
    if (isSaranoniPdpPage()) {
      ensureSaranoniBrandLogo();
      return;
    }
    if (
      isPdpLayoutMounted() &&
      global.document.getElementById("mc-pdp-brand-logo") &&
      global.document.getElementById("mc-pdp-brand-logo").querySelector("img")
    ) {
      return;
    }
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (wrap && wrap.querySelector("img")) {
      return;
    }
    var logo = findManufacturerLogoImg();
    if (!logo) return;
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo";
    }
    wrap.appendChild(logo);
    var col = findPdpHeroColumnTd();
    var titleEl = global.document.getElementById("mc-pdp-title-right");
    if (col && titleEl && titleEl.parentNode === col) {
      try {
        col.insertBefore(wrap, titleEl);
      } catch (eBeforeTitle) {}
    } else if (col && !col.contains(wrap)) {
      try {
        col.appendChild(wrap);
      } catch (eCol) {}
    }
  }

  var SARANONI_BRAND_LOGO_SRC = "/v/vspfiles/photos/manufacturers/saranoni%20blankets.jpg";

  function ensureSaranoniBrandLogo() {
    if (!isSaranoniPdpPage()) return;
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (wrap && wrap.querySelector("img")) {
      positionSaranoniBrandLogo(wrap);
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
    var features = global.document.getElementById("mc-pdp-features");
    if (features && features.parentNode) {
      return { parent: features.parentNode, after: features };
    }
    var desc = global.document.getElementById("mc-pdp-description-below-features");
    if (desc && desc.parentNode) {
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
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage()) return;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp"))
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
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage()) return;
    try {
      if (
        global.document.body &&
        (global.document.body.classList.contains("mc-theater-seating-pdp") ||
          global.document.documentElement.classList.contains("mc-paragon-pdp"))
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
        if (bcl && (bcl.contains("mc-bean-bag-pdp") || bcl.contains("mc-saranoni-pdp"))) {
          mcStackDir = "column";
          mcCartGap = "10px";
          mcAlign = "stretch";
        }
      } catch (eGap) {}
      stack.style.setProperty("flex-direction", mcStackDir, "important");
      stack.style.setProperty("align-items", mcAlign, "important");
      if (isBeanBagPdpPage()) {
        stack.style.setProperty("justify-content", "flex-start", "important");
        stack.style.setProperty("text-align", "left", "important");
        stack.style.setProperty("margin", "28px 0 0 0", "important");
        stack.style.setProperty("padding", "0 0 0 1.1em", "important");
      } else {
        stack.style.setProperty("justify-content", "center", "important");
        stack.style.setProperty("text-align", "center", "important");
        stack.style.setProperty("margin", "28px auto 0", "important");
        stack.style.setProperty("padding", "0", "important");
      }
      stack.style.setProperty("align-self", "stretch", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "100%", "important");
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
      stackNode.style.setProperty("width", isSoftGoodsPdpPage() ? "100%" : "auto", "important");
      stackNode.style.setProperty("max-width", isSoftGoodsPdpPage() ? "100%" : "none", "important");
      stackNode.style.setProperty("display", "flex", "important");
      stackNode.style.setProperty(
        "justify-content",
        isBeanBagPdpPage() ? "flex-start" : "center",
        "important"
      );
      stackNode.style.setProperty("margin", isSoftGoodsPdpPage() ? "0" : "0 auto", "important");
      stackNode.style.setProperty("flex", "0 0 auto", "important");
    } catch (eAtcBlock) {}
  }

  function applySoftGoodsColumnPurchaseStackLayout(stack, qtyRow, stackNode) {
    if (!isSoftGoodsPdpPage() || !stack) return;
    var beanBag = isBeanBagPdpPage();
    try {
      stack.classList.add("mc-pdp-cart-row", "mc-soft-goods-purchase-stack");
      if (isSaranoniPdpPage()) stack.classList.add("mc-saranoni-purchase-stack");
      if (beanBag) stack.classList.add("mc-bean-bag-purchase-stack");
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("align-items", "stretch", "important");
      stack.style.setProperty("max-width", "400px", "important");
      stack.style.setProperty("width", "100%", "important");
      if (beanBag) {
        stack.style.setProperty("margin-left", "0", "important");
        stack.style.setProperty("margin-right", "0", "important");
        stack.style.setProperty("padding-left", "1.1em", "important");
        stack.style.setProperty("text-align", "left", "important");
      }
    } catch (eStack) {}
    if (qtyRow) {
      try {
        qtyRow.style.setProperty("width", "100%", "important");
        qtyRow.style.setProperty(
          "justify-content",
          beanBag ? "flex-start" : "center",
          "important"
        );
      } catch (eQty) {}
    }
    var wrap = stack.querySelector(".mc-atc-button-wrap");
    if (wrap) {
      applySoftGoodsAtcChrome(wrap);
      try {
        wrap.style.setProperty("display", "flex", "important");
        wrap.style.setProperty(
          "justify-content",
          beanBag ? "flex-start" : "center",
          "important"
        );
        wrap.style.setProperty("align-items", "center", "important");
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
          btn.style.setProperty("justify-content", "center", "important");
          btn.style.setProperty("align-items", "center", "important");
          btn.style.setProperty("text-align", "center", "important");
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
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("padding", "0 28px", "important");
      btn.style.setProperty("min-height", "48px", "important");
      btn.style.setProperty("opacity", "1", "important");
      btn.style.setProperty("width", "100%", "important");
      btn.style.setProperty("display", "flex", "important");
      btn.style.setProperty("justify-content", "center", "important");
      btn.style.setProperty("align-items", "center", "important");
      btn.style.setProperty("text-align", "center", "important");
      btn.style.setProperty("box-sizing", "border-box", "important");
      btn.style.setProperty("-webkit-appearance", "none", "important");
      btn.style.setProperty("appearance", "none", "important");
    } catch (eBtn) {}
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
      wrap.style.setProperty("width", "auto", "important");
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
        btn.style.setProperty("width", "auto", "important");
        btn.style.setProperty("min-width", "0", "important");
        btn.style.setProperty("max-width", "none", "important");
        btn.style.setProperty("border-radius", "0", "important");
        btn.style.setProperty("cursor", "pointer", "important");
      }
    } catch (eAtc) {}
  }

  function fixAddToCartChrome() {
    injectAtcButtonWrap();
    global.document.querySelectorAll(".mc-atc-button-wrap").forEach(function (wrap) {
      if (wrap.closest("#mc-pdp-price-atc-row")) return;
      if (!isSoftGoodsPdpPage() && wrap.getAttribute("data-mc-atc-styled") === VERSION) return;
      styleCompactAtcButton(wrap);
      wrap.setAttribute("data-mc-atc-styled", VERSION);
    });
    global.document
      .querySelectorAll(
        '#mc-pdp-purchase-stack input[name="btnaddtocart"], #mc-pdp-purchase-stack button[name="btnaddtocart"], ' +
          '#mc-pdp-purchase-stack .v65-product-addtocart input[name="btnaddtocart"], #mc-pdp-purchase-stack .v65-product-addtocart button[name="btnaddtocart"]'
      )
      .forEach(function (btn) {
        if (btn.getAttribute("data-mc-atc-styled") === VERSION) return;
        var wrap = btn.closest(".mc-atc-button-wrap");
        if (wrap && isSoftGoodsPdpPage()) {
          applySoftGoodsAtcChrome(wrap);
          wrap.setAttribute("data-mc-atc-styled", VERSION);
          return;
        }
        if (wrap) return;
        try {
          btn.type = "submit";
          btn.removeAttribute("src");
          if (!btn.value) btn.value = "ADD TO CART";
        } catch (eTyp) {}
        btn.style.setProperty("background", "#111", "important");
        btn.style.setProperty("background-color", "#111", "important");
        btn.style.setProperty("background-image", "none", "important");
        btn.style.setProperty("color", "#fff", "important");
        btn.style.setProperty("border", "1px solid #111", "important");
        btn.style.setProperty("border-radius", "0", "important");
        btn.style.setProperty("font-size", "13px", "important");
        btn.style.setProperty("font-weight", "600", "important");
        btn.style.setProperty("letter-spacing", "0.12em", "important");
        btn.style.setProperty("text-transform", "uppercase", "important");
        btn.style.setProperty("min-height", "48px", "important");
        btn.style.setProperty("padding", "0 28px", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.setAttribute("data-mc-atc-styled", VERSION);
      });
    if (isSoftGoodsPdpPage()) {
      var purchaseTarget = resolveAtcPurchaseTarget();
      applySoftGoodsColumnPurchaseStackLayout(
        global.document.getElementById("mc-pdp-purchase-stack"),
        global.document.getElementById("mc-pdp-qty-row"),
        purchaseTarget ? purchaseTarget.stackNode : null
      );
    }
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
      "body.productdetails #mc-pdp-price-stack-host .product_list_price,body.mc-product-page #mc-pdp-price-stack-host .product_list_price," +
      "body.productdetails #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt,body.mc-product-page #mc-pdp-price-stack-host .mc-pdp-stack-retail-amt{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:20px!important;font-weight:400!important;line-height:1.55!important;" +
      "letter-spacing:0.02em!important;text-transform:none!important;color:#444!important;margin:0!important;padding:0!important}" +
      "body.productdetails #mc-pdp-price-stack-host,body.mc-product-page #mc-pdp-price-stack-host{margin:4px 0 10px 0!important;gap:0!important}" +
      "body.productdetails .mc-atc-button-wrap,body.mc-product-page .mc-atc-button-wrap{" +
      "border:none!important;border-color:transparent!important;box-shadow:none!important;" +
      "border-radius:0!important;color:#444!important;outline:none!important;" +
      "width:auto!important;min-width:0!important;max-width:none!important;padding:0!important;" +
      "display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:0!important}" +
      "body.productdetails:not(.mc-bean-bag-pdp):not(.mc-saranoni-pdp):not(.mc-ruched-blanket-pdp) .mc-atc-button-wrap,body.mc-product-page:not(.mc-bean-bag-pdp):not(.mc-saranoni-pdp):not(.mc-ruched-blanket-pdp) .mc-atc-button-wrap{" +
      "background:transparent!important;background-color:transparent!important}" +
      "body.productdetails .mc-atc-button-wrap input[name='btnaddtocart'],body.mc-product-page .mc-atc-button-wrap input[name='btnaddtocart']," +
      "body.productdetails .mc-atc-button-wrap button[name='btnaddtocart'],body.mc-product-page .mc-atc-button-wrap button[name='btnaddtocart']," +
      "body.productdetails .mc-atc-button-wrap input[type='submit'],body.mc-product-page .mc-atc-button-wrap input[type='submit']," +
      "body.productdetails #mc-pdp-purchase-stack input[name='btnaddtocart'],body.mc-product-page #mc-pdp-purchase-stack input[name='btnaddtocart']," +
      "body.productdetails #mc-pdp-purchase-stack button[name='btnaddtocart'],body.mc-product-page #mc-pdp-purchase-stack button[name='btnaddtocart']{" +
      "background:#111!important;background-color:#111!important;background-image:none!important;color:#fff!important;" +
      "border:1px solid #111!important;border-radius:0!important;box-shadow:none!important;" +
      "font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:600!important;letter-spacing:.12em!important;" +
      "text-transform:uppercase!important;line-height:1!important;padding:0 28px!important;min-height:48px!important;" +
      "margin:0!important;width:auto!important;min-width:0!important;max-width:none!important;opacity:1!important;cursor:pointer!important}" +
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
      "display:flex!important;justify-content:center!important;width:auto!important;margin:0!important}" +
      "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-brand-logo,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-brand-logo," +
      "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-title-right,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-title-right," +
      "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-price-stack-host,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-price-stack-host," +
      "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-features,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-features," +
      "body.productdetails:not(.mc-pdp-hero-ready) #mc-pdp-purchase-stack,body.mc-product-page:not(.mc-pdp-hero-ready) #mc-pdp-purchase-stack{" +
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
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack,html body.mc-saranoni-pdp #mc-pdp-purchase-stack.mc-pdp-cart-row,html body.mc-saranoni-pdp #mc-pdp-purchase-stack.mc-saranoni-purchase-stack{" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;flex-wrap:nowrap!important;" +
      "text-align:center!important;width:100%!important;max-width:400px!important;margin:12px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack.mc-pdp-cart-row,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack.mc-bean-bag-purchase-stack{" +
      "display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;flex-wrap:nowrap!important;" +
      "text-align:left!important;width:100%!important;max-width:400px!important;margin:28px 0 0 0!important;padding:0 0 0 1.1em!important;gap:10px!important;clear:both!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack #mc-pdp-qty-row{order:1!important;width:100%!important;justify-content:center!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack #mc-pdp-qty-row{order:1!important;width:100%!important;justify-content:flex-start!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack .v65-product-addtocart,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .v65-product-addtocart,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap{order:2!important;width:100%!important;max-width:100%!important}" +
      "html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button{width:100%!important;box-sizing:border-box!important;display:flex!important;justify-content:center!important;align-items:center!important;text-align:center!important}" +
      "body.productdetails:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-purchase-stack *,body.mc-product-page:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-purchase-stack *{" +
      "text-align:center!important}" +
      "body.productdetails:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-features+#mc-pdp-purchase-stack,body.mc-product-page:not(.mc-saranoni-pdp):not(.mc-bean-bag-pdp) #mc-pdp-features+#mc-pdp-purchase-stack{" +
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
      "max-width:min(650px,100%)!important;width:100%!important;height:auto!important}" +
      "body.productdetails a#product_photo_zoom_url,body.mc-product-page a#product_photo_zoom_url{" +
      "max-width:min(650px,100%)!important;width:100%!important;display:block!important}" +
      "html body.mc-bean-bag-pdp #content_area tr.mc-pdp-main-row,html body.mc-saranoni-pdp #content_area tr.mc-pdp-main-row,html body.mc-ruched-blanket-pdp #content_area tr.mc-pdp-main-row{" +
      "display:flex!important;flex-wrap:nowrap!important;align-items:flex-start!important;gap:32px!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-title-right,html body.mc-saranoni-pdp #mc-pdp-title-right,html body.mc-ruched-blanket-pdp #mc-pdp-title-right," +
      "html body.mc-bean-bag-pdp #mc-pdp-brand-logo,html body.mc-saranoni-pdp #mc-pdp-brand-logo,html body.mc-ruched-blanket-pdp #mc-pdp-brand-logo{" +
      "margin-top:0!important;padding-top:0!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap," +
      "body.mc-product-page.mc-bean-bag-pdp #content_area .mc-atc-button-wrap,body.mc-product-page.mc-saranoni-pdp #content_area .mc-atc-button-wrap,body.mc-product-page.mc-ruched-blanket-pdp #content_area .mc-atc-button-wrap{" +
      "background:#111!important;background-color:#111!important;border:1px solid #111!important;border-radius:0!important;" +
      "box-shadow:none!important;padding:0!important;margin:0!important;margin-top:0!important;min-width:0!important;gap:0!important;color:#fff!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap input," +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap button{" +
      "background:#111!important;background-color:#111!important;background-image:none!important;color:#fff!important;" +
      "border:1px solid #111!important;border-radius:0!important;font-size:13px!important;font-weight:600!important;" +
      "letter-spacing:.12em!important;text-transform:uppercase!important;min-height:48px!important;padding:0 28px!important;opacity:1!important}" +
      "html body.mc-bean-bag-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper,html body.mc-saranoni-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper,html body.mc-ruched-blanket-pdp #mc-pdp-purchase-stack .mc-atc-button-wrap .mc-cart-icon-wrapper{" +
      "display:none!important}";
  }

  global.mcPlaceBrandLogoAboveTitle = placeBrandLogoAboveTitle;
  global.mcSyncPdpHeroTopAlign = syncPdpHeroTopAlign;

  /** Logo → title → price → Klarna in the right column (non–bean-bag PDPs). */
  function ensureHeroColumnOrder() {
    if (isPdpLayoutMounted()) return;
    if (isBeanBagPdpPage()) return;
    try {
      placeBrandLogoBelowTitle();
    } catch (eLogo) {}
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

  function appendBeanBagInfoColumnOrder() {
    if (!isBeanBagPdpPage()) return;
    var infoColumn = findPdpHeroColumnTd();
    if (!infoColumn) return;
    var brandElement = global.document.getElementById("mc-pdp-brand-logo");
    var titleElement = global.document.getElementById("mc-pdp-title-right");
    var priceElement = global.document.getElementById("mc-pdp-price-stack-host");
    var klarnaElement = global.document.getElementById("messaging-element");
    var sizeOptionsElement = resolveBeanBagSizeOptionsElement();
    var coverOptionsElement = global.document.getElementById("beanbag-swatch-wrapper");
    var featuresElement = global.document.getElementById("mc-pdp-features");
    var cartRow = global.document.getElementById("mc-pdp-purchase-stack");
    var ordered = [
      brandElement,
      titleElement,
      priceElement,
      klarnaElement,
      sizeOptionsElement,
      coverOptionsElement,
      featuresElement,
      cartRow,
    ];
    var allowedIds = {};
    var oi;
    for (oi = 0; oi < ordered.length; oi++) {
      if (ordered[oi] && ordered[oi].id) allowedIds[ordered[oi].id] = true;
    }
    infoColumn.querySelectorAll(":scope > *").forEach(function (child) {
      if (child.id && allowedIds[child.id]) return;
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

  function appendSaranoniInfoColumnOrder() {
    if (!isSaranoniPdpPage()) return;
    var infoColumn = findPdpHeroColumnTd();
    if (!infoColumn) return;
    var brandElement = global.document.getElementById("mc-pdp-brand-logo");
    var titleElement = global.document.getElementById("mc-pdp-title-right");
    var priceElement = global.document.getElementById("mc-pdp-price-stack-host");
    var klarnaElement = global.document.getElementById("messaging-element");
    var sizeOptionsElement = global.document.getElementById("mc-pdp-option-block");
    if (sizeOptionsElement && !sizeOptionsElement.querySelector("select")) {
      sizeOptionsElement = null;
    }
    var coverOptionsElement = global.document.getElementById("mc-configured-color-swatch-wrapper");
    var featuresElement = global.document.getElementById("mc-pdp-features");
    var descriptionElement = global.document.getElementById("mc-pdp-description-below-features");
    var cartRow = global.document.getElementById("mc-pdp-purchase-stack");
    [
      brandElement,
      titleElement,
      priceElement,
      klarnaElement,
      sizeOptionsElement,
      coverOptionsElement,
      featuresElement,
      descriptionElement,
      cartRow,
    ].forEach(function (element) {
      if (element) {
        try {
          infoColumn.appendChild(element);
        } catch (eAppend) {}
      }
    });
    hideSaranoniStrayHeroCopy(infoColumn);
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
  }

  function ensurePdpInfoColumnOrder() {
    if (isPdpLayoutMounted()) return;
    if (isBeanBagPdpPage() || isSaranoniPdpPage()) return;
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
    if (isBeanBagPdpPage() || isSaranoniPdpPage()) return;
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

  function extractTechSpecsBodyHtml() {
    var src = global.document.getElementById("ProductDetail_TechSpecs_div");
    if (!src) return "";
    var lis = src.querySelectorAll("li");
    if (lis.length) {
      var items = [];
      var i;
      for (i = 0; i < lis.length; i++) {
        if (lis[i].querySelector("ul, ol")) continue;
        var t = (lis[i].textContent || "").replace(/\s+/g, " ").trim();
        if (t) items.push("<li>" + escapeHtmlText(t) + "</li>");
      }
      if (items.length) {
        return '<ul class="mc-pdp-features__list">' + items.join("") + "</ul>";
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

  function isBeanBagPdpPage() {
    try {
      if (typeof global.isBeanBagProductPage === "function") return !!global.isBeanBagProductPage();
      if (global.document.body && global.document.body.classList.contains("mc-bean-bag-pdp")) return true;
      var p = String(global.location.pathname || "").toLowerCase();
      if (/product-p\/bb-/i.test(p) || /\/bean-bag-seating-s\//.test(p)) return true;
    } catch (eBb) {}
    return !!global.document.getElementById("beanbag-swatch-wrapper");
  }

  function isSaranoniPdpPage() {
    try {
      if (global.document.body && global.document.body.classList.contains("mc-saranoni-pdp")) return true;
      var pcEl = global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
      var pc = String((pcEl && pcEl.value) || "").trim().toUpperCase();
      if (/^SAR/.test(pc)) return true;
    } catch (eSar) {}
    return false;
  }

  function isSoftGoodsPdpPage() {
    return isBeanBagPdpPage() || isSaranoniPdpPage();
  }

  function findPdpHeroColumnTd() {
    var td = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (td) return td;
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
      var t = (li.textContent || "").replace(/\s+/g, " ").trim();
      if (t) items.push("<li>" + escapeHtmlText(t) + "</li>");
    });
    if (!items.length) return "";
    return '<ul class="mc-pdp-features__list">' + items.join("") + "</ul>";
  }

  function mountPdpFeaturesBlock() {
    if (!isProductPdp()) return;
    var bodyHtml = extractTechSpecsBodyHtml();
    if (!bodyHtml) bodyHtml = extractDescriptionFeaturesHtml();
    var block = global.document.getElementById("mc-pdp-features");
    if (!bodyHtml) {
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
        '<div class="mc-pdp-features__heading mc-pdp-section-heading">Features:</div>' +
        '<div class="mc-pdp-features__body">' +
        bodyHtml +
        "</div>";
      block.setAttribute("data-mc-features-sig", featuresSig);
    }
    try {
      block.style.removeProperty("display");
    } catch (eShow) {}
    var insertParent = findPdpHeroInsertParent();
    var insertAfter = findPdpHeroInsertAfter(insertParent);
    if (!insertParent) return;
    if (isPdpLayoutMounted()) {
      pruneDescriptionDuplicateFeatures();
      return;
    }
    if (block.parentNode !== insertParent || (insertAfter && block.previousElementSibling !== insertAfter)) {
      insertPdpHeroNodeAfter(insertParent, insertAfter, block);
    }
    pruneDescriptionDuplicateFeatures();
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

  // Saranoni shares one color option-category (23) across products, one option id
  // per color. Products not in PDP_CONFIGURED_COLOR_SWATCHS get swatches built from
  // their native options + the verified filename convention below.
  var SARANONI_COLOR_OPTION_CATEGORY = "23";
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
      out.push({
        optionId: val,
        label: text,
        // Repository convention, verified live for SAR-DBL-RCH-FX-FUR:
        // /v/vspfiles/photos/{ProductCode}-{optionId}-S.jpg (swatch) and -T.jpg (main).
        swatchImage: productCode + "-" + val + "-S.jpg",
        mainImage: productCode + "-" + val + "-T.jpg",
      });
    }
    return out;
  }

  function findConfiguredColorSwatchContext() {
    // Bean bag PDPs have their own native swatch system (#beanbag-swatch-wrapper);
    // never let the configured-color swatches take over those pages.
    if (isBeanBagPdpPage()) return null;
    var selects = global.document.querySelectorAll("#options_table select, #v65-product-parent select");
    var best = null;
    var i;
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
      if (parseOptionCategoryFromSelectName(sel.name) !== SARANONI_COLOR_OPTION_CATEGORY) continue;
      var dynEntries = buildDataDrivenSaranoniEntries(sel, pc);
      if (!dynEntries.length) continue;
      return {
        productCode: pc,
        select: sel,
        entries: dynEntries,
        score: dynEntries.length,
        dataDriven: true,
      };
    }
    return null;
  }

  function buildConfiguredColorImageCandidates(fileName) {
    var candidates = [];
    var mainImg = global.document.getElementById("product_photo");
    var src = mainImg && mainImg.getAttribute ? mainImg.getAttribute("src") || "" : "";
    if (src) candidates.push(src.replace(/[^/]+$/, fileName));
    candidates.push("/v/vspfiles/photos/" + fileName);
    candidates.push("/v/vspfiles/images/" + fileName);
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
    candidates.push("https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/" + fileName);
    return candidates.filter(function (item, idx, arr) {
      return item && arr.indexOf(item) === idx;
    });
  }

  function loadConfiguredColorImage(candidates, done) {
    var idx = 0;
    function tryNext() {
      if (idx >= candidates.length) {
        done("");
        return;
      }
      var probe = new global.Image();
      var candidate = candidates[idx++];
      probe.onload = function () {
        done(candidate);
      };
      probe.onerror = tryNext;
      probe.src = candidate;
    }
    tryNext();
  }

  function setConfiguredColorPhotoSrc(resolvedSrc, label) {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg || !resolvedSrc) return;
    try {
      if ((mainImg.getAttribute("src") || "") !== resolvedSrc) mainImg.src = resolvedSrc;
    } catch (eSrc) {}
    try {
      mainImg.style.setProperty("opacity", "1", "important");
    } catch (eOp) {}
    var zoom = global.document.getElementById("product_photo_zoom_url");
    if (zoom) {
      try {
        var full = resolvedSrc.replace(/-T\.jpg/i, ".jpg").replace(/-S\.jpg/i, ".jpg");
        if ((zoom.getAttribute("href") || "") !== full) zoom.href = full;
        if (label) zoom.title = label;
      } catch (eZoom) {}
    }
  }

  // Volusion's native option-change logic can asynchronously rewrite (often blank)
  // #product_photo a few hundred ms after the change event. Re-assert our chosen
  // image for a short window so the hero never blanks or reverts.
  function enforceConfiguredColorPhoto() {
    if (configuredColorEnforceTimer) return;
    configuredColorEnforceTimer = global.setInterval(function () {
      if (Date.now() > configuredColorEnforceUntil || !configuredColorActiveSrc) {
        global.clearInterval(configuredColorEnforceTimer);
        configuredColorEnforceTimer = null;
        return;
      }
      var mainImg = global.document.getElementById("product_photo");
      if (!mainImg) return;
      var cur = mainImg.getAttribute("src") || "";
      if (cur !== configuredColorActiveSrc) {
        setConfiguredColorPhotoSrc(
          configuredColorActiveSrc,
          configuredColorActiveEntry ? configuredColorActiveEntry.label : ""
        );
      }
    }, 120);
  }

  function applyConfiguredColorMainPhoto(fileName, label) {
    var mainImg = global.document.getElementById("product_photo");
    if (!mainImg || !fileName) return;
    var previousSrc = mainImg.getAttribute("src") || "";
    if (previousSrc && previousSrc.indexOf("/manufacturers/") === -1) configuredColorDefaultSrc = previousSrc;
    var token = String(Date.now()) + ":" + Math.random();
    global.__MC_CONFIGURED_COLOR_IMAGE_TOKEN__ = token;
    loadConfiguredColorImage(buildConfiguredColorImageCandidates(fileName), function (resolvedSrc) {
      if (global.__MC_CONFIGURED_COLOR_IMAGE_TOKEN__ !== token) return;
      var finalSrc = resolvedSrc || previousSrc || configuredColorDefaultSrc;
      if (!finalSrc) return;
      configuredColorActiveSrc = finalSrc;
      configuredColorEnforceUntil = Date.now() + 2500;
      setConfiguredColorPhotoSrc(finalSrc, label);
      enforceConfiguredColorPhoto();
    });
  }

  // Parse the trailing option-category id out of a Volusion select name,
  // e.g. SELECT___SAR-RUCHED-MINKY-THROW-BLANKET___23 -> "23".
  function parseOptionCategoryFromSelectName(name) {
    var m = String(name || "").match(/___(\d+)\s*$/);
    return m ? m[1] : "";
  }

  function syncConfiguredColorSelect(select, opt) {
    if (!select || !opt) return false;
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
    try {
      select.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (eIn) {}
    try {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (eEv) {}
    return true;
  }

  function findSaranoniColorSelect() {
    var selects = global.document.querySelectorAll("#options_table select, #v65-product-parent select");
    var i;
    for (i = 0; i < selects.length; i++) {
      var sel = selects[i];
      if (parseOptionCategoryFromSelectName(sel.name) !== SARANONI_COLOR_OPTION_CATEGORY) continue;
      if (!/^SAR/i.test(parseProductCodeFromSelectName(sel.name))) continue;
      return sel;
    }
    return null;
  }

  function ensureColorOptionCommittedBeforeAddToCart() {
    if (!isSaranoniPdpPage()) return;
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
    if (opt) syncConfiguredColorSelect(select, opt);
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
        ensureColorOptionCommittedBeforeAddToCart();
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
        ensureColorOptionCommittedBeforeAddToCart();
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

  function syncSaranoniSwatchReadyState(wrap, select, visibleCount) {
    var body = global.document.body;
    if (!body) return;
    if (visibleCount > 0 && wrap && wrap.querySelector(".mc-configured-color-swatch")) {
      body.classList.add("mc-saranoni-swatches-ready");
      hideConfiguredColorNativeSelect(select);
      hideSaranoniNativeColorUi(select);
      try {
        wrap.style.removeProperty("display");
      } catch (eShow) {}
      return;
    }
    body.classList.remove("mc-saranoni-swatches-ready");
    if (wrap && wrap.parentNode) {
      try {
        wrap.parentNode.removeChild(wrap);
      } catch (eRm) {}
    }
    restoreConfiguredColorNativeSelect(select);
  }

  function hideSaranoniNativeColorUi(select) {
    if (!select || !isSaranoniPdpPage()) return;
    hideConfiguredColorNativeSelect(select);
    var row = select.closest ? select.closest("tr") : null;
    if (row) {
      try {
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
      if (prev && /(choose color|selected color|color\*|color:|cover)/.test(prevText)) {
        try {
          prev.style.setProperty("display", "none", "important");
          prev.style.setProperty("visibility", "hidden", "important");
          prev.style.setProperty("height", "0", "important");
          prev.style.setProperty("overflow", "hidden", "important");
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
      if (!/(choose color|selected color|color\*|color:|cover)/.test(txt)) return;
      if (lab.contains && lab.contains(select)) return;
      try {
        lab.style.setProperty("display", "none", "important");
        lab.style.setProperty("visibility", "hidden", "important");
        lab.style.setProperty("height", "0", "important");
        lab.style.setProperty("overflow", "hidden", "important");
      } catch (eLab) {}
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
  }

  function hideConfiguredColorNativeSelect(select) {
    if (!select || select.dataset.mcConfiguredColorHidden === "1") return;
    select.dataset.mcConfiguredColorHidden = "1";
    try {
      select.style.setProperty("position", "absolute", "important");
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
      select.style.setProperty("pointer-events", "none", "important");
    } catch (eHide) {}
  }

  function ensureConfiguredColorSwatchCss() {
    if (global.document.getElementById("mc-configured-color-swatch-css")) return;
    var st = global.document.createElement("style");
    st.id = "mc-configured-color-swatch-css";
    st.textContent =
      ".mc-configured-color-swatch-wrapper{display:block!important;width:100%!important;max-width:460px!important;margin:12px 0 0!important}" +
      ".mc-configured-color-swatch-label{display:block!important;margin-bottom:8px!important;font:700 12px/1.4 Inter,Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#444!important}" +
      ".mc-configured-color-swatch-label span{font-weight:600!important;letter-spacing:.03em!important;text-transform:none!important}" +
      ".mc-configured-color-swatches,.mc-saranoni-swatches{display:flex!important;flex-wrap:wrap!important;gap:12px!important}" +
      ".mc-configured-color-swatch{appearance:none!important;-webkit-appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:56px!important;height:56px!important;padding:0!important;border:2px solid #ddd!important;border-radius:999px!important;background:#fff!important;cursor:pointer!important;overflow:hidden!important}" +
      ".mc-configured-color-swatch img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important}" +
      ".mc-configured-color-swatch.active{border-color:#111!important;box-shadow:0 0 0 1px #111 inset!important}" +
      ".mc-configured-color-swatch:focus-visible{outline:2px solid #111!important;outline-offset:2px!important}";
    (global.document.head || global.document.documentElement).appendChild(st);
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
      if (prev && /(choose color|choose cover|selected color|color|cover)/.test(prevText)) {
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
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
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
        (isSar ? "Choose color: " : "Selected color: ") +
        '<span id="mc-configured-color-selected-name"></span></div>' +
        '<div class="mc-configured-color-swatches' + (isSar ? " mc-saranoni-swatches" : "") + '"></div>';
      var rail = wrap.querySelector(".mc-configured-color-swatches");
      var probeState = { pending: 0, loaded: 0 };
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
        var candidates = ctx.dataDriven
          ? buildSaranoniSwatchCandidates(ctx.productCode, entry.optionId, entry.label)
          : buildConfiguredColorImageCandidates(entry.swatchImage);
        if (ctx.dataDriven) {
          btn.style.display = "none";
          probeState.pending++;
          loadConfiguredColorImage(candidates, function (resolvedSrc) {
            if (resolvedSrc) {
              probeState.loaded++;
              img.src = resolvedSrc;
              btn.style.display = "";
              hideConfiguredColorNativeSelect(ctx.select);
              hideSaranoniNativeColorUi(ctx.select);
            } else if (btn.parentNode) {
              btn.parentNode.removeChild(btn);
            }
            probeState.pending--;
            if (probeState.pending <= 0) {
              syncSaranoniSwatchReadyState(wrap, ctx.select, probeState.loaded);
            }
          });
        } else {
          loadConfiguredColorImage(candidates, function (resolvedSrc) {
            img.src = resolvedSrc || candidates[0] || "";
          });
        }
        rail.appendChild(btn);
      });
      if (ctx.dataDriven && probeState.pending === 0) {
        syncSaranoniSwatchReadyState(wrap, ctx.select, 0);
      }
    } else if (ctx.dataDriven && isSar) {
      syncSaranoniSwatchReadyState(
        wrap,
        ctx.select,
        wrap.querySelectorAll(".mc-configured-color-swatch").length
      );
    }
    var host = global.document.getElementById("mc-pdp-option-block");
    if (isSar) {
      if (!isPdpLayoutMounted()) {
        var insertParent = findPdpHeroInsertParent();
        var bnpl = global.document.getElementById("messaging-element");
        if (insertParent) {
          insertPdpHeroNodeAfter(
            insertParent,
            bnpl && insertParent.contains(bnpl) ? bnpl : findPdpHeroInsertAfter(insertParent),
            wrap
          );
        } else if (host && wrap.parentNode !== host) {
          try {
            host.appendChild(wrap);
          } catch (eHostSar) {}
        }
      }
    } else if (!isPdpLayoutMounted()) {
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
    var opt = ctx.select.options && ctx.select.selectedIndex >= 0 ? ctx.select.options[ctx.select.selectedIndex] : null;
    if (!opt) return null;
    var i;
    for (i = 0; i < ctx.entries.length; i++) {
      if (optionMatchesConfiguredColorEntry(opt, ctx.entries[i])) return ctx.entries[i];
    }
    return null;
  }

  function syncConfiguredColorSwatchUi(ctx, applyPhoto) {
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (!ctx || !wrap) return;
    // Prefer the user's locked selection so a Volusion-driven select reset can't
    // wipe the active swatch. Fall back to whatever the native select reports.
    var selected = configuredColorActiveEntry || findConfiguredColorSelectedEntry(ctx);
    var labelEl = global.document.getElementById("mc-configured-color-selected-name");
    if (labelEl) labelEl.textContent = selected ? selected.label : "";
    wrap.querySelectorAll(".mc-configured-color-swatch").forEach(function (btn) {
      var active = !!selected && btn.getAttribute("data-option-id") === selected.optionId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (applyPhoto && selected) {
      applyConfiguredColorMainPhoto(selected.mainImage, selected.label);
    }
  }

  function bindConfiguredColorSwatchSelect(select) {
    if (!select || select.dataset.mcConfiguredColorBound === "1") return;
    select.dataset.mcConfiguredColorBound = "1";
    select.addEventListener("change", function () {
      var ctx = findConfiguredColorSwatchContext();
      if (!ctx || ctx.select !== select) return;
      syncConfiguredColorSwatchUi(ctx, true);
    });
  }

  function handleConfiguredColorSwatchClick(btn) {
    if (!btn) return;
    var ctx = findConfiguredColorSwatchContext();
    if (!ctx) return;
    var i;
    for (i = 0; i < ctx.entries.length; i++) {
      if (ctx.entries[i].optionId !== btn.getAttribute("data-option-id")) continue;
      var entry = ctx.entries[i];
      var opt = findConfiguredColorOption(ctx.select, entry);
      if (!opt) return;
      // Lock this selection first so subsequent re-renders / Volusion resets keep it.
      configuredColorActiveEntry = entry;
      syncConfiguredColorSelect(ctx.select, opt);
      syncConfiguredColorSwatchUi(ctx, true);
      return;
    }
  }

  function ensureConfiguredColorSwatches() {
    var ctx = findConfiguredColorSwatchContext();
    var wrap = global.document.getElementById("mc-configured-color-swatch-wrapper");
    if (!ctx) {
      if (wrap && wrap.parentNode) {
        try {
          wrap.parentNode.removeChild(wrap);
        } catch (eRm) {}
      }
      return;
    }
    renderConfiguredColorSwatches(ctx);
    bindConfiguredColorSwatchSelect(ctx.select);
    if (!configuredColorActiveEntry) {
      var hero = global.document.getElementById("product_photo");
      var heroSrc = hero ? hero.getAttribute("src") || "" : "";
      if (heroSrc && heroSrc.indexOf("/manufacturers/") === -1) configuredColorDefaultSrc = heroSrc;
    }
    // Only re-assert the hero image once the shopper has locked a color; on the
    // initial render we leave Volusion's default product photo untouched.
    syncConfiguredColorSwatchUi(ctx, !!configuredColorActiveEntry);
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
    if (looksLikePrimaryColorOptionsTable(table)) return table;
    return null;
  }

  function shouldUseDescriptionBelowFeaturesLayout() {
    // Unified layout for every standard product PDP: title/price, then options
    // (if any), then features, then description, with the qty+ATC purchase stack
    // centered below. Sectional PDPs own their own layout.
    if (!isProductPdp()) return false;
    if (isSectionalPdpPage()) return false;
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
    if (!wrap.querySelector(".mc-pdp-section-heading[data-mc-bb-color-label]")) {
      var colorLabel = global.document.createElement("div");
      colorLabel.className = "mc-pdp-section-heading";
      colorLabel.setAttribute("data-mc-bb-color-label", "1");
      colorLabel.textContent = "CHOOSE COLOR:";
      try {
        wrap.insertBefore(colorLabel, wrap.firstChild);
      } catch (eColorLbl) {}
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

  function findMainProductRowEl() {
    var parent = global.document.getElementById("v65-product-parent");
    if (!parent) return null;
    return (
      parent.querySelector(":scope > tbody > tr:nth-of-type(2)") ||
      parent.querySelector(":scope > tr:nth-of-type(2)")
    );
  }

  function outerColumnTdFromNode(el) {
    if (!el) return null;
    var mainRow = findMainProductRowEl();
    if (!mainRow) return el.closest ? el.closest("td") : null;
    var td = el.closest ? el.closest("td") : null;
    while (td && td.parentNode && td.parentNode !== mainRow) {
      td = td.parentNode.closest ? td.parentNode.closest("td") : null;
    }
    if (td && td.parentNode === mainRow) return td;
    return el.closest ? el.closest("td") : null;
  }

  function tagHeroMediaCol() {
    var mainRow = findMainProductRowEl();
    var media = null;
    var opt = null;
    if (mainRow) {
      var rowTds = mainRow.querySelectorAll(":scope > td");
      if (rowTds.length >= 2) {
        media = rowTds[0];
        opt = rowTds[rowTds.length - 1];
      }
    }
    if (!opt) {
      opt = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    }
    if (!opt) {
      var atc = global.document.querySelector(
        '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"]'
      );
      if (atc) opt = outerColumnTdFromNode(atc);
    }
    if (!media) {
      var photo = global.document.getElementById("product_photo");
      if (photo) media = outerColumnTdFromNode(photo);
    }
    if (!media && opt && opt.previousElementSibling && opt.previousElementSibling.tagName === "TD") {
      media = opt.previousElementSibling;
    }
    if (opt && !opt.classList.contains("mc-pdp-options-td")) {
      opt.classList.add("mc-pdp-options-td");
    }
    if (media) {
      media.classList.add("mc-pdp-hero-media-col", "mc-pdp-media-td");
      var row = media.parentNode;
      if (row && row.tagName === "TR") {
        row.classList.add("mc-pdp-main-row");
      }
    } else if (mainRow && opt) {
      mainRow.classList.add("mc-pdp-main-row");
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
    if (isBeanBagPdpPage()) {
      mountBeanBagDescriptionBelowHero();
      return;
    }
    if (isPdpLayoutMounted() && !isSoftGoodsPdpPage()) return;
    var col = findPdpHeroColumnTd();
    if (!col) return;
    var descDiv =
      global.document.getElementById("ProductDetail_ProductDetails_div") ||
      global.document.getElementById("ProductDetail_ProductDetails_div2");
    if (!descDiv) return;
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-below-features";
      host.className = "mc-pdp-description-below-features";
    }
    if (!col.contains(host)) {
      try {
        var swatchAnchor =
          global.document.getElementById("beanbag-swatch-wrapper") ||
          global.document.getElementById("mc-configured-color-swatch-wrapper");
        var featuresBlockForDesc = global.document.getElementById("mc-pdp-features");
        var optAnchor = global.document.getElementById("mc-pdp-option-block");
        if (swatchAnchor && swatchAnchor.parentNode === col) {
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
    try {
      host.style.setProperty("width", "100%", "important");
      host.style.setProperty("max-width", "460px", "important");
      host.style.setProperty("margin", "10px 0 0 0", "important");
      host.style.setProperty("padding", "0 0 0 1.1em", "important");
      host.style.setProperty("box-sizing", "border-box", "important");
      host.style.setProperty("text-align", "left", "important");
    } catch (eHostStyle) {}
    if (descDiv.parentNode !== host) {
      moveDescriptionContentIntoHost(host, descDiv);
    }
    try {
      descDiv.style.setProperty("line-height", "1.65", "important");
    } catch (eDescStyle) {}
    try {
      pruneDescriptionDuplicateFeatures();
    } catch (ePrune) {}
  }

  function extractSwatchesIntoCol() {
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
    if (!wrap.querySelector(".mc-pdp-section-heading[data-mc-bb-color-label]")) {
      var colorLabel = global.document.createElement("div");
      colorLabel.className = "mc-pdp-section-heading";
      colorLabel.setAttribute("data-mc-bb-color-label", "1");
      colorLabel.textContent = "CHOOSE COLOR:";
      try {
        wrap.insertBefore(colorLabel, wrap.firstChild);
      } catch (eColorLbl) {}
    }
  }

  function ensureBeanBagPurchaseStack() {
    if (!isProductPdp()) return null;
    if (!isBeanBagPdpPage()) return null;
    var col = findPdpHeroColumnTd();
    if (!col) return null;
    var purchaseTarget = resolveAtcPurchaseTarget();
    if (!purchaseTarget || !purchaseTarget.stackNode) return null;
    var stackNode = purchaseTarget.stackNode;
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
      stack.style.setProperty("max-width", "400px", "important");
      stack.style.setProperty("margin", "18px auto 0 auto", "important");
      stack.style.setProperty("padding", "0", "important");
      stack.style.setProperty("gap", "10px", "important");
      stack.style.setProperty("clear", "both", "important");
    } catch (eStyle) {}
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    if (qtyRow && !stack.contains(qtyRow)) {
      try {
        stack.insertBefore(qtyRow, stackNode);
      } catch (eQty) {}
    }
    applySoftGoodsColumnPurchaseStackLayout(stack, qtyRow, stackNode);
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

  global.mcMountPdpFeaturesBlock = mountPdpFeaturesBlock;
  global.mcMountBeanBagSwatchesAboveFeatures = mountBeanBagSwatchesAboveFeatures;
  global.mcEnsureHeroColumnOrder = ensureHeroColumnOrder;

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
    if (isPalliserPdpPage()) return;
    if (isSectionalPdpPage()) return;
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
    "799": "bb-fauxfur-navy.jpg",
    "801": "bb-fauxfur-pink.jpg",
    "803": "bb-fauxfur-cow.jpg",
    "805": "bb-fauxfur-tan.jpg",
    "807": "bb-fauxfur-white.jpg",
    "809": "bb-fauxfur-gray.jpg",
    "811": "bb-fauxfur-black.jpg"
  };
  var BB_COVER_IMAGE_BY_LABEL = {
    navy: "bb-fauxfur-navy.jpg",
    pink: "bb-fauxfur-pink.jpg",
    cow: "bb-fauxfur-cow.jpg",
    tan: "bb-fauxfur-tan.jpg",
    white: "bb-fauxfur-white.jpg",
    gray: "bb-fauxfur-gray.jpg",
    grey: "bb-fauxfur-gray.jpg",
    black: "bb-fauxfur-black.jpg"
  };

  function initBeanBagImageSync() {
    if (!isBeanBagPdpPage()) return;
    if (global.document.documentElement.dataset.mcBbImgBound === "1") return;
    global.document.documentElement.dataset.mcBbImgBound = "1";

    function normalizeBbLabel(str) {
      return String(str || "")
        .toLowerCase()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function bbColorFromSwatchLabel(label) {
      var normalized = normalizeBbLabel(label);
      if (!normalized) return "";
      var parts = normalized.split("/");
      return (parts.length > 1 ? parts[parts.length - 1] : normalized).trim();
    }

    function bbImageForSwatchLabel(label) {
      var colorKey = bbColorFromSwatchLabel(label);
      return colorKey ? BB_COVER_IMAGE_BY_LABEL[colorKey] || null : null;
    }

    function applyBbImage(imgFile) {
      var mainImg = global.document.getElementById("product_photo");
      if (!mainImg) return;
      var targetSrc = "/v/vspfiles/images/" + imgFile;
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
          if (src.indexOf("bb-fauxfur") === -1) {
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

    // Capture phase so this runs before legacy inline swatch scripts baked into product HTML.
    global.document.addEventListener("click", function (eBb) {
      var swatch = eBb.target && eBb.target.closest ? eBb.target.closest(".beanbag-swatch") : null;
      if (!swatch) return;
      var label = swatch.getAttribute("data-option") || "";
      var target = bbColorFromSwatchLabel(label) || normalizeBbLabel(label);
      var coverSel =
        global.document.querySelector("#options_table select[name*='___4']") ||
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

      eBb.preventDefault();
      eBb.stopPropagation();
      eBb.stopImmediatePropagation();

      applyBbImage(imgFile);
      reassertBbImageOnce(imgFile);
    }, true);
  }

  // Bean-bag size option (category 58): keep the native select visible + functional,
  // give it a "CHOOSE SIZE" label, and make sure size changes drive Volusion pricing.
  function ensureBeanBagSizeRow() {
    if (!isBeanBagPdpPage()) return;
    var sizeSel = global.document.querySelector("#options_table select[name*='___58']");
    if (!sizeSel) {
      var sels = global.document.querySelectorAll("#options_table select");
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
      lbl.className = "mc-bb-size-label mc-pdp-section-heading";
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
          sizeSel.dispatchEvent(new Event("change", { bubbles: true }));
        } catch (eCh) {}
        try {
          ensureBeanBagKingCoverRestriction();
        } catch (eKing) {}
      });
    }
    try {
      ensureBeanBagKingCoverRestriction();
    } catch (eKingInit) {}
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

  function markBeanBagCoverSwatchesReady() {
    if (!isBeanBagPdpPage()) return;
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap || !wrap.querySelector(".beanbag-swatch")) return;
    try {
      global.document.body.classList.add("mc-bb-cover-swatches-ready");
    } catch (eCls) {}
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

  function inlineSyncConfigurationPrice() {
    var capEl = global.document.getElementById("mcConfigurationCaption");
    var pieEl = global.document.getElementById("mcConfigurationPieces");
    var priceEl = global.document.getElementById("mcConfigurationPrice");
    if (!pieEl || !priceEl) return;
    var picks = findConfigurationSelects();
    var configSel = picks.configSel;
    if (!configSel) {
      if (priceEl) {
        priceEl.style.display = "none";
        priceEl.textContent = "";
      }
      return;
    }
    var additional = 0;
    if (configSel.selectedIndex >= 0) {
      additional = extractAdditionalFromOptionText(
        configSel.options[configSel.selectedIndex].text || configSel.options[configSel.selectedIndex].innerText
      );
    }
    var loggedIn = false;
    try {
      loggedIn =
        !!(global.document.body && global.document.body.classList.contains("mc-member-logged-in")) ||
        !!global.sessionStorage.getItem("mc_recent_member_auth");
    } catch (eLi) {}
    var priceHtml = [];
    if (additional > 0) {
      priceHtml.push(
        '<div class="mc-configuration-rh__addl">Additional configuration cost: ' +
          fmtMoney(additional) +
          "</div>"
      );
    }
    if (loggedIn) {
      var totalAmt = 0;
      var pwo =
        global.document.getElementById("priceWithOptions") ||
        global.document.getElementById("priceWithOptionsNoTax");
      if (pwo) {
        totalAmt =
          parseMoney(
            (pwo.getAttribute && (pwo.getAttribute("value") || pwo.getAttribute("content"))) ||
              pwo.textContent ||
              ""
          ) || 0;
      }
      if (!(totalAmt > 0) && typeof global.getVolusionAddToCartSeatPrice === "function") {
        totalAmt = Number(global.getVolusionAddToCartSeatPrice(global.document)) || 0;
      }
      if (!(totalAmt > 0) && additional > 0) {
        var retailEl = global.document.querySelector(".mc-pdp-retail-row .product_list_price");
        var baseAmt = retailEl ? parseMoney(retailEl.textContent || "") : 0;
        if (!(baseAmt > 0)) baseAmt = resolvePdpSaleAmount() || readRetailAmountForSale();
        if (baseAmt > 0) totalAmt = baseAmt + additional;
      }
      if (totalAmt > 0) {
        priceHtml.push('<div class="mc-configuration-rh__total-line">Total: ' + fmtMoney(totalAmt) + "</div>");
      }
    }
    if (priceHtml.length) {
      priceEl.innerHTML = priceHtml.join("");
      priceEl.style.display = "block";
    } else {
      priceEl.style.display = "none";
      priceEl.textContent = "";
    }
    if (capEl && additional > 0 && !loggedIn) {
      capEl.style.display = "block";
      if (!capEl.querySelector("[data-mc-open-login]")) {
        capEl.innerHTML =
          '<button type="button" class="mc-configuration-rh__signin-cta" data-mc-open-login style="border:none;background:none;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;">Sign in</button> for configured total.';
      }
    }
  }

  function syncConfigurationBlockPricing() {
    inlineSyncConfigurationPrice();
    if (typeof global.mcSyncConfigurationFromDom === "function") {
      try {
        global.mcSyncConfigurationFromDom();
      } catch (eSync) {}
    }
    if (typeof global.scheduleConfigurationFromDomRetries === "function") {
      try {
        global.scheduleConfigurationFromDomRetries();
      } catch (eSch) {}
    }
  }

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
    if (isPalliserPdpPage()) {
      if (typeof global.mcDedupePalliserMemberPricingBlocks === "function") {
        try {
          global.mcDedupePalliserMemberPricingBlocks();
        } catch (eDed) {}
      }
      if (typeof global.mcRepositionPalliserMemberPricing === "function") {
        try {
          global.mcRepositionPalliserMemberPricing();
        } catch (ePos) {}
      }
      if (typeof global.mcHidePalliserNativePriceUi === "function") {
        try {
          global.mcHidePalliserNativePriceUi();
        } catch (eHide) {}
      }
      return !!global.document.querySelector(".mc-pdp-member-pricing--canonical");
    }
    try {
      forceRebuildCleanPriceStack();
      syncConfigurationBlockPricing();
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

  function convertLegacyGateLinks(g) {
    if (!g || g.querySelector("button[data-mc-open-login]")) return;
    var legacyLogin = g.querySelector(
      'a[href*="login.asp"], a[href*="Login.asp"]'
    );
    var legacySignup = g.querySelector(
      'a[href*="register.asp"], a[href*="AccountSettings.asp"]'
    );
    if (!legacyLogin && !legacySignup) return;
    var row =
      g.querySelector(".mc-planner-login-gate__actions") ||
      g.querySelector('div[style*="flex"]') ||
      g;
    if (!row) return;
    row.className = "mc-planner-login-gate__actions";
    row.innerHTML =
      '<button type="button" class="mc-config-btn" data-mc-open-login style="display:inline-block;padding:8px 14px;border:1px solid #333;background:#fff;color:#111;font-size:12px;cursor:pointer;">Sign In</button>' +
      '<button type="button" class="mc-config-btn" data-mc-open-signup style="display:inline-block;padding:8px 14px;border:1px solid #333;background:#fff;color:#111;font-size:12px;cursor:pointer;">Create Account</button>';
  }

  function bindGateButtons(g) {
    if (!g) return;
    convertLegacyGateLinks(g);
    if (typeof global.mcBindPlannerGateAuthButtons === "function") {
      global.mcBindPlannerGateAuthButtons(g);
      return;
    }
    var loginBtn = g.querySelector("[data-mc-open-login]");
    var signupBtn = g.querySelector("[data-mc-open-signup]");
    if (loginBtn && !loginBtn.dataset.mcAuthBound) {
      loginBtn.dataset.mcAuthBound = "1";
      loginBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        openLoginModal();
        return false;
      };
    }
    if (signupBtn && !signupBtn.dataset.mcAuthBound) {
      signupBtn.dataset.mcAuthBound = "1";
      signupBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();
        openSignupModal();
        return false;
      };
    }
  }

  function wirePlannerLoginGate() {
    var g = global.document.getElementById("mcPlannerLoginGate");
    if (!g) return;
    bindGateButtons(g);
    if (g.dataset.mcGateCapture === "1") return;
    g.dataset.mcGateCapture = "1";
    g.addEventListener(
      "click",
      function (ev) {
        if (
          !ev.target.closest(
            "[data-mc-open-login], [data-mc-open-signup], button, a"
          )
        ) {
          return;
        }
        handleAuthCtaClick(ev);
      },
      true
    );
  }

  function guardConfigurationBlockClick() {
    if (!isSectionalPdpPage()) return;
    var block = global.document.getElementById("mcConfigurationBlock");
    if (!block) return;

    var skipSelector =
      "#mcPlannerLoginGate, [data-mc-open-login], [data-mc-open-signup], .mc-configuration-rh__signin-cta, button, a, input, select, textarea, label";

    function shouldOpenPlanner(ev) {
      if (!ev || !ev.target || !ev.target.closest) return false;
      if (ev.target.closest(skipSelector)) return false;
      var cap = global.document.getElementById("mcConfigurationCaption");
      if (cap && cap.classList.contains("mc-configuration-rh__planner-only")) {
        return !!ev.target.closest("#mcConfigurationCaption");
      }
      return true;
    }

    block.onclick = function (ev) {
      if (!shouldOpenPlanner(ev)) return;
      if (typeof global.openPlannerOverlay === "function") {
        global.openPlannerOverlay();
      }
    };
    block.dataset.mcAuthPlannerGuard = "1";
  }

  function patchCaptionSignInCta() {
    var cap = global.document.getElementById("mcConfigurationCaption");
    if (!cap) return;
    var t = (cap.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^sign in for configured price\.?$/i.test(t)) return;
    if (cap.querySelector("[data-mc-open-login]")) return;
    cap.innerHTML =
      '<button type="button" class="mc-configuration-rh__signin-cta" data-mc-open-login style="border:none;background:none;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;">Sign in</button> for configured price.';
  }

  function tagSoftGoodsBodyClasses() {
    try {
      var body = global.document.body;
      if (!body) return;
      if (isBeanBagPdpPage()) body.classList.add("mc-bean-bag-pdp");
      if (isSaranoniPdpPage()) body.classList.add("mc-saranoni-pdp");
    } catch (eTag) {}
  }

  function ensurePdpReturnCategoryLink() {
    if (!isProductPdp()) return;
    var category = resolvePdpReturnCategory();
    if (!category || !category.url) return;
    var categoryName = String(category.name || "Category").replace(/^\s+|\s+$/g, "");
    var label = "Return to " + categoryName;
    var linkWrap = global.document.querySelector(".mc-return-category");
    var link = linkWrap ? linkWrap.querySelector(".mc-return-category__link") : null;
    if (!linkWrap || !link) {
      var mediaTd = findPdpMediaTd();
      if (!mediaTd) return;
      if (!linkWrap) {
        linkWrap = global.document.createElement("div");
        linkWrap.className = "mc-return-category";
        link = global.document.createElement("a");
        link.className = "mc-return-category__link";
        linkWrap.appendChild(link);
      }
      try {
        mediaTd.insertBefore(linkWrap, mediaTd.firstChild);
      } catch (eCreate) {}
    }
    if (isSoftGoodsPdpPage()) {
      var mediaCol = findPdpMediaTd();
      if (mediaCol && linkWrap && linkWrap.parentNode !== mediaCol) {
        try {
          mediaCol.insertBefore(linkWrap, mediaCol.firstChild);
        } catch (eMove) {}
      }
    }
    link = global.document.querySelector(".mc-return-category__link");
    if (!link) return;
    try {
      if (link.getAttribute("href") !== category.url) link.href = category.url;
      if (link.textContent !== label) link.textContent = label;
      link.setAttribute("aria-label", label);
    } catch (eRet) {}
  }

  var MC_BLOCKED_RETURN_CATEGORY_IDS = { 136: true };

  function cleanReturnCategoryText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/^\s+|\s+$/g, "");
  }

  function isPdpCategoryUrl(url) {
    return (
      /\/category-s\/\d+\.htm/i.test(url) ||
      /\/[^/?#]+-s\/\d+\.htm/i.test(url) ||
      /SearchResults\.asp[^#]*[?&]Cat=/i.test(url)
    );
  }

  function isBlockedReturnCategory(url, name) {
    var label = cleanReturnCategoryText(name).toLowerCase();
    if (/^about(\s+us)?$/i.test(label)) return true;
    if (/^contact(\s+us)?$/i.test(label)) return true;
    try {
      var path = new URL(url, global.location.origin).pathname.toLowerCase();
      if (/aboutus\.asp/i.test(path)) return true;
      if (/contact[_-]?us/i.test(path)) return true;
      var match = path.match(/(?:category-s\/|-s\/)(\d+)\.htm/i);
      if (match && MC_BLOCKED_RETURN_CATEGORY_IDS[match[1]]) return true;
    } catch (eBlock) {}
    return false;
  }

  function isValidReturnCategory(url, name) {
    if (!url || !isPdpCategoryUrl(url)) return false;
    return !isBlockedReturnCategory(url, name);
  }

  function categoryNameFromPdpUrl(url) {
    var path = String(url || "")
      .split("?")[0]
      .replace(/\/+$/, "");
    var match = path.match(/\/([^/]+)-s\/\d+\.htm/i) || path.match(/\/category-s\/\d+\.htm/i);
    if (match && match[1]) {
      return match[1]
        .replace(/-/g, " ")
        .replace(/\b\w/g, function (letter) {
          return letter.toUpperCase();
        });
    }
    return "Category";
  }

  function categoryFromNavCategoryId(categoryId) {
    var id = String(categoryId || "").trim();
    if (!id || MC_BLOCKED_RETURN_CATEGORY_IDS[id]) return null;
    var link = global.document.querySelector(
      'a[href*="category-s/' + id + '.htm"], a[href*="-s/' + id + '.htm"]'
    );
    if (!link || !link.href) return null;
    var name = cleanReturnCategoryText(link.textContent) || categoryNameFromPdpUrl(link.href);
    if (!isValidReturnCategory(link.href, name)) return null;
    return { url: link.href, name: name };
  }

  function categoryFromVolusionProductCategoryField() {
    var inp = global.document.querySelector(
      'input[name="CategoryID"], input[name="categoryid"], input[name="Category_Id"]'
    );
    if (!inp) return null;
    return categoryFromNavCategoryId(String(inp.value || "").trim());
  }

  function categoryFromPdpProductType() {
    if (isBeanBagPdpPage()) {
      return { url: "/bean-bag-seating-s/103.htm", name: "Bean Bags" };
    }
    var body = global.document.body;
    var html = global.document.documentElement;
    var pcEl =
      global.document.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var pc = String((pcEl && pcEl.value) || "").trim().toUpperCase();
    if (!pc) {
      var path = String(global.location.pathname || "").toLowerCase();
      var mPc = path.match(/\/product-p\/([^/.]+)/i);
      if (mPc) pc = decodeURIComponent(mPc[1]).replace(/-/g, " ").toUpperCase();
    }
    if (body && body.classList.contains("mc-ruched-blanket-pdp")) {
      return (
        categoryFromNavCategoryId("196") || {
          url: "/category-s/196.htm",
          name: "Luxe Comforts",
        }
      );
    }
    if (isSaranoniPdpPage() || /^SAR/.test(pc)) {
      return (
        categoryFromNavCategoryId("196") || {
          url: "/category-s/196.htm",
          name: "Luxe Comforts",
        }
      );
    }
    if (/^BB/.test(pc)) {
      return { url: "/bean-bag-seating-s/103.htm", name: "Bean Bags" };
    }
    if (
      body &&
      (body.classList.contains("mc-theater-seating-pdp") ||
        body.classList.contains("mc-palliser-pdp"))
    ) {
      return (
        categoryFromNavCategoryId("106") || {
          url: "/palliser-theater-seating-s/106.htm",
          name: "Theater Seating",
        }
      );
    }
    if (html && html.classList.contains("is-sectional-product")) {
      return (
        categoryFromNavCategoryId("139") || {
          url: "/sectionals-s/139.htm",
          name: "Sofas & Sectionals",
        }
      );
    }
    return null;
  }

  function categoryFromPdpBreadcrumb() {
    var roots = [];
    var parent = global.document.getElementById("v65-product-parent");
    var content = global.document.getElementById("content_area");
    if (parent) roots.push(parent);
    if (content && roots.indexOf(content) === -1) roots.push(content);
    if (!roots.length) return null;

    var selectors = [
      "#v65-breadcrumbs a[href]",
      ".v65-breadcrumbs a[href]",
      "#breadcrumbs a[href]",
      ".breadcrumbs a[href]",
      ".breadcrumb a[href]",
    ];
    var links = [];
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      var si;
      for (si = 0; si < selectors.length; si++) {
        var matched = roots[ri].querySelectorAll(selectors[si]);
        if (matched.length) {
          links = Array.prototype.slice.call(matched);
          break;
        }
      }
      if (links.length) break;
    }

    if (!links.length) {
      var productHeading = global.document.querySelector(
        "#v65-product-parent h1, .productnamecolorLARGE, #content_area h1"
      );
      links = [];
      for (ri = 0; ri < roots.length; ri++) {
        Array.prototype.slice.call(roots[ri].querySelectorAll("a[href]")).forEach(function (link) {
          if (!isPdpCategoryUrl(link.href)) return;
          if (productHeading) {
            if (
              !(
                link.compareDocumentPosition(productHeading) &
                Node.DOCUMENT_POSITION_FOLLOWING
              )
            ) {
              return;
            }
          }
          links.push(link);
        });
      }
    }

    var categoryLinks = links.filter(function (link) {
      var name = cleanReturnCategoryText(link.textContent) || categoryNameFromPdpUrl(link.href);
      return isValidReturnCategory(link.href, name);
    });
    if (!categoryLinks.length) return null;
    var categoryLink = categoryLinks[categoryLinks.length - 1];
    return {
      url: categoryLink.href,
      name:
        cleanReturnCategoryText(categoryLink.textContent) ||
        categoryNameFromPdpUrl(categoryLink.href),
    };
  }

  function categoryFromPdpReferrer() {
    if (!global.document.referrer) return null;
    try {
      var ref = new URL(global.document.referrer, global.location.origin);
      if (ref.hostname !== global.location.hostname) return null;
      if (!isPdpCategoryUrl(ref.href)) return null;
      var name = categoryNameFromPdpUrl(ref.href);
      if (!isValidReturnCategory(ref.href, name)) return null;
      return { url: ref.href, name: name };
    } catch (eRef) {
      return null;
    }
  }

  function categoryFromPdpStorage() {
    try {
      var saved = global.sessionStorage.getItem("mcLastProductCategory");
      if (!saved) return null;
      var category = JSON.parse(saved);
      if (!category || !category.url) return null;
      if (!isPdpCategoryUrl(category.url)) return null;
      if (category.savedAt && Date.now() - category.savedAt > 7200000) {
        global.sessionStorage.removeItem("mcLastProductCategory");
        return null;
      }
      var name = cleanReturnCategoryText(category.name) || categoryNameFromPdpUrl(category.url);
      if (!isValidReturnCategory(category.url, name)) return null;
      return { url: category.url, name: name };
    } catch (eStore) {
      return null;
    }
  }

  function resolvePdpReturnCategory() {
    return (
      categoryFromPdpProductType() ||
      categoryFromVolusionProductCategoryField() ||
      categoryFromPdpReferrer() ||
      categoryFromPdpBreadcrumb() ||
      categoryFromPdpStorage()
    );
  }

  function ensureBeanBagReturnLink() {
    ensurePdpReturnCategoryLink();
  }

  function reassertSoftGoodsHeroOrder() {
    if (!isSoftGoodsPdpPage()) return;
    try {
      placeBrandLogoBelowTitle();
    } catch (eLogo) {}
    ensureQuantityAboveAtc();
    ensurePurchaseStackCentered();
    if (isBeanBagPdpPage()) {
      mountBeanBagSwatchesAboveFeatures();
      extractSwatchesIntoCol();
      ensureBeanBagPurchaseStack();
      appendBeanBagInfoColumnOrder();
      mountBeanBagDescriptionBelowHero();
      markBeanBagCoverSwatchesReady();
      styleBeanBagPriceAtc();
      ensureBeanBagReturnLink();
    } else if (isSaranoniPdpPage()) {
      ensureSaranoniBrandLogo();
      ensureConfiguredColorSwatches();
      mountDescriptionBelowFeatures();
      appendSaranoniInfoColumnOrder();
      applySoftGoodsColumnPurchaseStackLayout(
        global.document.getElementById("mc-pdp-purchase-stack"),
        global.document.getElementById("mc-pdp-qty-row"),
        resolveAtcPurchaseTarget() ? resolveAtcPurchaseTarget().stackNode : null
      );
    }
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (host) placePriceStackHost(host);
    fixAddToCartChrome();
  }

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
      ensureConfiguredColorSwatches();
      mountPdpFeaturesBlock();
      patchBeanBagPdp();
      if (!isBeanBagPdpPage()) {
        mountDescriptionBelowFeatures();
      }
      ensureQuantityAboveAtc();
      ensurePurchaseStackCentered();
      if (isBeanBagPdpPage()) {
        mountBeanBagSwatchesAboveFeatures();
        extractSwatchesIntoCol();
        ensureBeanBagSizeRow();
        ensureBeanBagPurchaseStack();
        appendBeanBagInfoColumnOrder();
        mountBeanBagDescriptionBelowHero();
        styleBeanBagPriceAtc();
        ensureBeanBagReturnLink();
      } else if (isSaranoniPdpPage()) {
        appendSaranoniInfoColumnOrder();
      } else {
        ensurePdpInfoColumnOrder();
        ensurePdpContentColumnOrder();
      }
      applyPdpTitleTypography();
      applyPdpPriceTypography();
      applyPdpDescriptionStyle();
      applyPdpMainImageCap();
      fixAddToCartChrome();
      ensurePdpReturnCategoryLink();
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

  function runPatch() {
    if (!isProductPdp()) return;
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
      installSaranoniColorAtcGuard();
      installPdpStackApiGuards();
      initBeanBagImageSync();
      ensureBeanBagSizeRow();
      markBeanBagCoverSwatchesReady();
      ensurePdpStackCriticalCss();
      ensurePdpHeroCriticalCss();
      disableQuantityHiders();
      if (!sectional && isSoftGoodsPdpPage()) {
        ensureConfiguredColorSwatches();
      }
      if (!sectional && isPdpLayoutMounted()) {
        forceRebuildCleanPriceStack();
        if (isSoftGoodsPdpPage()) {
          reassertSoftGoodsHeroOrder();
        } else {
          fixAddToCartChrome();
        }
        stripPriceZeroCents();
      } else if (!sectional) {
        if (!mountPdpLayoutOnce()) {
          forceRebuildCleanPriceStack();
          if (isSoftGoodsPdpPage()) {
            reassertSoftGoodsHeroOrder();
          } else {
            fixAddToCartChrome();
          }
        } else {
          stripPriceZeroCents();
        }
      }
      wirePlannerLoginGate();
      guardConfigurationBlockClick();
      patchCaptionSignInCta();
      syncConfigurationBlockPricing();
      inlineSyncConfigurationPrice();
      if (isProductPdp()) {
        ensurePdpReturnCategoryLink();
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

  runPatch();
  global.document.addEventListener("DOMContentLoaded", runPatch);
  global.addEventListener("load", runPatch);
  // Settle the layout only during the brief async window where Volusion injects
  // the options table / price. After ~1.5s we STOP re-running on a timer so the
  // Add-to-Cart block and surrounding layout never move again while the customer
  // is reading or interacting. Genuinely late async injections are still caught
  // once by the throttled, pause-aware MutationObserver below.
  [0, 50, 200, 600, 1500].forEach(function (ms) {
    global.setTimeout(function () {
      if (isPdpLayoutMounted()) return;
      installPdpStackApiGuards();
      runPatch();
    }, ms);
  });

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var moLastRun = 0;
    var mo = new MutationObserver(function () {
      if (isPdpLayoutMounted()) return;
      if (scheduled) return;
      if (global.__MC_PDP_MO_PAUSE__) return;
      // Throttle on every page (not just sectional). Once the hero is built,
      // third-party widgets (Klarna/Affirm) keep mutating the DOM; reacting to
      // each one re-runs the full patch and causes a visible reflow flash.
      var minGap = isSectionalPdpPage()
        ? 2500
        : global.__MC_PDP_HERO_READY_LOCKED__
        ? 1500
        : 400;
      var now = Date.now();
      if (now - moLastRun < minGap) return;
      moLastRun = now;
      scheduled = true;
      global.requestAnimationFrame(function () {
        scheduled = false;
        installPdpStackApiGuards();
        runPatch();
      });
    });
    var root =
      global.document.getElementById("v65-product-parent") ||
      global.document.getElementById("mcConfigurationBlock") ||
      global.document.body;
    if (root) {
      mo.observe(root, {
        childList: true,
        subtree: true,
        characterData: false,
      });
    }
    global.__MC_PDP_LAYOUT_MO__ = mo;
  }
})(window);

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
