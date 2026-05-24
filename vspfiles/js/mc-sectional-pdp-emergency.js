/**
 * Sectional PDP emergency: fix invalid insertBefore (stale mtl-sectional-renderer v22 loop).
 * Tiny file — always SFTP-deployed. Load before mtl-sectional-renderer.js.
 * MC_SECTIONAL_PDP_EMERGENCY_20260602b
 */
(function (g, d) {
  "use strict";
  if (g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__) return;
  g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__ = "20260602b";

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
            if (title && title.parentNode) {
              var par = title.parentNode;
              return origInsert.call(par, newNode, title.nextSibling);
            }
          }
        }
      } catch (eFix) {}
      return origInsert.call(this, newNode, null);
    }
    return origInsert.call(this, newNode, ref);
  };

  g.__MTL_TOP_PRICE_MOUNT_GAVE_UP__ = false;

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
