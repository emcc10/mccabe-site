/**
 * Main-site checkout promo box.
 * Loaded from the cache-busted auth CTA stub because recovery JS is pinned
 * behind Cloudflare (?v=1 + SRI) and Volusion HTML tags are not FTP-editable.
 */
(function (g, d) {
  "use strict";
  if (/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(String(g.location.search || ""))) return;
  if (!/\/one-page-checkout\.asp/i.test(String(g.location.pathname || ""))) return;
  if (g.__MC_CHECKOUT_MAIN_PROMO__) return;
  g.__MC_CHECKOUT_MAIN_PROMO__ = true;

  function ensureStyles() {
    if (d.getElementById("mc-checkout-v5-coupon-style")) return;
    var style = d.createElement("style");
    style.id = "mc-checkout-v5-coupon-style";
    style.textContent =
      "#mc-checkout-v5-coupon{display:block!important;margin:12px 16px 16px!important;padding:12px!important;" +
      "border:1px solid #e1dcd6!important;background:#fff!important;box-sizing:border-box!important;}" +
      "#mc-checkout-v5-coupon__label{display:block!important;margin:0 0 8px!important;color:#222!important;" +
      "font:600 14px/1.3 Arial,Helvetica,sans-serif!important;}" +
      "#mc-checkout-v5-coupon__row{display:flex!important;gap:8px!important;align-items:stretch!important;}" +
      "#mc-checkout-v5-coupon__input{flex:1 1 auto!important;min-width:0!important;min-height:42px!important;" +
      "padding:8px 10px!important;border:1px solid #cec8c1!important;box-sizing:border-box!important;}" +
      "#mc-checkout-v5-coupon__apply{flex:0 0 auto!important;min-height:42px!important;padding:8px 14px!important;" +
      "border:1px solid #111!important;background:#111!important;color:#fff!important;" +
      "font:700 12px/1 Arial,Helvetica,sans-serif!important;letter-spacing:.06em!important;" +
      "text-transform:uppercase!important;cursor:pointer!important;}";
    (d.head || d.documentElement).appendChild(style);
  }

  function ensurePromoBox() {
    if (d.getElementById("mc-checkout-v5-coupon") || d.getElementById("mc-fb-coupon")) return;
    var order = d.getElementById("mc-checkout-v5-order");
    if (!order) return;
    ensureStyles();
    var box = d.createElement("div");
    box.id = "mc-checkout-v5-coupon";
    box.innerHTML =
      '<label id="mc-checkout-v5-coupon__label" for="mc-checkout-v5-coupon__input">Promo code</label>' +
      '<div id="mc-checkout-v5-coupon__row">' +
      '<input id="mc-checkout-v5-coupon__input" type="text" autocomplete="off" spellcheck="false" placeholder="Enter code">' +
      '<button id="mc-checkout-v5-coupon__apply" type="button">Apply</button>' +
      "</div>";
    var totals = d.getElementById("v65-onepage-ShippingCostDetails");
    if (totals && totals.parentNode) totals.parentNode.insertBefore(box, totals);
    else order.appendChild(box);

    var input = d.getElementById("mc-checkout-v5-coupon__input");
    var apply = d.getElementById("mc-checkout-v5-coupon__apply");
    var native = d.querySelector('input[name="CouponCode"]');
    var nativeBtn = d.querySelector(
      'input[name="btnCouponCode"], #btn_apply, input[value="Apply"][name*="Coupon"]'
    );
    if (native && native.value && input) input.value = native.value;

    function run() {
      var value = String((input && input.value) || "").trim();
      if (!value) return;
      if (native) {
        native.value = value;
        native.dispatchEvent(new Event("input", { bubbles: true }));
        native.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (nativeBtn) {
        nativeBtn.click();
        return;
      }
      if (native && native.form) native.form.submit();
    }
    if (apply) apply.addEventListener("click", run);
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          run();
        }
      });
    }
  }

  function start() {
    ensurePromoBox();
    var attempts = 0;
    var timer = g.setInterval(function () {
      attempts += 1;
      ensurePromoBox();
      if (d.getElementById("mc-checkout-v5-coupon") || attempts >= 50) g.clearInterval(timer);
    }, 200);
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
  else start();
  g.addEventListener("load", start);
})(window, document);
