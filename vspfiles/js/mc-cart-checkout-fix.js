(function (g, d) {
  "use strict";

  g.__MC_CART_CHECKOUT_FIX__ = "20260620cart3";

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

  function run() {
    if (!isCartPage()) return;
    ensureCommerceSurface();
    var root = d.getElementById("content_area") || d.body;
    fixImageButtonPaths(root);
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
