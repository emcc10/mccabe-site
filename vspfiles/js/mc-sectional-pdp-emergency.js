/**
 * Sectional PDP emergency: fix invalid insertBefore + hide stray retail rows.
 * MC_SECTIONAL_PDP_EMERGENCY_20260602c
 */
(function (g, d) {
  "use strict";
  if (g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__) return;
  g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__ = "20260602c";

  function findFinancingAfterTitle(title) {
    if (!title) return null;
    var root = d.getElementById("v65-product-parent") || d.getElementById("content_area");
    if (!root) return null;
    var nodes = root.querySelectorAll(
      '[id*="klarna" i], [class*="klarna" i], [data-klarna], klarna-placement, ' +
        '[id*="affirm" i], [class*="affirm" i], [data-affirm], affirm-as-low-as, .affirm-as-low-as'
    );
    var best = null;
    var i;
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || (title.contains && title.contains(node))) continue;
      if (!(title.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      if (!best || node.compareDocumentPosition(best) & Node.DOCUMENT_POSITION_FOLLOWING) best = node;
    }
    return best;
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
            var title =
              d.querySelector("#v65-product-parent h1[itemprop='name']") ||
              d.querySelector("#v65-product-parent h1") ||
              d.querySelector("#content_area h1");
            var fin = findFinancingAfterTitle(title);
            if (fin && fin.parentNode) {
              return origInsert.call(fin.parentNode, newNode, fin);
            }
            if (title && title.parentNode) {
              return origInsert.call(title.parentNode, newNode, title.nextSibling);
            }
          }
        }
      } catch (eFix) {}
      return origInsert.call(this, newNode, null);
    }
    return origInsert.call(this, newNode, ref);
  };

  function hideStrayPriceRows() {
    var top = d.getElementById("mc-pdp-top-price-panel");
    var root = d.getElementById("v65-product-parent") || d.getElementById("content_area");
    if (!root) return;
    root.querySelectorAll(".mc-pdp-retail-row, .mc-pdp-member-pricing").forEach(function (node) {
      if (!node || (top && top.contains && top.contains(node))) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eHide) {}
    });
  }

  g.__MTL_TOP_PRICE_MOUNT_GAVE_UP__ = false;
  hideStrayPriceRows();
  g.setTimeout(hideStrayPriceRows, 200);
  g.setTimeout(hideStrayPriceRows, 1200);

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
