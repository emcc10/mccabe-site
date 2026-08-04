(function (g, d) {
  "use strict";

  g.__MC_CART_CHECKOUT_FIX__ = "20260804promo1";

  /* MC_SITE_PROMO_BANNER_20260804: restore #mcPromoBanner when Volusion template
     bake dropped the markup. Banner-only — does not touch nav or homepage cats.
     Skip Facebook checkout (owns its own offer strip). */
  function ensureSitePromoBanner() {
    try {
      var search = String((g.location && g.location.search) || "");
      if (/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(search)) return;
      if (!d || !d.body) return;
      if (d.getElementById("mcPromoBanner") || d.querySelector(".mc-promo-banner")) return;
      var banner = d.createElement("div");
      banner.id = "mcPromoBanner";
      banner.className = "mc-promo-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-label", "Current offers");
      banner.innerHTML =
        '<p class="mc-promo-banner__line mc-promo-banner__line--offers">' +
        'Save <span class="mc-promo-banner__num">20%</span> on Select Mahjong Sets with code <span class="mc-promo-banner__num">MAHJ20</span>' +
        '<span class="mc-promo-banner__pipe" aria-hidden="true">|</span>' +
        'Save <span class="mc-promo-banner__num">10%</span> on All Hybrid Mattresses and Bean Bags with code <span class="mc-promo-banner__num">CORD10</span>' +
        '<span class="mc-promo-banner__pipe" aria-hidden="true">|</span>' +
        'Save <span class="mc-promo-banner__num">10%</span> on Saranoni Purchases over <span class="mc-promo-banner__num">$99</span> with code <span class="mc-promo-banner__num">SUMMER</span>' +
        "</p>" +
        '<p class="mc-promo-banner__line mc-promo-banner__line--shipping">' +
        "Free Shipping on all Bean Bags &amp; Mattresses and Saranoni Purchases of " +
        '<span class="mc-promo-banner__num">$99+</span>' +
        "</p>";
      d.body.insertBefore(banner, d.body.firstChild);
    } catch (eBanner) {}
  }
  try {
    if (d.body) ensureSitePromoBanner();
    else d.addEventListener("DOMContentLoaded", ensureSitePromoBanner);
    [0, 200, 800, 2000].forEach(function (ms) {
      g.setTimeout(ensureSitePromoBanner, ms);
    });
  } catch (eBannerBoot) {}

  function isCartPage() {
    var p = (g.location.pathname || "").toLowerCase();
    var h = (g.location.href || "").toLowerCase();
    return (
      /shoppingcart|shopcart\.asp|\/cart\b/i.test(p) ||
      /shoppingcart|shopcart\.asp/i.test(h)
    );
  }

  function ensureCommerceSurface() {
    try {
      d.documentElement.classList.add("mc-commerce-surface");
    } catch (e) {}
  }

  function normalizeImageSrc(el) {
    if (!el || !el.getAttribute) return;
    var src = el.getAttribute("src") || "";
    if (!src || /^https?:\/\//i.test(src) || src.charAt(0) === "/") return;
    if (/^v\//i.test(src)) {
      el.setAttribute("src", "/" + src.replace(/^\/+/, ""));
    }
  }

  function fixImageButtonPaths(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('input[type="image"]').forEach(normalizeImageSrc);
  }

  function cartHasLineItems(root) {
    if (!root) return false;
    var text = (root.textContent || "").replace(/\s+/g, " ");
    if (/your cart is empty|cart is currently empty|no items in your cart/i.test(text)) {
      return false;
    }

    if (root.querySelector(".v65-your-cart-title, h2.v65-your-cart-title")) {
      if (/\bitem description\b/i.test(text)) {
        if (
          root.querySelector(
            'input[name^="QTY"], input[name*="quantity" i], .vol-qty-input, input[name*="txtQuantity" i]'
          )
        ) {
          return true;
        }
        if (/\$\d+\.\d{2}/.test(text) && /\btotal\b/i.test(text)) return true;
      }
    }

    var rows = root.querySelectorAll("table tr");
    var i, tr, tds;
    for (i = 0; i < rows.length; i++) {
      tr = rows[i];
      if (tr.querySelector("th")) continue;
      tds = tr.querySelectorAll("td");
      if (tds.length >= 3 && (tr.querySelector("img") || tr.querySelector('a[href*="ProductDetails" i]'))) {
        return true;
      }
    }

    if (/\bsubtotal\b/i.test(text) && /\$\d/.test(text)) return true;
    if (/\bgrand total\b/i.test(text) && /\$\d/.test(text)) return true;
    if (/\btotal\b/i.test(text) && /\$\d/.test(text) && /\beach\b/i.test(text) && /\bqty\b/i.test(text)) {
      return true;
    }
    return false;
  }

  function goCheckout() {
    g.location.href = "/one-page-checkout.asp";
  }

  function elementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width > 36 && rect.height > 14) return true;
    var style = g.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity || "1") < 0.1) return false;
    return el.offsetWidth > 36 || el.offsetHeight > 14;
  }

  var checkoutSelectors = [
    'input[type="image"][name*="checkout" i]',
    'input[type="submit"][name*="checkout" i]',
    'button[name*="checkout" i]',
    'button[id*="checkout" i]',
    'a[href*="one-page-checkout"]',
    'a[href*="/checkout/"]',
    "#table_checkout_cart0 input[type='image']",
    "#table_checkout_cart0 button",
    "#table_checkout_cart0 a",
    ".v65-cart-checkout",
    ".push-cart__checkout",
    'input[value*="Checkout" i]',
    'button[value*="Checkout" i]',
  ];

  function findVisibleCheckoutCta(root) {
    if (!root || !root.querySelector) return null;
    var i, nodes, j, el;
    for (i = 0; i < checkoutSelectors.length; i++) {
      nodes = root.querySelectorAll(checkoutSelectors[i]);
      for (j = 0; j < nodes.length; j++) {
        el = nodes[j];
        if (elementVisible(el)) return el;
      }
    }
    return null;
  }

  function wireCheckoutButtons(root) {
    if (!root || !root.querySelectorAll) return;
    root
      .querySelectorAll('input[type="image"][name*="checkout" i], input[type="submit"][name*="checkout" i]')
      .forEach(function (btn) {
        btn.addEventListener(
          "click",
          function (e) {
            e.preventDefault();
            e.stopPropagation();
            goCheckout();
            return false;
          },
          true
        );
      });

    var form =
      d.Proceed_To_Checkout_Form ||
      root.querySelector('form[name="Proceed_To_Checkout_Form"], form[action*="checkout" i]');
    if (form) {
      form.addEventListener("submit", function (e) {
        var sub = e.submitter;
        if (sub && /checkout/i.test(sub.name || sub.value || "")) {
          e.preventDefault();
          goCheckout();
        }
      });
    }
  }

  function rowLooksLikeCartTotal(tr) {
    if (!tr || tr.querySelector("th")) return false;
    var txt = (tr.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!/\btotal\b/.test(txt) || !/\$\d/.test(txt)) return false;
    if (/\bsubtotal\b/.test(txt) || /\bmerchandise total\b/.test(txt)) return false;
    if (/\bitem description\b/.test(txt) || /\beach\b/.test(txt)) return false;
    if (tr.querySelector('input[name^="QTY"], input[name*="quantity" i]')) return false;
    return true;
  }

  function findCartTotalRow(root) {
    var rows = root.querySelectorAll("tr");
    var i, tr, best = null;
    for (i = rows.length - 1; i >= 0; i--) {
      tr = rows[i];
      if (rowLooksLikeCartTotal(tr)) {
        best = tr;
        break;
      }
    }
    return best;
  }

  function insertNodeAfter(ref, node) {
    if (!ref || !ref.parentNode || !node) return false;
    if (ref.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling);
    else ref.parentNode.appendChild(node);
    return true;
  }

  function placeActionsBar(root, bar) {
    var checkoutTable = root.querySelector("#table_checkout_cart0");
    if (checkoutTable && checkoutTable.parentNode) {
      checkoutTable.parentNode.insertBefore(bar, checkoutTable);
      bar.classList.add("mc-cart-actions-bar--anchored");
      return true;
    }

    var totalRow = findCartTotalRow(root);
    if (totalRow && totalRow.parentNode) {
      var hostRow = d.createElement("tr");
      hostRow.className = "mc-cart-actions-row";
      var cell = d.createElement("td");
      cell.className = "mc-cart-actions-cell";
      cell.colSpan = 99;
      cell.appendChild(bar);
      hostRow.appendChild(cell);
      insertNodeAfter(totalRow, hostRow);
      bar.classList.add("mc-cart-actions-bar--anchored");
      return true;
    }

    var shippingAnchor = null;
    root.querySelectorAll("td, th, strong, b, span, div").forEach(function (el) {
      if (shippingAnchor) return;
      if (/calculate shipping/i.test(el.textContent || "")) {
        shippingAnchor = el.closest("table") || el.parentElement;
      }
    });
    if (shippingAnchor && shippingAnchor.parentNode) {
      insertNodeAfter(shippingAnchor, bar);
      bar.classList.add("mc-cart-actions-bar--anchored");
      return true;
    }

    bar.classList.add("mc-cart-actions-bar--fallback");
    root.appendChild(bar);
    return true;
  }

  function buildActionsBar(hasItems) {
    var bar = d.createElement("div");
    bar.id = "mc-cart-actions-bar";
    bar.className = "mc-cart-actions-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Cart actions");

    if (hasItems) {
      var checkoutBtn = d.createElement("button");
      checkoutBtn.type = "button";
      checkoutBtn.className = "mc-cart-actions-bar__btn mc-cart-actions-bar__btn--primary";
      checkoutBtn.textContent = "Proceed to Checkout";
      checkoutBtn.addEventListener("click", goCheckout);
      bar.appendChild(checkoutBtn);
    }

    var continueBtn = d.createElement("a");
    continueBtn.className = "mc-cart-actions-bar__btn mc-cart-actions-bar__btn--secondary";
    continueBtn.href = "/default.asp";
    continueBtn.textContent = "Continue Shopping";
    bar.appendChild(continueBtn);

    return bar;
  }

  function ensureFallbackBar(root) {
    if (!root) return;
    var hasItems = cartHasLineItems(root);
    var visibleCheckout = findVisibleCheckoutCta(root);
    if (hasItems && visibleCheckout) {
      var existing = d.getElementById("mc-cart-actions-bar");
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      d.body.classList.remove("mc-cart-actions-visible");
      return;
    }

    var bar = d.getElementById("mc-cart-actions-bar");
    if (!hasItems && !root.querySelector('input[name="btnContinue"]')) {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      d.body.classList.remove("mc-cart-actions-visible");
      return;
    }

    if (!bar) {
      bar = buildActionsBar(hasItems);
      placeActionsBar(root, bar);
    } else if (!bar.classList.contains("mc-cart-actions-bar--anchored")) {
      if (bar.parentNode) bar.parentNode.removeChild(bar);
      var oldHost = root.querySelector("tr.mc-cart-actions-row");
      if (oldHost && oldHost.parentNode) oldHost.parentNode.removeChild(oldHost);
      placeActionsBar(root, bar);
    }

    d.body.classList.remove("mc-cart-actions-visible");
  }


  /* ------------------------------------------------------------------
     20260727 - mobile cart row layout + missing thumbnails

     Measured on a 390px viewport: #v65-cart-table renders 300px wide, but its
     legacy columns want 100 (image) + 119 (name) + 90 (each) + 74 (qty) = 383px.
     An auto-layout table cannot go below its min-content width, so every column
     is crushed - "Highland Park Chest, Waxed Driftwood" wrapped onto five lines
     next to a 92x92 empty grey square.

     The grey square is a second bug: the cart thumbnail is
     .../templates/266/images/NoPhoto-0.gif with a natural size of 1x1, stretched
     to 92x92.  The real photo exists at /v/vspfiles/photos/<CODE>-1T.jpg - the
     cart just is not resolving it.
     ------------------------------------------------------------------ */

  var CART_STYLE_ID = "mc-cart-mobile-stack-20260727";

  function injectCartStyles() {
    if (d.getElementById(CART_STYLE_ID)) return;
    var st = d.createElement("style");
    st.id = CART_STYLE_ID;
    st.textContent = [
      "@media (max-width:900px){",
      /* Take the item rows out of table layout so nothing has a width floor. */
      "  #v65-cart-table .v65-cart-details-row,",
      "  #v65-cart-table .v65-cart-details-row > td {",
      "    display:block !important; width:100% !important; max-width:100% !important;",
      "    box-sizing:border-box !important; text-align:left !important;",
      "  }",
      /* Cells Volusion uses purely as spacers collapse instead of eating width. */
      "  #v65-cart-table .v65-cart-details-row > td.v65-cart-details-cell,",
      "  #v65-cart-table .v65-cart-details-row > td.colors_lines,",
      "  #v65-cart-table .v65-cart-details-row > td.v65-cart-details-blank {",
      "    display:none !important;",
      "  }",
      /* Thumbnail sits above the name at a sane size. */
      "  #v65-cart-table td.v65-cart-detail-productimage {",
      "    width:100% !important; padding:0 0 10px !important;",
      "  }",
      "  #v65-cart-table td.v65-cart-detail-productimage img {",
      "    width:104px !important; height:auto !important; max-width:104px !important;",
      "  }",
      /* A NoPhoto placeholder is a 1x1 gif - never blow it up into a grey block. */
      "  #v65-cart-table img[src*='NoPhoto' i]:not([data-mc-thumb-ok]) {",
      "    display:none !important;",
      "  }",
      "  #v65-cart-table .v65-cart-details-row .v65-cart-details-text {",
      "    padding:0 0 6px !important;",
      "  }",
      "  #v65-cart-table .v65-cart-details-row a { overflow-wrap:anywhere !important; }",
      "}"
    ].join("\n");
    (d.head || d.documentElement).appendChild(st);
  }

  function productCodeFromRow(row) {
    if (!row || !row.querySelector) return "";
    var link = row.querySelector('a[href*="ProductCode=" i], a[href*="/product-p/" i]');
    if (!link) return "";
    var href = link.getAttribute("href") || "";
    var m = href.match(/[?&]ProductCode=([^&#]+)/i) || href.match(/\/product-p\/([^/?#]+)\.html?/i);
    if (!m) return "";
    var code;
    try { code = decodeURIComponent(m[1]); } catch (e) { code = m[1]; }
    return String(code).replace(/%2d/gi, "-").replace(/\s+/g, "").toUpperCase();
  }

  /* Try the thumbnail, then the full photo, then give up quietly rather than
     leaving a broken-image icon behind.  Driven off the <img> element's own
     error event so there is no separate probe to go wrong. */
  function restoreCartThumbnail(img, code) {
    if (!img || !code) return;
    if (img.getAttribute("data-mc-thumb-code") === code) return;
    img.setAttribute("data-mc-thumb-code", code);

    var candidates = [
      "/v/vspfiles/photos/" + code + "-1T.jpg",
      "/v/vspfiles/photos/" + code + "-1.jpg",
      "/v/vspfiles/photos/" + code + "-2T.jpg",
      "/v/vspfiles/photos/" + code + "-2.jpg"
    ];
    var i = 0;

    function next() {
      if (i >= candidates.length) {
        img.removeAttribute("data-mc-thumb-ok");
        img.style.setProperty("display", "none", "important");
        return;
      }
      img.setAttribute("src", candidates[i++]);
    }

    img.addEventListener("error", next);
    img.addEventListener("load", function () {
      if (img.naturalWidth > 2 && img.naturalHeight > 2) {
        img.setAttribute("data-mc-thumb-ok", "1");
        img.style.removeProperty("display");
      }
    });
    img.removeAttribute("width");
    img.removeAttribute("height");
    next();
  }

  function fixCartThumbnails(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("td.v65-cart-detail-productimage").forEach(function (cell) {
      var img = cell.querySelector("img");
      if (!img) return;
      var src = img.getAttribute("src") || "";
      /* Only step in when Volusion gave up - never override a real photo. */
      if (!/NoPhoto/i.test(src) && img.naturalWidth > 2) return;
      var row = cell.closest ? cell.closest("tr") : null;
      var code = productCodeFromRow(row);
      if (!code) {
        var sibling = row && row.nextElementSibling;
        code = productCodeFromRow(sibling);
      }
      if (code) restoreCartThumbnail(img, code);
    });
  }

  function run() {
    if (!isCartPage()) return;
    ensureCommerceSurface();
    injectCartStyles();
    var root = d.getElementById("content_area") || d.body;
    fixImageButtonPaths(root);
    fixCartThumbnails(root);
    wireCheckoutButtons(root);
    ensureFallbackBar(root);
  }

  function installObserver() {
    if (!isCartPage() || typeof MutationObserver === "undefined") return;
    var root = d.getElementById("content_area");
    if (!root || root.dataset.mcCartCheckoutObserver) return;
    root.dataset.mcCartCheckoutObserver = "1";
    var deb = null;
    var mo = new MutationObserver(function () {
      if (deb) g.clearTimeout(deb);
      deb = g.setTimeout(run, 200);
    });
    try {
      mo.observe(root, { childList: true, subtree: true });
    } catch (eMo) {}
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  g.addEventListener("load", run);
  [400, 800, 1500, 2500, 5000, 8000].forEach(function (ms) {
    g.setTimeout(run, ms);
  });
  g.setTimeout(installObserver, 600);
  g.setTimeout(installObserver, 2000);
})(window, document);
