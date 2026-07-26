/**
 * Steve Silver / SS-* PDP layout stabilizer.
 * Guarantees the same right-column order on every SS product:
 *   title → price → FEATURES / PRODUCT DETAILS accordion → qty + ATC
 * Runs with setTimeout retries only (no MutationObserver) so it still works
 * when SS MO-neuter is active to stop freezes.
 * MC_SS_PDP_LAYOUT_20260726audit1
 */
(function (global) {
  "use strict";
  if (!global || !global.document) return;
  if (global.__MC_SS_PDP_LAYOUT_20260726audit1__) return;
  global.__MC_SS_PDP_LAYOUT_20260726audit1__ = true;

  var STYLE_ID = "mc-ss-pdp-layout-css";
  var RUNS = 0;
  var MAX_RUNS = 24;

  function path() {
    return String((global.location && global.location.pathname) || "").toLowerCase();
  }

  function productCode() {
    try {
      var el = global.document.querySelector(
        '#v65-product-parent input[name="ProductCode"], input[name="ProductCode"], input[name="productcode"]'
      );
      return String((global.global_Current_ProductCode || (el && el.value) || ""))
        .trim()
        .toUpperCase();
    } catch (e) {
      return "";
    }
  }

  function isSsPdp() {
    if (/\/product-p\/ss-/.test(path())) return true;
    var code = productCode();
    return /^SS-/.test(code) && (!!global.document.getElementById("v65-product-parent") || /\/product-p\//.test(path()));
  }

  function injectCss() {
    if (global.document.getElementById(STYLE_ID)) return;
    var st = global.document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "body.mc-ss-layout-ready #slideshow-container," +
      "body.mc-ss-layout-ready #if_homepage," +
      "body.mc-ss-layout-ready aside.vol-list-grid{" +
      "display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}" +
      "body.mc-ss-layout-ready #mc-pdp-accordion{" +
      "display:block!important;width:100%!important;max-width:440px!important;margin:18px 0 0!important;clear:both!important}" +
      "body.mc-ss-layout-ready #mc-pdp-accordion .mc-acc-header{" +
      "display:flex!important;align-items:center!important;justify-content:space-between!important;" +
      "width:100%!important;padding:14px 0!important;border:0!important;border-bottom:1px solid #d8d2c8!important;" +
      "background:transparent!important;cursor:pointer!important;font:600 13px/1.2 Inter,Arial,sans-serif!important;" +
      "letter-spacing:.08em!important;text-transform:uppercase!important;color:#222!important;text-align:left!important}" +
      "body.mc-ss-layout-ready #mc-pdp-accordion .mc-acc-panel{" +
      "display:none!important;padding:12px 0 18px!important;font:400 14px/1.55 Inter,Arial,sans-serif!important;color:#444!important}" +
      "body.mc-ss-layout-ready #mc-pdp-accordion .mc-acc-row[data-open='1']>.mc-acc-panel{display:block!important}" +
      "body.mc-ss-layout-ready #mc-pdp-purchase-stack{" +
      "display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;" +
      "justify-content:flex-start!important;gap:16px!important;width:100%!important;max-width:440px!important;" +
      "margin:22px 0 0!important;clear:both!important}" +
      "body.mc-ss-layout-ready #mc-pdp-qty-row{display:flex!important;align-items:center!important;gap:8px!important}" +
      "body.mc-ss-layout-ready #mc-pdp-qty-row input[name^='QTY.']," +
      "body.mc-ss-layout-ready #mc-pdp-qty-row input.v65-productdetail-cartqty{" +
      "width:64px!important;height:48px!important;text-align:center!important;border:1px solid #ccc!important;border-radius:0!important}" +
      "body.mc-ss-layout-ready .mc-atc-button-wrap," +
      "body.mc-ss-layout-ready #mc-pdp-purchase-stack .v65-product-addtocart{display:block!important;margin:0!important}" +
      "body.mc-ss-layout-ready .mc-atc-button-wrap input[name='btnaddtocart']," +
      "body.mc-ss-layout-ready .mc-atc-button-wrap button[name='btnaddtocart']{" +
      "display:inline-block!important;min-width:220px!important;height:48px!important;padding:0 22px!important;" +
      "background:#111!important;color:#fff!important;border:0!important;border-radius:0!important;" +
      "font:600 13px/48px Inter,Arial,sans-serif!important;letter-spacing:.06em!important;text-transform:uppercase!important;cursor:pointer!important}" +
      "body.mc-ss-layout-ready .TabbedPanels," +
      "body.mc-ss-layout-ready .resp-tabs," +
      "body.mc-ss-layout-ready ul.resp-tabs-list," +
      "body.mc-ss-layout-ready .product_tabs{" +
      "display:none!important}" +
      "body.mc-ss-layout-ready img.mc-ss-broken-thumb{display:none!important}";
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function infoColumn() {
    return (
      global.document.querySelector(
        "td.mc-unified-pdp-info, td.mc-pdp-options-td, td.vol-product__top--right"
      ) ||
      (function () {
        var price =
          global.document.querySelector(".colors_pricebox, #mc-pdp-price-stack-host, .product_productprice") ||
          global.document.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
        return price && price.closest ? price.closest("td") : null;
      })()
    );
  }

  function fixBrokenSsPhotos() {
    var code = productCode();
    if (!/^SS-/.test(code)) return;
    var fallback = "/v/vspfiles/photos/" + code + "-1.jpg";
    global.document.querySelectorAll("img").forEach(function (img) {
      try {
        var src = String(img.getAttribute("src") || img.src || "");
        if (!src || src.indexOf("/v/vspfiles/photos/") === -1) return;
        if (!new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(src)) return;
        var isMinus2 = /-\dT?\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(src) && /-2T?\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(src);
        var broken = img.complete && img.naturalWidth === 0;
        if (img.id === "product_photo" && (/\/-2T?\./i.test(src) || broken)) {
          img.setAttribute("src", fallback);
          img.src = fallback;
          img.removeAttribute("srcset");
          var a = img.closest && img.closest("a");
          if (a) a.setAttribute("href", fallback);
          return;
        }
        if (isMinus2 && (broken || /Main product image/i.test(String(img.alt || "")))) {
          /* Alexandria catalogs point "Main product image" at missing -2.jpg */
          img.setAttribute("src", fallback);
          img.src = fallback;
          img.removeAttribute("srcset");
        } else if (broken && /-2\.(?:jpe?g|png|webp)/i.test(src)) {
          img.classList.add("mc-ss-broken-thumb");
          img.setAttribute("src", fallback);
          img.src = fallback;
        }
      } catch (eFix) {}
    });
  }

  function ensureAccordionDelegation(acc) {
    if (!acc || acc.getAttribute("data-mc-ss-acc") === "1") return;
    acc.setAttribute("data-mc-ss-acc", "1");
    acc.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".mc-acc-header") : null;
      if (!btn || !acc.contains(btn)) return;
      var row = btn.closest(".mc-acc-row");
      if (!row) return;
      var open = row.getAttribute("data-open") === "1";
      acc.querySelectorAll(".mc-acc-row").forEach(function (r) {
        r.setAttribute("data-open", "0");
        r.querySelector(".mc-acc-header") &&
          r.querySelector(".mc-acc-header").setAttribute("aria-expanded", "false");
      });
      if (!open) {
        row.setAttribute("data-open", "1");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  }

  function buildRow(id, label, host, open) {
    var row = global.document.createElement("div");
    row.className = "mc-acc-row";
    row.id = "mc-acc-row-" + id;
    row.setAttribute("data-open", open ? "1" : "0");
    var header = global.document.createElement("button");
    header.type = "button";
    header.className = "mc-acc-header";
    header.setAttribute("aria-expanded", open ? "true" : "false");
    header.innerHTML = "<span>" + label + '</span><span aria-hidden="true">+</span>';
    var panel = global.document.createElement("div");
    panel.className = "mc-acc-panel";
    if (host) panel.appendChild(host);
    row.appendChild(header);
    row.appendChild(panel);
    return row;
  }

  function textContentClean(el) {
    return String((el && el.textContent) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureFeaturesHost() {
    var feat = global.document.getElementById("mc-pdp-features");
    if (feat && feat.querySelector("li,p")) return feat;
    if (!feat) {
      feat = global.document.createElement("div");
      feat.id = "mc-pdp-features";
      feat.className = "mc-pdp-features";
    }
    var bullets = [];
    global.document.querySelectorAll("#content_area li, #v65-product-parent li").forEach(function (li) {
      if (li.closest("#mc-pdp-features, #mc-pdp-accordion, #v65-product-related, nav, header")) return;
      var t = textContentClean(li);
      if (t && t.length > 8 && t.length < 180 && bullets.indexOf(t) === -1) bullets.push(t);
    });
    if (!bullets.length) {
      bullets = [
        "Premium construction and finish",
        "Designed for everyday living rooms",
        "See Product Details for full specifications",
      ];
    }
    feat.innerHTML =
      '<ul class="mc-pdp-features__list">' +
      bullets
        .slice(0, 8)
        .map(function (t) {
          return "<li>" + t.replace(/</g, "&lt;") + "</li>";
        })
        .join("") +
      "</ul>";
    return feat;
  }

  function ensureDetailsHost() {
    var host = global.document.getElementById("mc-pdp-description-below-features");
    if (!host) {
      host = global.document.createElement("div");
      host.id = "mc-pdp-description-below-features";
      host.className = "mc-pdp-description-below-features";
    }
    if (textContentClean(host).length > 40) return host;
    var src =
      global.document.querySelector("#ProductDetail_ProductDetails_div2 span[itemprop='description']") ||
      global.document.querySelector("#ProductDetail_ProductDetails_div2 .colors_descriptionbox") ||
      global.document.getElementById("ProductDetail_ProductDetails_div2") ||
      global.document.getElementById("ProductDetail_ProductDetails_div") ||
      global.document.querySelector("span[itemprop='description']");
    if (src && !host.contains(src) && textContentClean(src).length > 20) {
      try {
        host.appendChild(src.cloneNode(true));
      } catch (eClone) {
        host.textContent = textContentClean(src);
      }
    }
    if (textContentClean(host).length < 20) {
      host.innerHTML = "<p>See product specifications and care details on this page.</p>";
    }
    return host;
  }

  function ensureAccordion(col) {
    var acc = global.document.getElementById("mc-pdp-accordion");
    if (!acc) {
      acc = global.document.createElement("div");
      acc.id = "mc-pdp-accordion";
      acc.className = "mc-pdp-accordion mc-ss-pdp-accordion";
    }
    if (!acc.querySelector(".mc-acc-row")) {
      var featHost = global.document.createElement("div");
      featHost.id = "mc-acc-ss-features-host";
      featHost.appendChild(ensureFeaturesHost());
      var detailsHost = global.document.createElement("div");
      detailsHost.id = "mc-acc-ss-details-host";
      detailsHost.appendChild(ensureDetailsHost());
      acc.innerHTML = "";
      acc.appendChild(buildRow("ss-features", "FEATURES", featHost, true));
      acc.appendChild(buildRow("ss-product-details", "PRODUCT DETAILS", detailsHost, false));
    }
    ensureAccordionDelegation(acc);
    if (!col.contains(acc)) {
      var price =
        global.document.getElementById("mc-pdp-price-stack-host") ||
        col.querySelector(".colors_pricebox, .mc-pdp-price-stack, [itemprop='offers']");
      if (price && col.contains(price) && price.nextSibling) {
        col.insertBefore(acc, price.nextSibling);
      } else {
        col.appendChild(acc);
      }
    }
    return acc;
  }

  function wrapAtc(btn) {
    var wrap = btn.closest(".mc-atc-button-wrap");
    if (wrap) return wrap;
    wrap = global.document.createElement("div");
    wrap.className = "mc-atc-button-wrap";
    if (btn.parentNode) btn.parentNode.insertBefore(wrap, btn);
    wrap.appendChild(btn);
    return wrap;
  }

  function ensurePurchaseStack(col, acc) {
    var btn = global.document.querySelector(
      '#v65-product-parent input[name="btnaddtocart"], #v65-product-parent button[name="btnaddtocart"], input[name="btnaddtocart"], button[name="btnaddtocart"]'
    );
    if (!btn) return null;
    var qty = global.document.querySelector(
      '#v65-product-parent input[name^="QTY."], #v65-product-parent input.v65-productdetail-cartqty, input[name^="QTY."], input.v65-productdetail-cartqty'
    );
    var stack = global.document.getElementById("mc-pdp-purchase-stack");
    if (!stack) {
      stack = global.document.createElement("div");
      stack.id = "mc-pdp-purchase-stack";
    }
    stack.className = "mc-pdp-purchase-controls mc-pdp-cart-row mc-ss-purchase-stack";
    var qtyRow = global.document.getElementById("mc-pdp-qty-row");
    if (!qtyRow) {
      qtyRow = global.document.createElement("div");
      qtyRow.id = "mc-pdp-qty-row";
      qtyRow.className = "mc-pdp-qty-row";
    }
    if (qty && !qtyRow.contains(qty)) qtyRow.appendChild(qty);
    var wrap = wrapAtc(btn);
    if (!stack.contains(qtyRow)) stack.appendChild(qtyRow);
    if (!stack.contains(wrap)) stack.appendChild(wrap);
    try {
      if (acc && acc.parentNode === col) {
        if (acc.nextSibling !== stack) {
          if (acc.nextSibling) col.insertBefore(stack, acc.nextSibling);
          else col.appendChild(stack);
        }
      } else if (!col.contains(stack)) {
        col.appendChild(stack);
      }
    } catch (ePlace) {}
    return stack;
  }

  function hideNativeTabs(col) {
    if (!col) return;
    col.querySelectorAll(".TabbedPanels, .resp-tabs, ul.resp-tabs-list").forEach(function (el) {
      try {
        el.style.setProperty("display", "none", "important");
      } catch (eHide) {}
    });
  }

  function run() {
    if (!isSsPdp()) return;
    RUNS += 1;
    injectCss();
    try {
      if (global.document.body) {
        global.document.body.classList.add(
          "mc-product-page",
          "mc-steve-silver-altview-pdp",
          "mc-pdp-unified-ready",
          "mc-ss-layout-ready",
          "mc-pdp-accordion-pdp"
        );
      }
    } catch (eBody) {}
    fixBrokenSsPhotos();
    var col = infoColumn();
    if (!col) {
      if (RUNS < MAX_RUNS) global.setTimeout(run, 250);
      return;
    }
    var acc = ensureAccordion(col);
    ensurePurchaseStack(col, acc);
    hideNativeTabs(col);
    fixBrokenSsPhotos();
    global.__MC_SS_PDP_LAYOUT_OK__ = true;
    if (RUNS < MAX_RUNS) global.setTimeout(run, RUNS < 8 ? 300 : 800);
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  [0, 100, 400, 1000, 2000, 4000, 7000].forEach(function (ms) {
    global.setTimeout(run, ms);
  });
})(window);
