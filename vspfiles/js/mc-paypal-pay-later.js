/**
 * PayPal Pay Later messaging under PDP product price.
 * Inserts PayPal's recommended data-pp-message markup; updates data-pp-amount from the live price.
 * Works with Volusion's existing PayPal Messages SDK and/or the dedicated messages SDK in template_266.
 */
(function (g, d) {
  "use strict";
  if (g.__MC_PAYPAL_PAY_LATER__) return;
  g.__MC_PAYPAL_PAY_LATER__ = true;

  var MSG_ID = "mc-paypal-pay-later";
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
    /* Prefer the whole purchase stack so Pay Later sits under ATC, not beside it
       in a flex/grid row with .mc-atc-button-wrap. */
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

  function placeUnderAtc(anchor, node) {
    if (!anchor || !node) return;
    /* On Steve Silver / unified PDPs the info column uses flex order. A sibling
       after #mc-pdp-purchase-stack can still paint at the top of the column.
       Append inside the purchase stack so it stays under the ATC button. */
    var stack =
      (anchor.id === "mc-pdp-purchase-stack" && anchor) ||
      d.getElementById("mc-pdp-purchase-stack") ||
      (anchor.closest &&
        (anchor.closest("#mc-pdp-purchase-stack") ||
          anchor.closest(".mc-unified-purchase-controls") ||
          anchor.closest(".mc-pdp-purchase-controls")));
    if (stack) {
      if (node.parentNode !== stack || stack.lastElementChild !== node) {
        try {
          stack.appendChild(node);
        } catch (eApp) {}
      }
      return;
    }
    if (!anchor.parentNode) return;
    if (node.previousElementSibling === anchor && node.parentNode === anchor.parentNode) return;
    if (anchor.nextSibling) anchor.parentNode.insertBefore(node, anchor.nextSibling);
    else anchor.parentNode.appendChild(node);
  }

  function ensureMessage() {
    if (!isPdp()) return;
    ensureMessagesSdk();

    var amount = formatAmount(readPriceAmount());
    var anchor = findAnchor();
    if (!anchor) return;

    var existing = d.getElementById(MSG_ID);
    if (existing) {
      placeUnderAtc(anchor, existing);
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
    placeUnderAtc(anchor, msg);

    try {
      if (g.PayPalSDK && g.PayPalSDK.Messages) g.PayPalSDK.Messages.render();
      else if (g.paypal && g.paypal.Messages) g.paypal.Messages.render();
    } catch (eRender2) {}
  }

  function tick() {
    try {
      ensureMessage();
    } catch (e) {}
  }

  function start() {
    tick();
    [0, 200, 600, 1200, 2500, 5000].forEach(function (ms) {
      g.setTimeout(tick, ms);
    });
    try {
      var root =
        d.getElementById("v65-product-parent") ||
        d.getElementById("content_area") ||
        d.body;
      if (root && typeof MutationObserver === "function") {
        var mo = new MutationObserver(function () {
          tick();
        });
        mo.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["content", "value"]
        });
      }
    } catch (eMo) {}
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  g.addEventListener("load", tick);
})(window, document);
