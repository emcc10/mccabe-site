/**
 * PayPal Pay Later under ATC:
 * 1) static banner linked to paypal.com/buynowpaylater
 * 2) PayPal Messages widget under that banner
 */
(function (g, d) {
  "use strict";
  if (g.__MC_PAYPAL_PAY_LATER__) return;
  g.__MC_PAYPAL_PAY_LATER__ = true;

  try {
    if (
      d.getElementById("v65-product-parent") &&
      !d.querySelector('script[src*="mc-pdp-auth-cta-form-20260807bbcol4.js"]')
    ) {
      var stBoot = d.createElement("script");
      stBoot.src = "/v/vspfiles/js/mc-pdp-auth-cta-form-20260807bbcol4.js?v=1";
      stBoot.async = false;
      (d.head || d.documentElement).appendChild(stBoot);
    }
  } catch (eBootStub) {}


  /* Piggyback: CF still serves fat form.js?mcrd= without leather maps. */
  try {
    var onLeather =
      /bb-faux-leather/i.test(String((g.location && g.location.pathname) || "")) ||
      !!d.getElementById("beanbag-swatch-wrapper");
    if (
      onLeather &&
      !d.querySelector('script[src*="mc-bb-leather-swatch-fix-20260807.js"]') &&
      !g.__MC_BB_LEATHER_SWATCH_FIX_LOADING__
    ) {
      g.__MC_BB_LEATHER_SWATCH_FIX_LOADING__ = true;
      var bbFix = d.createElement("script");
      bbFix.id = "mc-bb-leather-swatch-fix-js";
      bbFix.src = "/v/vspfiles/js/mc-bb-leather-swatch-fix-20260807.js?v=1";
      bbFix.async = true;
      (d.head || d.documentElement).appendChild(bbFix);
    }
  } catch (eBbLeather) {}

  var BANNER_ID = "mc-paypal-pay-later-banner";
  var MSG_ID = "mc-paypal-pay-later";
  var BANNER_SRC =
    "/v/vspfiles/photos/paypal-pay-later-banner.png?v=20260807banner1";
  var BANNER_HREF = "https://www.paypal.com/buynowpaylater";
  var SDK_SRC =
    "https://www.paypal.com/sdk/js?client-id=BAA5Ktre8-h8F-am0mMMNgEdyM-MlrQeoAHfag4_JaPrKyVYX_xsDIWS1SYLFlVXmIKGj7GRgtKUnOAu7A&components=messages";

  function isPdp() {
    try {
      if (d.body && d.body.classList.contains("productdetails")) return true;
      if (d.body && d.body.classList.contains("mc-product-page")) return true;
      if (d.getElementById("v65-product-parent")) return true;
      var p = String(g.location.pathname || "").toLowerCase();
      return (
        (/\/product-p\//i.test(p) || /\.htm(?:\?|$)/i.test(p)) &&
        !!d.querySelector(
          ".colors_pricebox, [itemprop='price'], .product_productprice, #mc-mahjong-price-host"
        )
      );
    } catch (e) {
      return false;
    }
  }

  function ensureMessagesSdk() {
    if (d.querySelector('script[src*="paypal.com/sdk/js"][src*="messages"]')) return;
    if (d.getElementById("mc-paypal-messages-sdk")) return;
    var s = d.createElement("script");
    s.id = "mc-paypal-messages-sdk";
    s.src = SDK_SRC;
    s.setAttribute("data-namespace", "PayPalSDK");
    (d.head || d.documentElement).appendChild(s);
  }

  function parseAmount(text) {
    var src = String(text == null ? "" : text);
    var m = src.match(/\$[\d,]+(?:\.\d+)?/);
    if (m) return parseFloat(m[0].replace(/[$,]/g, "")) || 0;
    m = src.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) || 0 : 0;
  }

  function readPriceAmount() {
    var mahjong = d.getElementById("mc-mahjong-price-host");
    if (mahjong) {
      var mh = parseAmount(mahjong.textContent);
      if (mh > 0) return mh;
    }

    var el =
      d.querySelector("#mc-pdp-price-stack-host [itemprop='price']") ||
      d.querySelector("#v65-product-parent [itemprop='price']") ||
      d.querySelector("[itemprop='price']");
    if (el) {
      var content = el.getAttribute("content");
      if (content) {
        var fromContent = parseFloat(String(content).replace(/,/g, ""));
        if (fromContent > 0) return fromContent;
      }
      var fromText = parseAmount(el.textContent);
      if (fromText > 0) return fromText;
    }

    var priceEl =
      d.querySelector("#mc-pdp-price-stack-host .mc-pdp-stack-retail-amt") ||
      d.querySelector("#mc-pdp-price-stack-host .product_list_price") ||
      d.querySelector("#priceWithOptionsNoTax") ||
      d.querySelector("#priceWithOptions") ||
      d.querySelector(".colors_pricebox .product_productprice") ||
      d.querySelector(".product_productprice");
    if (priceEl) {
      var n = parseAmount(priceEl.textContent);
      if (n > 0) return n;
    }
    return 0;
  }

  function formatAmount(n) {
    n = Number(n || 0);
    if (!(n > 0)) return "";
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function findAnchor() {
    var stack = d.getElementById("mc-pdp-purchase-stack");
    if (stack) return stack;

    var controls =
      d.querySelector(".mc-unified-purchase-controls") ||
      d.querySelector(".mc-pdp-purchase-controls") ||
      d.querySelector(".mc-pdp-cart-row");
    if (controls) return controls;

    var atc =
      d.querySelector("#v65-product-parent input[name='btnaddtocart']") ||
      d.querySelector("#v65-product-parent button[name='btnaddtocart']") ||
      d.querySelector("input[name='btnaddtocart'], button[name='btnaddtocart']");
    if (atc) {
      var row =
        (atc.closest &&
          (atc.closest("tr") ||
            atc.closest(".v65-product-addtocart") ||
            atc.closest(".mc-atc-button-wrap"))) ||
        null;
      return row || atc;
    }

    var mahjong = d.getElementById("mc-mahjong-price-host");
    if (mahjong) return mahjong;

    var host = d.getElementById("mc-pdp-price-stack-host");
    if (host) return host;

    return null;
  }

  function getPurchaseStack(anchor) {
    return (
      (anchor && anchor.id === "mc-pdp-purchase-stack" && anchor) ||
      d.getElementById("mc-pdp-purchase-stack") ||
      (anchor &&
        anchor.closest &&
        (anchor.closest("#mc-pdp-purchase-stack") ||
          anchor.closest(".mc-unified-purchase-controls") ||
          anchor.closest(".mc-pdp-purchase-controls")))
    );
  }

  function stylePayLaterNode(node, order) {
    try {
      node.style.setProperty("order", String(order), "important");
      node.style.setProperty("display", "block", "important");
      node.style.setProperty("width", "100%", "important");
      node.style.setProperty("margin-top", "8px", "important");
      node.style.setProperty("box-sizing", "border-box", "important");
    } catch (eStyle) {}
  }

  function placeInStack(stack, node, order) {
    if (!stack || !node) return;
    if (node.parentNode !== stack || stack.lastElementChild !== node) {
      try {
        stack.appendChild(node);
      } catch (eApp) {}
    }
    stylePayLaterNode(node, order);
  }

  function placeAfter(anchor, node) {
    if (!anchor || !node || !anchor.parentNode) return;
    if (node.previousElementSibling === anchor && node.parentNode === anchor.parentNode) return;
    if (anchor.nextSibling) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else anchor.parentNode.appendChild(node);
  }

  function ensureBanner(anchor) {
    var existing = d.getElementById(BANNER_ID);
    if (existing) {
      var stack = getPurchaseStack(anchor);
      if (stack) placeInStack(stack, existing, 3);
      else placeAfter(anchor, existing);
      return existing;
    }

    var a = d.createElement("a");
    a.id = BANNER_ID;
    a.href = BANNER_HREF;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "PayPal Buy Now Pay Later — Learn more");

    var img = d.createElement("img");
    img.src = BANNER_SRC;
    img.alt = "Love it. Buy it. Pay Later. PayPal";
    img.width = 468;
    img.height = 60;
    img.decoding = "async";
    img.loading = "lazy";
    try {
      img.style.setProperty("display", "block", "important");
      img.style.setProperty("width", "100%", "important");
      img.style.setProperty("max-width", "468px", "important");
      img.style.setProperty("height", "auto", "important");
    } catch (eImg) {}
    a.appendChild(img);

    var stack = getPurchaseStack(anchor);
    if (stack) placeInStack(stack, a, 3);
    else placeAfter(anchor, a);
    return a;
  }

  function ensureMessage(anchor, banner) {
    ensureMessagesSdk();

    var amount = formatAmount(readPriceAmount());
    var existing = d.getElementById(MSG_ID);
    if (existing) {
      var stack = getPurchaseStack(anchor);
      if (stack) placeInStack(stack, existing, 4);
      else placeAfter(banner || anchor, existing);
      if (amount && existing.getAttribute("data-pp-amount") !== amount) {
        existing.setAttribute("data-pp-amount", amount);
        try {
          if (g.PayPalSDK && g.PayPalSDK.Messages) g.PayPalSDK.Messages.render();
          else if (g.paypal && g.paypal.Messages) g.paypal.Messages.render();
        } catch (eRender) {}
      }
      return;
    }

    var msg = d.createElement("div");
    msg.id = MSG_ID;
    msg.setAttribute("data-pp-message", "");
    msg.setAttribute("data-pp-style-layout", "text");
    msg.setAttribute("data-pp-style-logo-type", "inline");
    msg.setAttribute("data-pp-style-text-color", "black");
    msg.setAttribute("data-pp-amount", amount || "");
    msg.setAttribute("data-pp-language", "");

    var stack = getPurchaseStack(anchor);
    if (stack) placeInStack(stack, msg, 4);
    else placeAfter(banner || anchor, msg);

    try {
      if (g.PayPalSDK && g.PayPalSDK.Messages) g.PayPalSDK.Messages.render();
      else if (g.paypal && g.paypal.Messages) g.paypal.Messages.render();
    } catch (eRender2) {}
  }

  function ensurePayLater() {
    if (!isPdp()) return;
    var anchor = findAnchor();
    if (!anchor) return;
    var banner = ensureBanner(anchor);
    ensureMessage(anchor, banner);
  }

  function tick() {
    try {
      ensurePayLater();
    } catch (e) {}
  }

  function start() {
    tick();
    /* Timed retries only — no MutationObserver. */
    [0, 400, 1200, 3000].forEach(function (ms) {
      g.setTimeout(tick, ms);
    });
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  g.addEventListener("load", tick);
})(window, document);
