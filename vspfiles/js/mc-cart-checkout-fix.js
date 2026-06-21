(function () {
  "use strict";
  var g = window;
  var d = document;

  function isCartPage() {
    var p = (g.location.pathname || "").toLowerCase();
    return /shoppingcart|shopcart\.asp|\/cart\b/i.test(p);
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
    var rows = root.querySelectorAll("table tr");
    var i, tr, tds;
    for (i = 0; i < rows.length; i++) {
      tr = rows[i];
      if (tr.querySelector("th")) continue;
      tds = tr.querySelectorAll("td");
      if (tds.length >= 3 && tr.querySelector("img")) return true;
    }
    var text = (root.textContent || "").replace(/\s+/g, " ").toLowerCase();
    return /\bsubtotal\b/.test(text) && /\$\d/.test(text);
  }

  function goCheckout() {
    try {
      if (typeof g.goToCheckout === "function") {
        g.goToCheckout();
        return;
      }
    } catch (e) {}
    g.location.href =
      "/checkout/?text=656565&bg=FFFFFF&font=Lato%2C+ui%2Dsans%2Dserif%2C+system%2Dui%2C+%2Dapple%2Dsystem%2C+BlinkMacSystemFont%2C+Segoe+UI%2C+Roboto%2C+Helvetica+Neue%2C+Arial";
  }

  function wireCheckoutButtons(root) {
    if (!root || !root.querySelectorAll) return;
    root
      .querySelectorAll('input[type="image"][name*="checkout" i], input[type="image"][name*="Checkout"]')
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
        if (sub && /checkout/i.test(sub.name || "")) {
          e.preventDefault();
          goCheckout();
        }
      });
    }
  }

  function elementVisible(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width > 40 && rect.height > 16) return true;
    var style = g.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity || "1") < 0.1) return false;
    return el.offsetWidth > 40 || el.offsetHeight > 16;
  }

  function nativeActionsUsable(root) {
    var continueBtn = root.querySelector('input[type="image"][name="btnContinue"]');
    var checkoutBtn = root.querySelector('input[type="image"][name*="checkout" i]');
    var hasItems = cartHasLineItems(root);
    if (!elementVisible(continueBtn)) return false;
    if (hasItems && checkoutBtn && !elementVisible(checkoutBtn)) return false;
    if (hasItems && !checkoutBtn) return false;
    return true;
  }

  function ensureFallbackBar(root) {
    if (!root || root.querySelector("#mc-cart-actions-bar")) return;
    if (nativeActionsUsable(root)) return;

    var hasItems = cartHasLineItems(root);
    var bar = d.createElement("div");
    bar.id = "mc-cart-actions-bar";
    bar.className = "mc-cart-actions-bar";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Cart actions");

    var continueBtn = d.createElement("a");
    continueBtn.className = "mc-cart-actions-bar__btn mc-cart-actions-bar__btn--secondary";
    continueBtn.href = "/default.asp";
    continueBtn.textContent = "Continue Shopping";
    bar.appendChild(continueBtn);

    if (hasItems) {
      var checkoutBtn = d.createElement("button");
      checkoutBtn.type = "button";
      checkoutBtn.className = "mc-cart-actions-bar__btn mc-cart-actions-bar__btn--primary";
      checkoutBtn.textContent = "Proceed to Checkout";
      checkoutBtn.addEventListener("click", goCheckout);
      bar.appendChild(checkoutBtn);
    }

    root.appendChild(bar);
  }

  function run() {
    if (!isCartPage()) return;
    var root = d.getElementById("content_area");
    if (!root) return;
    fixImageButtonPaths(root);
    wireCheckoutButtons(root);
    ensureFallbackBar(root);
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
  g.addEventListener("load", run);
  setTimeout(run, 800);
  setTimeout(run, 2500);
})();
