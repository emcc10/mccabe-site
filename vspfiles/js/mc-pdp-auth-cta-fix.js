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

  var VERSION = "20260616pdp19";
  var PDP_CHROME_BORDER = "#e0e0e0";
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
        "#ProductDetail_ProductDetails_div2, .colors_descriptionbox, #content_area span[itemprop='description']"
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
      "#ProductDetail_ProductDetails_div2, #ProductDetail_ProductDetails_div2 .colors_descriptionbox, #ProductDetail_ProductDetails_div2 span[itemprop='description'], #content_area span[itemprop='description']"
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
    global.document.querySelectorAll("#ProductDetail_ProductDetails_div2 ul, #ProductDetail_ProductDetails_div2 ol, #content_area span[itemprop='description'] ul").forEach(function (list) {
      if (!isPdpDescriptionTypographyEl(list)) return;
      try {
        list.style.setProperty("list-style", "disc", "important");
        list.style.setProperty("padding-left", "1.1em", "important");
        list.style.setProperty("margin", "0", "important");
      } catch (eList) {}
    });
    global.document.querySelectorAll("#ProductDetail_ProductDetails_div2 li, #content_area span[itemprop='description'] > li").forEach(function (li) {
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
      if (!/palliser/.test(lc)) continue;
      if (!/(logo|brand|vendor|manufacturer)/.test(lc)) continue;
      if (/swatch|leather|cover|configurator|sectional|paragon|recliner|sofa|loveseat|chaise|seating|chair/.test(lc)) {
        continue;
      }
      return img;
    }
    return null;
  }

  function syncPdpHeroTopAlign() {
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

  function placeBrandLogoAboveTitle() {
    var title = global.document.getElementById("mc-pdp-title-right");
    if (!title || !title.parentNode) return;
    var parent = title.parentNode;
    var wrap = global.document.getElementById("mc-pdp-brand-logo");
    if (wrap && wrap.querySelector("img")) {
      if (wrap.parentNode !== parent || wrap.nextElementSibling !== title) {
        parent.insertBefore(wrap, title);
      }
      syncPdpHeroTopAlign();
      return;
    }
    var logo = findManufacturerLogoImg();
    if (!logo) {
      syncPdpHeroTopAlign();
      return;
    }
    if (!wrap) {
      wrap = global.document.createElement("div");
      wrap.id = "mc-pdp-brand-logo";
      wrap.className = "mc-pdp-brand-logo";
    }
    wrap.appendChild(logo);
    parent.insertBefore(wrap, title);
    syncPdpHeroTopAlign();
  }

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
    if (isBeanBagPdpPage()) {
      hideUniformQty();
      return;
    }
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
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("flex-direction", "column", "important");
    row.style.setProperty("align-items", "center", "important");
    row.style.setProperty("text-align", "center", "important");
    row.style.setProperty("gap", "6px", "important");
    row.style.setProperty("width", "100%", "important");
    row.style.setProperty("max-width", "440px", "important");
    row.style.setProperty("margin", "0 auto 10px auto", "important");
    row.style.setProperty("padding", "0", "important");
    row.style.setProperty("visibility", "visible", "important");
    row.style.setProperty("opacity", "1", "important");
    row.style.setProperty("height", "auto", "important");
    qty.style.setProperty("display", "inline-block", "important");
    qty.style.setProperty("visibility", "visible", "important");
    qty.style.setProperty("opacity", "1", "important");
    qty.style.setProperty("width", "58px", "important");
    qty.style.setProperty("height", "38px", "important");
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
      labEl.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
      labEl.style.setProperty("font-size", "14px", "important");
      labEl.style.setProperty("font-weight", "400", "important");
      labEl.style.setProperty("line-height", "1.55", "important");
      labEl.style.setProperty("letter-spacing", "0.02em", "important");
      labEl.style.setProperty("text-transform", "none", "important");
      labEl.style.setProperty("color", "#444", "important");
    }
    ensurePurchaseStackCentered();
    hideVolusionQuantityRows();
  }

  function ensurePurchaseStackCentered() {
    if (!isProductPdp()) return;
    if (isSectionalPdpPage()) return;
    if (isBeanBagPdpPage()) return;
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
      stack.className = "mc-pdp-purchase-stack";
    }
    if (row && !stack.contains(row)) stack.appendChild(row);
    if (!stack.contains(stackNode)) stack.appendChild(stackNode);
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
      stack.style.setProperty("flex-direction", "column", "important");
      stack.style.setProperty("align-items", "center", "important");
      stack.style.setProperty("justify-content", "center", "important");
      stack.style.setProperty("text-align", "center", "important");
      stack.style.setProperty("width", "100%", "important");
      stack.style.setProperty("max-width", "100%", "important");
      stack.style.setProperty("margin", "8px auto 16px auto", "important");
      stack.style.setProperty("padding", "0", "important");
      stack.style.setProperty("gap", "10px", "important");
      stack.style.setProperty("clear", "both", "important");
    } catch (eStack) {}
    try {
      stackNode.style.setProperty("width", "100%", "important");
      stackNode.style.setProperty("display", "flex", "important");
      stackNode.style.setProperty("justify-content", "center", "important");
      stackNode.style.setProperty("margin", "0 auto", "important");
    } catch (eAtcBlock) {}
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

  function fixAddToCartChrome() {
    global.document.querySelectorAll(".mc-atc-button-wrap").forEach(function (wrap) {
      if (wrap.closest("#mc-pdp-price-atc-row")) return;
      try {
        wrap.style.setProperty("border", "1px solid " + PDP_CHROME_BORDER, "important");
        wrap.style.setProperty("border-color", PDP_CHROME_BORDER, "important");
        wrap.style.setProperty("box-shadow", "none", "important");
        wrap.style.setProperty("border-radius", "0", "important");
        wrap.style.setProperty("background", "#fff", "important");
        wrap.style.setProperty("background-color", "#fff", "important");
        wrap.style.setProperty("color", "#444", "important");
        wrap.style.setProperty("width", "fit-content", "important");
        wrap.style.setProperty("min-width", "0", "important");
        wrap.style.setProperty("max-width", "none", "important");
        wrap.style.setProperty("padding", "10px 18px", "important");
        wrap.style.setProperty("display", "inline-flex", "important");
        wrap.style.setProperty("align-items", "center", "important");
        wrap.style.setProperty("justify-content", "center", "important");
        wrap.style.setProperty("gap", "10px", "important");
      } catch (eAtc) {}
    });
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
      "border:1px solid #e0e0e0!important;border-color:#e0e0e0!important;box-shadow:none!important;" +
      "border-radius:0!important;background:#fff!important;color:#444!important;outline:none!important;" +
      "width:fit-content!important;min-width:0!important;max-width:none!important;padding:10px 18px!important;" +
      "display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:10px!important}" +
      "body.productdetails .mc-atc-button-wrap input[name='btnaddtocart'],body.mc-product-page .mc-atc-button-wrap input[name='btnaddtocart']," +
      "body.productdetails .mc-atc-button-wrap button[name='btnaddtocart'],body.mc-product-page .mc-atc-button-wrap button[name='btnaddtocart']{" +
      "width:auto!important;min-width:0!important;max-width:none!important}" +
      "body.productdetails #mc-pdp-qty-row,body.mc-product-page #mc-pdp-qty-row{" +
      "display:flex!important;flex-direction:column!important;align-items:center!important;text-align:center!important;" +
      "visibility:visible!important;opacity:1!important;height:auto!important;width:100%!important;max-width:440px!important;margin:0 auto 10px auto!important}" +
      "body.productdetails #mc-pdp-qty-row .mc-pdp-qty-row__label,body.mc-product-page #mc-pdp-qty-row .mc-pdp-qty-row__label{" +
      "font-family:Inter,Arial,sans-serif!important;font-size:14px!important;line-height:1.55!important;letter-spacing:0.02em!important;color:#444!important}" +
      "body.productdetails #mc-pdp-qty-row input,body.mc-product-page #mc-pdp-qty-row input{" +
      "display:inline-block!important;visibility:visible!important;opacity:1!important;width:58px!important;height:38px!important;" +
      "border:1px solid #e0e0e0!important;border-radius:0!important;font-size:14px!important;color:#444!important}" +
      "body.productdetails #mc-pdp-purchase-stack,body.mc-product-page #mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;" +
      "text-align:center!important;width:100%!important;max-width:100%!important;margin:8px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "body.productdetails #mc-pdp-purchase-stack .v65-product-addtocart,body.mc-product-page #mc-pdp-purchase-stack .v65-product-addtocart{" +
      "display:flex!important;justify-content:center!important;width:100%!important;margin:0 auto!important}" +
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
      "body.productdetails #mc-pdp-purchase-stack,body.mc-product-page #mc-pdp-purchase-stack," +
      "body.productdetails #v65-product-parent [itemprop='offers'] #mc-pdp-purchase-stack,body.mc-product-page #v65-product-parent [itemprop='offers'] #mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;" +
      "text-align:center!important;width:100%!important;max-width:100%!important;margin:8px auto 16px auto!important;gap:10px!important;clear:both!important}" +
      "body.productdetails #mc-pdp-purchase-stack *,body.mc-product-page #mc-pdp-purchase-stack *{" +
      "text-align:center!important}" +
      "body.productdetails #mc-pdp-features+#mc-pdp-purchase-stack,body.mc-product-page #mc-pdp-features+#mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;" +
      "text-align:center!important;width:100%!important;max-width:100%!important;margin:8px auto 16px auto!important;gap:10px!important;clear:both!important}" +
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
      "max-width:min(650px,100%)!important;width:100%!important;display:block!important}";
  }

  global.mcPlaceBrandLogoAboveTitle = placeBrandLogoAboveTitle;
  global.mcSyncPdpHeroTopAlign = syncPdpHeroTopAlign;

  /** Logo → title → price → Klarna/Affirm pricebox in the right column. */
  function ensureHeroColumnOrder() {
    try {
      placeBrandLogoAboveTitle();
    } catch (eLogo) {}
    if (isBeanBagPdpPage()) {
      // Bean bag / soft-goods PDPs use the uniform layout handled in
      // patchBeanBagPdp(); do not reorder the price/box here or it fights
      // the price+ATC row and causes flicker.
      return;
    }
    var logo = global.document.getElementById("mc-pdp-brand-logo");
    var title = global.document.getElementById("mc-pdp-title-right");
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    var bnpl = global.document.getElementById("messaging-element");
    var box =
      (bnpl && bnpl.closest && bnpl.closest(".colors_pricebox")) ||
      global.document.querySelector("#v65-product-parent .colors_pricebox");
    if (!box || !box.parentNode) return;
    var parent = box.parentNode;
    var anchor = title || price || box;
    if (logo && logo.querySelector && logo.querySelector("img") && anchor) {
      try {
        if (logo.parentNode !== parent) parent.insertBefore(logo, anchor);
        else if (logo.nextElementSibling !== anchor) parent.insertBefore(logo, anchor);
      } catch (eLogoPos) {}
    }
    if (title && title.parentNode !== parent) {
      try {
        parent.insertBefore(title, box);
      } catch (eTitle) {}
    }
    if (price && price.parentNode !== parent) {
      try {
        parent.insertBefore(price, box);
      } catch (ePrice) {}
    }
    if (title && title.parentNode === parent) {
      try {
        if (price && price.parentNode === parent) {
          if (title.nextElementSibling !== price) parent.insertBefore(title, price);
          if (price.nextElementSibling !== box) parent.insertBefore(price, box);
        } else if (title.nextElementSibling !== box) {
          parent.insertBefore(title, box);
        }
      } catch (eOrder) {}
    } else if (price && price.parentNode === parent && price.nextElementSibling !== box) {
      try {
        parent.insertBefore(price, box);
      } catch (ePriceOnly) {}
    }
    try {
      syncPdpHeroTopAlign();
    } catch (eAlign) {}
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
    block.innerHTML =
      '<div class="mc-pdp-features__heading">Features:</div>' +
      '<div class="mc-pdp-features__body">' +
      bodyHtml +
      "</div>";
    try {
      block.style.removeProperty("display");
    } catch (eShow) {}
    var insertParent = findPdpHeroInsertParent();
    var insertAfter = findPdpHeroInsertAfter(insertParent);
    if (!insertParent) return;
    if (isBeanBagPdpPage()) {
      // Ordering for bean bag / soft-goods PDPs is owned by buildBeanBagStack();
      // only make sure the block lives in the options column, never reposition it
      // here (that would fight the stack and cause flicker).
      var bbCol = findPdpHeroColumnTd() || insertParent;
      if (block.parentNode !== bbCol) {
        try {
          bbCol.appendChild(block);
        } catch (eBbFeat) {}
      }
      pruneDescriptionDuplicateFeatures();
      return;
    }
    if (block.parentNode !== insertParent || (insertAfter && block.previousElementSibling !== insertAfter)) {
      insertPdpHeroNodeAfter(insertParent, insertAfter, block);
    }
    pruneDescriptionDuplicateFeatures();
  }

  function normalizeBeanBagOptionLabel(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9\/ ]/g, "")
      .trim();
  }

  function parseBeanBagImageMapFromPage() {
    var map = {};
    try {
      global.document.querySelectorAll("script").forEach(function (sc) {
        var txt = sc.textContent || "";
        if (txt.indexOf("imageMap") === -1 || txt.indexOf("beanbag-swatch") === -1) return;
        var m = txt.match(/var\s+imageMap\s*=\s*(\{[\s\S]*?\});/);
        if (!m) return;
        var pairRe = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
        var pm;
        while ((pm = pairRe.exec(m[1]))) {
          map[pm[1]] = pm[2];
        }
      });
    } catch (eMap) {}
    return map;
  }

  function collectBeanBagAltPhotoIndices() {
    var indices = [];
    global.document.querySelectorAll('[id^="alternate_product_photo_"]').forEach(function (img) {
      var m = String(img.id || "").match(/alternate_product_photo_(\d+)/i);
      if (m) indices.push(parseInt(m[1], 10));
    });
    if (!indices.length) {
      global.document.querySelectorAll("img.vCSS_img_alternate_product_photo").forEach(function (img) {
        var onclick =
          (img.getAttribute("onmouseover") || "") +
          (img.parentElement && img.parentElement.getAttribute
            ? img.parentElement.getAttribute("onmouseover") || ""
            : "");
        var m = onclick.match(/change_product_photo\s*\(\s*(\d+)\s*\)/i);
        if (m) indices.push(parseInt(m[1], 10));
      });
    }
    indices = indices.filter(function (n, i, a) {
      return a.indexOf(n) === i;
    });
    indices.sort(function (a, b) {
      return a - b;
    });
    return indices;
  }

  function resolveBeanBagPhotoIndexForSwatch(swatch, swatchIndex, altIndices) {
    var attr = swatch.getAttribute("data-photo-index");
    if (attr && /^\d+$/.test(attr)) return parseInt(attr, 10);
    if (altIndices.length) {
      return altIndices[Math.min(Math.max(swatchIndex, 0), altIndices.length - 1)];
    }
    return Math.min(Math.max(swatchIndex, 0) + 2, 7);
  }

  function findBeanBagCoverSelect() {
    var sel =
      global.document.querySelector('#options_table select[name*="___4"]') ||
      global.document.querySelector('#v65-product-parent select[name*="___4"]') ||
      global.document.querySelector('select[name*="___4"]');
    if (sel) return sel;
    var selects = global.document.querySelectorAll(
      "#v65-product-parent select, form[action*='ProductDetails'] select"
    );
    var i;
    for (i = 0; i < selects.length; i++) {
      var s = selects[i];
      if (!s.options || s.options.length < 2) continue;
      var j;
      for (j = 0; j < s.options.length; j++) {
        var t = normalizeBeanBagOptionLabel(s.options[j].text);
        if (t.indexOf(" / ") >= 0 || /faux fur|corduroy|chenille|nest|chinchilla|cordaroy/.test(t)) {
          return s;
        }
      }
    }
    return null;
  }

  function applyBeanBagMainPhoto(photoIndex, imageMap, label) {
    var mainImg = global.document.getElementById("product_photo");
    if (typeof global.change_product_photo === "function" && photoIndex > 0) {
      try {
        global.change_product_photo(photoIndex);
      } catch (ePhoto) {}
    }
    if (mainImg && imageMap[label]) {
      var file = imageMap[label];
      var src = mainImg.src || "";
      var candidates = [];
      if (src) {
        candidates.push(src.replace(/[^/]+$/, file));
        candidates.push(src.replace(/\/photos\/[^/]+$/, "/photos/" + file.replace(/\.jpg/i, "T.jpg")));
      }
      candidates.push("/v/vspfiles/photos/" + file.replace(/\.jpg/i, "T.jpg"));
      candidates.push("/v/vspfiles/photos/" + file);
      candidates.push("/v/vspfiles/images/" + file);
      var ci;
      for (ci = 0; ci < candidates.length; ci++) {
        if (candidates[ci] && mainImg.getAttribute("src") !== candidates[ci]) {
          try {
            mainImg.src = candidates[ci];
            break;
          } catch (eSrc) {}
        }
      }
    }
    if (mainImg) {
      var zoom = global.document.getElementById("product_photo_zoom_url");
      if (zoom) {
        try {
          var full = (mainImg.src || "").replace(/T\.jpg/i, ".jpg").replace(/S\.jpg/i, ".jpg");
          zoom.href = full;
          if (label) zoom.title = label;
        } catch (eZoom) {}
      }
      try {
        mainImg.style.setProperty("opacity", "1", "important");
      } catch (eOp) {}
    }
  }

  function syncBeanBagCoverOption(label) {
    var coverSelect = findBeanBagCoverSelect();
    if (!coverSelect) return false;
    var target = normalizeBeanBagOptionLabel(label);
    var foundIndex = -1;
    var i;
    for (i = 0; i < coverSelect.options.length; i++) {
      if (normalizeBeanBagOptionLabel(coverSelect.options[i].text) === target) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex === -1) return false;
    coverSelect.selectedIndex = foundIndex;
    if (typeof global.change_option === "function") {
      try {
        global.change_option(coverSelect.name, coverSelect.options[foundIndex].value);
      } catch (eOpt) {}
    }
    if (typeof global.AutoUpdatePriceWithSelectedOptions === "function") {
      try {
        global.AutoUpdatePriceWithSelectedOptions(coverSelect.options[foundIndex].value, 4);
      } catch (ePrice) {}
    }
    try {
      coverSelect.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (eEv) {}
    return true;
  }

  function handleBeanBagSwatchClick(swatch) {
    if (!swatch) return;
    var label = swatch.getAttribute("data-option") || swatch.getAttribute("alt") || "";
    if (!label) return;
    var swatches = global.document.querySelectorAll(".beanbag-swatch");
    var swatchIndex = -1;
    var i;
    for (i = 0; i < swatches.length; i++) {
      if (swatches[i] === swatch) {
        swatchIndex = i;
        break;
      }
    }
    if (!global.__MC_BEANBAG_IMAGE_MAP__) {
      global.__MC_BEANBAG_IMAGE_MAP__ = parseBeanBagImageMapFromPage();
    }
    if (!global.__MC_BEANBAG_ALT_INDICES__) {
      global.__MC_BEANBAG_ALT_INDICES__ = collectBeanBagAltPhotoIndices();
    }
    var photoIndex = resolveBeanBagPhotoIndexForSwatch(
      swatch,
      swatchIndex,
      global.__MC_BEANBAG_ALT_INDICES__
    );
    applyBeanBagMainPhoto(photoIndex, global.__MC_BEANBAG_IMAGE_MAP__, label);
    syncBeanBagCoverOption(label);
    var labelSpan = global.document.getElementById("beanbag-selected-cover-name");
    if (labelSpan) labelSpan.textContent = label;
    swatches.forEach(function (s) {
      s.classList.remove("active");
    });
    swatch.classList.add("active");
    global.__MC_BEANBAG_SELECTED_COVER__ = label;
  }

  function mountBeanBagSwatchesAboveFeatures() {
    if (!isProductPdp()) return;
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.setAttribute("data-mc-beanbag-swatches", "1");
    wrap.dataset.moved = "1";
    mountPdpFeaturesBlock();
    var features = global.document.getElementById("mc-pdp-features");
    var insertParent = findPdpHeroInsertParent();
    if (!insertParent) return;
    if (features && features.parentNode !== insertParent) {
      insertPdpHeroNodeAfter(insertParent, findPdpHeroInsertAfter(insertParent), features);
    }
    try {
      if (features) insertParent.insertBefore(wrap, features);
      else insertPdpHeroNodeAfter(insertParent, findPdpHeroInsertAfter(insertParent), wrap);
    } catch (eMount) {}
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

  function initBeanBagSwatchBehavior() {
    if (!global.document.getElementById("beanbag-swatch-wrapper")) return;
    if (global.__MC_BEANBAG_SWATCH_CAPTURE__) return;
    global.__MC_BEANBAG_SWATCH_CAPTURE__ = true;
    global.document.addEventListener(
      "click",
      function (e) {
        var swatch = e.target && e.target.closest ? e.target.closest(".beanbag-swatch") : null;
        if (!swatch) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleBeanBagSwatchClick(swatch);
      },
      true
    );
    var saved = global.__MC_BEANBAG_SELECTED_COVER__;
    if (saved) {
      global.document.querySelectorAll(".beanbag-swatch").forEach(function (s) {
        if (s.getAttribute("data-option") === saved) handleBeanBagSwatchClick(s);
      });
    }
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
    var opt = global.document.querySelector("#v65-product-parent td.mc-pdp-options-td");
    if (!opt) return;
    var media = opt.previousElementSibling;
    if (media && media.tagName === "TD" && !media.classList.contains("mc-pdp-hero-media-col")) {
      media.classList.add("mc-pdp-hero-media-col");
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
    if (!isBeanBagPdpPage()) return;
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
        col.appendChild(host);
      } catch (eH) {}
    }
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
      pruneDescriptionDuplicateFeatures();
    } catch (ePrune) {}
  }

  function extractSwatchesIntoCol() {
    var wrap = global.document.getElementById("beanbag-swatch-wrapper");
    if (!wrap) return;
    wrap.setAttribute("data-mc-beanbag-swatches", "1");
    wrap.dataset.moved = "1";
    var col = findPdpHeroColumnTd();
    if (col && !col.contains(wrap)) {
      try {
        col.appendChild(wrap);
      } catch (eSw) {}
    }
    var labelWrap = global.document.getElementById("beanbag-selected-cover");
    if (labelWrap) {
      try {
        labelWrap.style.setProperty("display", "block", "important");
      } catch (eLab) {}
    }
  }

  function styleBeanBagPriceAtc() {
    var row = global.document.getElementById("mc-pdp-price-atc-row");
    if (!row) return;
    var price = global.document.getElementById("mc-pdp-price-stack-host");
    if (price) {
      // override the inline width:100% that placePriceStackHost sets so the
      // price shrinks to its content and the ATC can sit beside it
      price.style.setProperty("display", "inline-flex", "important");
      price.style.setProperty("align-items", "center", "important");
      price.style.setProperty("width", "auto", "important");
      price.style.setProperty("max-width", "none", "important");
      price.style.setProperty("flex", "0 0 auto", "important");
      price.style.setProperty("margin", "0", "important");
      price.style.setProperty("padding", "0", "important");
    }
    var wrap = row.querySelector(".mc-atc-button-wrap");
    if (!wrap) return;
    // clear any chrome that fixAddToCartChrome applied before the wrap was
    // moved into the row (inline styles can't be undone by the stylesheet)
    wrap.style.setProperty("border", "none", "important");
    wrap.style.setProperty("box-shadow", "none", "important");
    wrap.style.setProperty("background", "transparent", "important");
    wrap.style.setProperty("background-color", "transparent", "important");
    wrap.style.setProperty("padding", "0", "important");
    wrap.style.setProperty("margin", "0", "important");
    wrap.style.setProperty("width", "auto", "important");
    wrap.style.setProperty("min-width", "0", "important");
    wrap.style.setProperty("max-width", "none", "important");
    wrap.style.setProperty("display", "inline-flex", "important");
    wrap.style.setProperty("align-items", "center", "important");
    wrap.style.setProperty("gap", "0", "important");
    wrap.style.setProperty("flex", "0 0 auto", "important");
    var icon = wrap.querySelector(".mc-cart-icon-wrapper");
    if (icon) icon.style.setProperty("display", "none", "important");
    var btn = wrap.querySelector("input, button");
    if (btn) {
      btn.style.setProperty("border", "none", "important");
      btn.style.setProperty("background", "#111", "important");
      btn.style.setProperty("background-color", "#111", "important");
      btn.style.setProperty("color", "#fff", "important");
      btn.style.setProperty("font-family", "Inter, Arial, sans-serif", "important");
      btn.style.setProperty("font-size", "11px", "important");
      btn.style.setProperty("font-weight", "500", "important");
      btn.style.setProperty("letter-spacing", "0.14em", "important");
      btn.style.setProperty("text-transform", "uppercase", "important");
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("padding", "10px 18px", "important");
      btn.style.setProperty("margin", "0", "important");
      btn.style.setProperty("width", "auto", "important");
      btn.style.setProperty("min-width", "0", "important");
      btn.style.setProperty("border-radius", "0", "important");
      btn.style.setProperty("cursor", "pointer", "important");
    }
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

  // Authoritative ordering: collect the hero nodes into one dedicated stack and
  // append them in the desired order. appendChild both moves AND orders, so this
  // is robust against the deeply nested Volusion table. Idempotent: only
  // re-append when the current order is wrong (prevents MutationObserver loops).
  function buildBeanBagStack() {
    var col = findPdpHeroColumnTd();
    if (!col) return;
    var stack = global.document.getElementById("mc-pdp-hero-stack");
    if (!stack) {
      stack = global.document.createElement("div");
      stack.id = "mc-pdp-hero-stack";
      stack.className = "mc-pdp-hero-stack";
    }
    if (stack.parentNode !== col) {
      try {
        col.insertBefore(stack, col.firstChild);
      } catch (eStk) {}
    }
    var seq = [
      global.document.getElementById("mc-pdp-brand-logo"),
      global.document.getElementById("mc-pdp-title-right"),
      global.document.getElementById("mc-pdp-price-atc-row"),
      global.document.getElementById("messaging-element"),
      global.document.getElementById("beanbag-swatch-wrapper"),
      global.document.getElementById("mc-pdp-features"),
      global.document.getElementById("mc-pdp-description-below-features"),
    ].filter(function (n) {
      return !!n;
    });
    var correct =
      stack.children.length === seq.length &&
      seq.every(function (n, i) {
        return stack.children[i] === n;
      });
    if (!correct) {
      seq.forEach(function (n) {
        try {
          stack.appendChild(n);
        } catch (eApp) {}
      });
    }
  }

  function patchBeanBagPdp() {
    if (!isProductPdp()) return;
    if (!isBeanBagPdpPage() && !global.document.getElementById("beanbag-swatch-wrapper")) return;
    withMoPaused(function () {
      tagHeroMediaCol();
      try {
        placeBrandLogoAboveTitle();
      } catch (eLogo) {}
      mountPdpFeaturesBlock();
      extractSwatchesIntoCol();
      ensureBeanBagPriceAtcRow();
      mountDescriptionBelowFeatures();
      hideLegacyBeanBagPrice();
      buildBeanBagStack();
      styleBeanBagPriceAtc();
      hideUniformQty();
      initBeanBagSwatchBehavior();
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
    host.innerHTML = buildStackHostHtml(retailAmt, saleAmt, guest);
    host.setAttribute("data-mc-stack-sig", sig);
    host.setAttribute("data-mc-stack-owned", "1");
    prunePriceStackHost(host);
    placePriceStackHost(host);
    hideAllStrayPdpPriceNodes(host);
    hideDuplicatePdpPriceUi();
    ensureHeroColumnOrder();
    mountPdpFeaturesBlock();
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

  function runPatch() {
    if (!isProductPdp()) return;
    var sectional = isSectionalPdpPage();
    var heroLocked = !!global.__MC_PDP_HERO_READY_LOCKED__;
    try {
      installPdpStackApiGuards();
      ensurePdpStackCriticalCss();
      ensurePdpHeroCriticalCss();
      disableQuantityHiders();
      if (!sectional) {
        forceRebuildCleanPriceStack();
      }
      if (!heroLocked) {
        ensureHeroColumnOrder();
      }
      applyPdpTitleTypography();
      applyPdpPriceTypography();
      applyPdpDescriptionStyle();
      applyPdpMainImageCap();
      mountPdpFeaturesBlock();
      patchBeanBagPdp();
      ensureQuantityAboveAtc();
      ensurePurchaseStackCentered();
      fixAddToCartChrome();
      stripPriceZeroCents();
      if (!heroLocked) {
        try {
          syncPdpHeroTopAlign();
        } catch (eAlignFinal) {}
      }
      scheduleMarkPdpHeroReady();
      wirePlannerLoginGate();
      guardConfigurationBlockClick();
      patchCaptionSignInCta();
      syncConfigurationBlockPricing();
      inlineSyncConfigurationPrice();
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
  [0, 50, 200, 600, 1500, 4000, 9000, 15000, 25000, 35000].forEach(function (ms) {
    global.setTimeout(function () {
      installPdpStackApiGuards();
      runPatch();
    }, ms);
  });

  if (typeof MutationObserver !== "undefined") {
    var scheduled = false;
    var moLastRun = 0;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      if (global.__MC_PDP_MO_PAUSE__) return;
      var sectional = isSectionalPdpPage();
      if (sectional) {
        var now = Date.now();
        if (now - moLastRun < 2500) return;
        moLastRun = now;
      }
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
        characterData: !isSectionalPdpPage(),
      });
    }
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
