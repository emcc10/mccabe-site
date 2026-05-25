/**
 * Sectional PDP emergency: mount top price before first .colors_pricebox (accordion layout).
 * MC_SECTIONAL_PDP_EMERGENCY_20260603a
 */
(function (g, d) {
  "use strict";
  if (g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__) return;
  g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__ = "20260603a";

  function firstPricebox() {
    var scope = d.getElementById("v65-product-parent") || d.getElementById("content_area");
    return scope ? scope.querySelector(".colors_pricebox") : null;
  }

  function hideLegacyPricingInPricebox() {
    var pb = firstPricebox();
    if (!pb) return;
    pb.querySelectorAll(
      ".mc-pdp-retail-row, .mc-pdp-member-pricing, .mc-pdp-retail-label, .product_productprice, .product_list_price, font.product_list_price"
    ).forEach(function (node) {
      if (!node) return;
      var blob = (String(node.id || "") + " " + String(node.className || "")).toLowerCase();
      if (/klarna|affirm/.test(blob)) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eHide) {}
    });
  }

  var origInsert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, ref) {
    if (ref != null && ref.parentNode !== this) {
      try {
        if (newNode && newNode.nodeType === 1) {
          var nid = String(newNode.id || "");
          if (
            nid === "mc-pdp-top-price-panel" ||
            nid === "mtl-pdp-top-price" ||
            nid === "mc-pdp-price-stack-host"
          ) {
            var pb = firstPricebox();
            if (pb && pb.parentNode) {
              return origInsert.call(pb.parentNode, newNode, pb);
            }
            var wrap = d.getElementById("mc-pdp-title-right");
            if (wrap && wrap.parentNode) {
              return origInsert.call(wrap.parentNode, newNode, wrap.nextSibling);
            }
          }
        }
      } catch (eFix) {}
      return origInsert.call(this, newNode, null);
    }
    return origInsert.call(this, newNode, ref);
  };

  g.__MTL_TOP_PRICE_MOUNT_GAVE_UP__ = false;
  hideLegacyPricingInPricebox();
  g.setTimeout(hideLegacyPricingInPricebox, 250);
  g.setTimeout(hideLegacyPricingInPricebox, 1500);

  var moPatched = false;
  function patchMutationObserver() {
    if (moPatched || typeof MutationObserver === "undefined") return;
    moPatched = true;
    var Orig = g.MutationObserver;
    g.MutationObserver = function (callback) {
      var timer;
      return new Orig(function (records, observer) {
        if (g.__MTL_TOP_PRICE_MOUNT_GAVE_UP__) {
          var stack = "";
          try {
            stack = new Error().stack || "";
          } catch (eSt) {}
          if (
            stack.indexOf("updateTopPricePanel") >= 0 ||
            stack.indexOf("mountTopPricePanelUnderTitleOnce") >= 0
          ) {
            return;
          }
        }
        if (timer) clearTimeout(timer);
        timer = g.setTimeout(function () {
          timer = null;
          callback(records, observer);
        }, 150);
      });
    };
    g.MutationObserver.prototype = Orig.prototype;
  }
  patchMutationObserver();
})(window, document);
