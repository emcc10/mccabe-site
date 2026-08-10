/**
 * MC_BB_CHENILLE_MOBILE_LAYOUT_FIX_20260810
 * Cordaroys / bean-bag mobile PDP layout repair.
 * Delete this file (and its loader / CSS twin blocks) to undo.
 *
 * Fixes:
 * 1) Undo template -280px info-column pull that overlays logo on hero
 * 2) Hide stray "Larger Photo" (#product_photo_zoom_url2)
 * 3) Keep alt-view row in the media stack under the hero (not under the title)
 * 4) Keep price stack visible
 */
(function (global) {
  "use strict";

  if (global.__MC_BB_CHENILLE_MOBILE_LAYOUT_FIX_20260810__) return;
  global.__MC_BB_CHENILLE_MOBILE_LAYOUT_FIX_20260810__ = true;

  function isBeanBagPdp() {
    try {
      var body = global.document && global.document.body;
      if (body && body.classList && body.classList.contains("mc-bean-bag-pdp")) return true;
      var path = String((global.location && global.location.pathname) || "").toLowerCase();
      if (/\/product-p\/bb-/.test(path)) return true;
      var pc = global.document && global.document.querySelector(
        '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"]'
      );
      return /^BB-/i.test(String((pc && pc.value) || ""));
    } catch (e) {}
    return false;
  }

  function isMobile() {
    try {
      return !!(global.matchMedia && global.matchMedia("(max-width: 991px)").matches);
    } catch (e) {
      return false;
    }
  }

  function clearNegativeInfoOffset() {
    if (!isBeanBagPdp() || !isMobile()) return;
    var root = global.document.getElementById("content_area") || global.document.body;
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll(
      "td.mc-pdp-options-td, td.mc-unified-pdp-info, td.vol-product__top--right, td:has(.colors_pricebox), td:has(#priceWithOptions), td:has(#mc-pdp-brand-logo), td:has(#mc-pdp-price-stack-host)"
    );
    Array.prototype.forEach.call(nodes, function (cell) {
      try {
        cell.style.setProperty("margin-top", "0", "important");
        cell.style.setProperty("padding-top", "0", "important");
      } catch (eCell) {}
    });
  }

  function hideLargerPhotoLink() {
    if (!isBeanBagPdp()) return;
    global.document.querySelectorAll("a#product_photo_zoom_url2").forEach(function (a) {
      try {
        a.style.setProperty("display", "none", "important");
        a.style.setProperty("visibility", "hidden", "important");
        a.style.setProperty("height", "0", "important");
        a.style.setProperty("max-height", "0", "important");
        a.style.setProperty("overflow", "hidden", "important");
        a.style.setProperty("margin", "0", "important");
        a.style.setProperty("padding", "0", "important");
        a.style.setProperty("font-size", "0", "important");
        a.style.setProperty("line-height", "0", "important");
        a.setAttribute("aria-hidden", "true");
      } catch (eHide) {}
    });
  }

  function findMediaTd() {
    return (
      global.document.querySelector(
        "#v65-product-parent td.mc-pdp-media-td, #v65-product-parent td.mc-unified-pdp-media, #v65-product-parent td.vol-product__top--left, #product_photo_td"
      ) || null
    );
  }

  function ensureAltViewsUnderHero() {
    if (!isBeanBagPdp()) return;
    var media = findMediaTd();
    if (!media) return;
    var candidates = [];
    var alt =
      global.document.getElementById("altviews") ||
      global.document.querySelector("span#altviews, .altviews, .mc-unified-altviews");
    if (alt) candidates.push(alt);
    var row =
      global.document.getElementById("mc-pdp-alt-view-row") ||
      global.document.getElementById("mc-pdp-alt-view-row-host") ||
      global.document.querySelector(".mc-pdp-alt-view-row, #mc-pdp-alt-view-row-host");
    if (row) candidates.push(row);

    candidates.forEach(function (node) {
      if (!node || media.contains(node)) return;
      var photo =
        global.document.getElementById("product_photo_zoom_url") ||
        global.document.getElementById("product_photo");
      try {
        if (photo && media.contains(photo) && photo.parentNode) {
          var anchor = photo.closest ? photo.closest("table") || photo.parentNode : photo.parentNode;
          if (anchor && anchor.parentNode === media) {
            media.insertBefore(node, anchor.nextSibling);
          } else {
            media.appendChild(node);
          }
        } else {
          media.appendChild(node);
        }
      } catch (eMove) {
        try {
          media.appendChild(node);
        } catch (e2) {}
      }
      try {
        node.style.setProperty("display", "flex", "important");
        node.style.setProperty("visibility", "visible", "important");
        node.style.setProperty("position", "static", "important");
        node.style.setProperty("margin-top", "10px", "important");
        node.style.setProperty("width", "100%", "important");
        node.style.setProperty("max-width", "100%", "important");
        node.style.setProperty("order", "2", "important");
      } catch (eStyle) {}
    });
  }

  function ensurePriceVisible() {
    if (!isBeanBagPdp()) return;
    var host = global.document.getElementById("mc-pdp-price-stack-host");
    if (!host) return;
    try {
      host.style.setProperty("display", "block", "important");
      host.style.setProperty("visibility", "visible", "important");
      host.style.setProperty("opacity", "1", "important");
      host.style.setProperty("height", "auto", "important");
      host.style.setProperty("max-height", "none", "important");
      host.style.setProperty("overflow", "visible", "important");
      host.style.setProperty("color", "#111", "important");
      host.style.setProperty("position", "relative", "important");
      host.style.setProperty("z-index", "3", "important");
    } catch (ePrice) {}
    host.querySelectorAll(".mc-pdp-retail-row, .mc-pdp-stack-retail-amt, .product_productprice, [itemprop='price']").forEach(function (el) {
      try {
        el.style.setProperty("display", el.classList && el.classList.contains("mc-pdp-retail-row") ? "flex" : "block", "important");
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
        el.style.setProperty("color", "#111", "important");
      } catch (eEl) {}
    });
  }

  function ensureLogoNotOverHero() {
    if (!isBeanBagPdp()) return;
    var logo = global.document.getElementById("mc-pdp-brand-logo");
    var info =
      global.document.querySelector(
        "td.mc-pdp-options-td, td.mc-unified-pdp-info, td.vol-product__top--right"
      ) || null;
    var title = global.document.getElementById("mc-pdp-title-right");
    if (!logo || !info) return;
    if (!info.contains(logo) && title && info.contains(title)) {
      try {
        info.insertBefore(logo, title);
      } catch (eIns) {}
    }
    try {
      logo.style.setProperty("position", "static", "important");
      logo.style.setProperty("display", "flex", "important");
      logo.style.setProperty("margin", "12px auto 8px", "important");
      logo.style.setProperty("z-index", "1", "important");
    } catch (eLogo) {}
  }

  function run() {
    if (!isBeanBagPdp()) return;
    clearNegativeInfoOffset();
    hideLargerPhotoLink();
    ensureAltViewsUnderHero();
    ensurePriceVisible();
    ensureLogoNotOverHero();
  }

  function boot() {
    run();
    [0, 200, 600, 1200, 2500, 5000, 9000].forEach(function (ms) {
      global.setTimeout(run, ms);
    });
    if (global.MutationObserver && global.document.documentElement) {
      try {
        var mo = new global.MutationObserver(function () {
          global.clearTimeout(global.__MC_BB_CHENILLE_LAYOUT_MO_T__);
          global.__MC_BB_CHENILLE_LAYOUT_MO_T__ = global.setTimeout(run, 80);
        });
        mo.observe(global.document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
        });
      } catch (eMo) {}
    }
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
