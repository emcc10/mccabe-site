/**
 * PayPal Pay Later messaging under PDP product price.
 * Inserts PayPal's recommended data-pp-message markup; updates data-pp-amount from the live price.
 */
(function (g, d) {
  "use strict";
  if (g.__MC_PAYPAL_PAY_LATER__) return;
  g.__MC_PAYPAL_PAY_LATER__ = true;

  var MSG_ID = "mc-paypal-pay-later";

  function isPdp() {
    try {
      if (d.body && d.body.classList.contains("productdetails")) return true;
      if (d.body && d.body.classList.contains("mc-product-page")) return true;
      if (d.getElementById("v65-product-parent")) return true;
      var p = String(g.location.pathname || "").toLowerCase();
      return /\.htm(?:\?|$)/i.test(p) && !!d.querySelector(".colors_pricebox, [itemprop='price']");
    } catch (e) {
      return false;
    }
  }

  function parseAmount(text) {
    var src = String(text == null ? "" : text);
    var m = src.match(/\$[\d,]+(?:\.\d+)?/);
    if (m) return parseFloat(m[0].replace(/[$,]/g, "")) || 0;
    m = src.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) || 0 : 0;
  }

  function readPriceAmount() {
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
    var host = d.getElementById("mc-pdp-price-stack-host");
    if (host) return host;

    var price =
      d.querySelector(".colors_pricebox .product_productprice") ||
      d.querySelector(".product_productprice") ||
      d.querySelector("[itemprop='price']");
    if (price) {
      return (
        price.closest(".product_productprice") ||
        price.closest(".colors_pricebox") ||
        price.parentNode ||
        price
      );
    }
    return null;
  }

  function ensureMessage() {
    if (!isPdp()) return;

    var amount = formatAmount(readPriceAmount());
    var existing = d.getElementById(MSG_ID);
    if (existing) {
      if (amount && existing.getAttribute("data-pp-amount") !== amount) {
        existing.setAttribute("data-pp-amount", amount);
      }
      return;
    }

    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;

    var msg = d.createElement("div");
    msg.id = MSG_ID;
    msg.setAttribute("data-pp-message", "");
    msg.setAttribute("data-pp-style-layout", "text");
    msg.setAttribute("data-pp-style-logo-type", "inline");
    msg.setAttribute("data-pp-style-text-color", "black");
    msg.setAttribute("data-pp-amount", amount || "");
    msg.setAttribute("data-pp-language", "");

    var bnpl = d.getElementById("messaging-element");
    if (bnpl && bnpl.parentNode === anchor.parentNode) {
      anchor.parentNode.insertBefore(msg, bnpl);
    } else if (anchor.nextSibling) {
      anchor.parentNode.insertBefore(msg, anchor.nextSibling);
    } else {
      anchor.parentNode.appendChild(msg);
    }
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
