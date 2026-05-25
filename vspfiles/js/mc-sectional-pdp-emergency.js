/**
 * Sectional PDP emergency: panel inside #mc-pdp-title-right after h1 (accordion placeTitle safe).
 * MC_SECTIONAL_PDP_EMERGENCY_20260603d
 */
(function (g, d) {
  "use strict";
  var VER = "20260603d";
  function patchRev(v) {
    var m = String(v || "").match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  if (patchRev(g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__) >= patchRev(VER)) return;
  g.__MC_SECTIONAL_INSERT_BEFORE_PATCH__ = VER;

  function titleWrap() {
    return d.getElementById("mc-pdp-title-right");
  }

  function titleH1(wrap) {
    wrap = wrap || titleWrap();
    return wrap ? wrap.querySelector("h1, .productname, .vCSS_productname") : null;
  }

  function firstPricebox() {
    var scope = d.getElementById("v65-product-parent") || d.getElementById("content_area");
    return scope ? scope.querySelector(".colors_pricebox") : null;
  }

  function hideNativeSaleNodes() {
    var root = d.getElementById("v65-product-parent") || d.getElementById("content_area");
    if (!root) return;
    root.querySelectorAll(".product_saleprice, .product_sale_price, font.product_sale_price").forEach(function (node) {
      if (!node || (node.closest && node.closest("#mtl-sectional-configurations, #mc-pdp-accordion"))) return;
      try {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
      } catch (eHide) {}
    });
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

  function hideBeforeTitle() {
    var wrap = titleWrap();
    if (!wrap || !wrap.parentNode) return;
    var child = wrap.parentNode.firstChild;
    while (child && child !== wrap) {
      if (child.nodeType === 1) {
        hideLegacyPricingInPricebox();
        child.querySelectorAll(".mc-pdp-retail-row, .mc-pdp-member-pricing, .mc-pdp-retail-label").forEach(
          function (node) {
            try {
              node.style.setProperty("display", "none", "important");
            } catch (eH) {}
          }
        );
      }
      child = child.nextSibling;
    }
  }

  function assertPanelOrder() {
    var wrap = titleWrap();
    var panel = d.getElementById("mc-pdp-top-price-panel");
    if (!wrap || !panel) return;
    var h1 = titleH1(wrap);
    if (h1 && wrap.contains(h1)) {
      if (h1.nextElementSibling !== panel) {
        try {
          wrap.insertBefore(panel, h1.nextSibling);
        } catch (eIn) {}
      }
      return;
    }
    if (wrap.parentNode && wrap.nextElementSibling !== panel) {
      try {
        wrap.parentNode.insertBefore(panel, wrap.nextSibling);
      } catch (eOrd) {}
    }
  }

  var origInsert = g.__MC_SECTIONAL_ORIG_INSERT__ || Node.prototype.insertBefore;
  if (!g.__MC_SECTIONAL_ORIG_INSERT__) g.__MC_SECTIONAL_ORIG_INSERT__ = origInsert;
  Node.prototype.insertBefore = function (newNode, ref) {
    if (ref != null && ref.parentNode !== this) {
      try {
        if (newNode && newNode.nodeType === 1) {
          var nid = String(newNode.id || "");
          if (nid === "mc-pdp-top-price-panel" || nid === "mtl-pdp-top-price" || nid === "mc-pdp-price-stack-host") {
            var wrap = titleWrap();
            var h1 = titleH1(wrap);
            if (wrap && h1 && wrap.contains(h1)) {
              return origInsert.call(wrap, newNode, h1.nextSibling);
            }
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
  assertPanelOrder();
  hideBeforeTitle();
  hideLegacyPricingInPricebox();
  hideNativeSaleNodes();
  g.setTimeout(function () {
    assertPanelOrder();
    hideBeforeTitle();
    hideLegacyPricingInPricebox();
    hideNativeSaleNodes();
  }, 300);
  g.setTimeout(function () {
    assertPanelOrder();
    hideBeforeTitle();
    hideLegacyPricingInPricebox();
    hideNativeSaleNodes();
  }, 1500);

  function rendererRev(build) {
    var m = String(build || "").match(/v(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function maybeUpgradeRendererFromGh() {
    var WANT = "sectional-20260601-top-price-panel-v29";
    var have = String(g.MTL_RENDERER_BUILD || "").trim();
    if (have === WANT || rendererRev(have) >= rendererRev(WANT)) return;
    if (g.__MC_MTL_RENDERER_UPGRADING__) return;
    g.__MC_MTL_RENDERER_UPGRADING__ = 1;
    var GH =
      "https://raw.githubusercontent.com/emcc10/mccabe-site/main/vspfiles/js/mtl-sectional-renderer.js";
    d.querySelectorAll('script[src*="mtl-sectional-renderer"]').forEach(function (old) {
      try {
        old.remove();
      } catch (eRm) {}
    });
    delete g.MTL_RENDERER_BUILD;
    var s = d.createElement("script");
    s.src = GH + "?mcrd=" + Date.now();
    s.async = false;
    s.onload = function () {
      g.__MC_MTL_RENDERER_UPGRADING__ = 0;
      assertPanelOrder();
      hideBeforeTitle();
      hideLegacyPricingInPricebox();
      hideNativeSaleNodes();
      if (typeof g.mtlUpdateTopPricePanel === "function") g.mtlUpdateTopPricePanel();
    };
    (d.head || d.documentElement).appendChild(s);
  }
  g.setTimeout(maybeUpgradeRendererFromGh, 800);
  g.setTimeout(maybeUpgradeRendererFromGh, 2500);

  if (typeof MutationObserver !== "undefined") {
    var moTimer;
    var mo = new MutationObserver(function () {
      if (moTimer) clearTimeout(moTimer);
      moTimer = g.setTimeout(function () {
        assertPanelOrder();
        hideBeforeTitle();
        hideLegacyPricingInPricebox();
        hideNativeSaleNodes();
      }, 80);
    });
    var wrap = titleWrap();
    if (wrap) {
      mo.observe(wrap, { childList: true });
      if (wrap.parentNode) mo.observe(wrap.parentNode, { childList: true });
    }
  }
})(window, document);
