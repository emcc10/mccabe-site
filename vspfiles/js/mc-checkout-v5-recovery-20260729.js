(function() {
  if (!document.getElementById("mc-checkout-v5-css")) {
    var s = document.createElement("style");
    s.id = "mc-checkout-v5-css";
    s.textContent = '\n      html, body, body #content_area { background:#fff !important; }\n\n      body.mc-checkout-v5-active #content_area {\n        width:100% !important;\n        max-width:1240px !important;\n        margin:0 auto !important;\n        padding:28px 24px 60px !important;\n        box-sizing:border-box !important;\n      }\n\n      body.mc-checkout-v5-active #v65-onepage-CheckoutForm {\n        display:block !important;\n        width:100% !important;\n        max-width:1180px !important;\n        margin:0 auto !important;\n      }\n\n      #mc-checkout-v5 {\n        display:grid !important;\n        grid-template-columns:minmax(0, 1fr) minmax(0, 1fr) !important;\n        gap:24px !important;\n        align-items:start !important;\n        width:100% !important;\n        max-width:1120px !important;\n        margin:8px auto 0 !important;\n      }\n\n      #mc-checkout-v5-left {\n        display:flex !important;\n        flex-direction:column !important;\n        gap:16px !important;\n        min-width:0 !important;\n      }\n\n      #mc-checkout-v5-right {\n        position:relative !important;\n        min-width:0 !important;\n        width:100% !important;\n        max-width:none !important;\n        overflow:hidden !important;\n        contain:layout paint !important;\n      }\n\n      #mc-checkout-v5-right-inner {\n        position:static !important;\n        top:auto !important;\n        width:100% !important;\n        max-width:100% !important;\n      }\n\n      .mc-checkout-v5-card {\n        width:100% !important;\n        max-width:100% !important;\n        margin:0 auto !important;\n        padding:22px !important;\n        border:1px solid #e1dcd6 !important;\n        background:#fff !important;\n        box-sizing:border-box !important;\n        overflow:hidden !important;\n      }\n\n      .mc-checkout-v5-title {\n        margin:0 0 16px !important;\n        color:#222 !important;\n        font:600 19px/1.25 inherit !important;\n      }\n\n      .mc-checkout-v5-card table {\n        width:100% !important;\n        max-width:100% !important;\n        margin:0 !important;\n        background:#fff !important;\n      }\n\n      .mc-checkout-v5-card td {\n        box-sizing:border-box !important;\n        white-space:normal !important;\n      }\n\n      #mc-checkout-v5-shipping table,\n      #mc-checkout-v5-billing table,\n      #mc-checkout-v5-payment table {\n        table-layout:auto !important;\n      }\n\n      #mc-checkout-v5-shipping td,\n      #mc-checkout-v5-billing td,\n      #mc-checkout-v5-payment td {\n        width:auto !important;\n        max-width:none !important;\n      }\n\n      #mc-checkout-v5-shipping td[colspan],\n      #mc-checkout-v5-billing td[colspan],\n      #mc-checkout-v5-payment td[colspan] {\n        width:100% !important;\n      }\n\n      #mc-checkout-v5-shipping p,\n      #mc-checkout-v5-billing p,\n      #mc-checkout-v5-payment p,\n      #mc-checkout-v5-shipping .mc-checkout-section-copy,\n      #mc-checkout-v5-billing .mc-checkout-section-copy,\n      #mc-checkout-v5-payment .mc-checkout-section-copy {\n        width:100% !important;\n        max-width:none !important;\n        margin-left:0 !important;\n        margin-right:0 !important;\n      }\n\n      #mc-checkout-v5-order,\n      #mc-checkout-v5-order table,\n      #mc-checkout-v5-order tbody,\n      #mc-checkout-v5-order tr,\n      #mc-checkout-v5-order td {\n        width:100% !important;\n        max-width:100% !important;\n        box-sizing:border-box !important;\n      }\n\n      #mc-checkout-v5-order {\n        position:relative !important;\n        display:block !important;\n        width:100% !important;\n        min-width:0 !important;\n        max-width:100% !important;\n        overflow:hidden !important;\n        contain:layout paint !important;\n      }\n\n      #mc-checkout-v5-order > table,\n      #mc-checkout-v5-order table,\n      #mc-checkout-v5-order tbody,\n      #mc-checkout-v5-order tr,\n      #mc-checkout-v5-order td {\n        min-width:0 !important;\n        max-width:100% !important;\n      }\n\n      #mc-checkout-v5-order table,\n      #table_checkout_cart0 {\n        position:static !important;\n        left:auto !important;\n        right:auto !important;\n        top:auto !important;\n        bottom:auto !important;\n        z-index:auto !important;\n        transform:none !important;\n        display:table !important;\n        width:100% !important;\n        max-width:100% !important;\n        min-width:0 !important;\n        table-layout:fixed !important;\n      }\n\n      #mc-checkout-v5-order td {\n        overflow:visible !important;\n        text-overflow:clip !important;\n        white-space:normal !important;\n        overflow-wrap:anywhere !important;\n        word-break:normal !important;\n        line-height:1.45 !important;\n        vertical-align:top !important;\n      }\n\n      #mc-checkout-v5-order,\n      #mc-checkout-v5-order table,\n      #mc-checkout-v5-order tbody,\n      #mc-checkout-v5-order tr,\n      #mc-checkout-v5-order td,\n      #mc-checkout-v5-order th,\n      #mc-checkout-v5-order div,\n      #mc-checkout-v5-order span,\n      #mc-checkout-v5-order p {\n        background:#fff !important;\n        background-image:none !important;\n        color:#222 !important;\n      }\n\n      #mc-checkout-v5-order td[bgcolor],\n      #mc-checkout-v5-order th[bgcolor],\n      #mc-checkout-v5-order [style*="background"],\n      #mc-checkout-v5-order [style*="background-color"] {\n        background:#fff !important;\n        background-color:#fff !important;\n        background-image:none !important;\n        color:#222 !important;\n      }\n\n      #mc-checkout-v5-order a {\n        color:#222 !important;\n        white-space:normal !important;\n        line-height:1.45 !important;\n      }\n\n      #mc-checkout-v5-order strong,\n      #mc-checkout-v5-order b,\n      #mc-checkout-v5-order .price,\n      #mc-checkout-v5-order [class*="price"],\n      #mc-checkout-v5-order [id*="price" i],\n      #mc-checkout-v5-order [class*="total"],\n      #mc-checkout-v5-order [id*="total" i] {\n        font-size:14px !important;\n        line-height:1.4 !important;\n      }\n\n      #mc-checkout-v5-order td,\n      #mc-checkout-v5-order th,\n      #mc-checkout-v5-order span,\n      #mc-checkout-v5-order div,\n      #mc-checkout-v5-order p,\n      #mc-checkout-v5-order a {\n        font-size:14px !important;\n      }\n\n      #mc-checkout-v5-order img {\n        max-width:76px !important;\n        height:auto !important;\n      }\n\n      #mc-checkout-v5-order #placeOrderButton,\n      #mc-checkout-v5-order input[type="submit"],\n      #mc-checkout-v5-order button[type="submit"] {\n        background:#111 !important;\n        color:#fff !important;\n      }\n\n      #mc-checkout-v5-order td {\n        overflow-wrap:anywhere !important;\n      }\n\n      .mc-checkout-v5-card input[type="text"],\n      .mc-checkout-v5-card input[type="email"],\n      .mc-checkout-v5-card input[type="tel"],\n      .mc-checkout-v5-card input[type="number"],\n      .mc-checkout-v5-card select,\n      .mc-checkout-v5-card textarea {\n        width:100% !important;\n        max-width:100% !important;\n        min-height:43px !important;\n        padding:9px 11px !important;\n        border:1px solid #cec8c1 !important;\n        background:#fff !important;\n        color:#222 !important;\n        box-sizing:border-box !important;\n      }\n\n      #mc-checkout-v5-billing.mc-checkout-v5-billing-hidden {\n        display:none !important;\n      }\n\n      #mc-checkout-v5-coupon {\n        display:block !important;\n        margin:12px 16px 16px !important;\n        padding:12px !important;\n        border:1px solid #e1dcd6 !important;\n        background:#fff !important;\n        box-sizing:border-box !important;\n      }\n      #mc-checkout-v5-coupon__label {\n        display:block !important;\n        margin:0 0 8px !important;\n        color:#222 !important;\n        font:600 14px/1.3 Arial, Helvetica, sans-serif !important;\n      }\n      #mc-checkout-v5-coupon__row {\n        display:flex !important;\n        gap:8px !important;\n        align-items:stretch !important;\n      }\n      #mc-checkout-v5-coupon__input {\n        flex:1 1 auto !important;\n        min-width:0 !important;\n        min-height:42px !important;\n        padding:8px 10px !important;\n        border:1px solid #cec8c1 !important;\n        box-sizing:border-box !important;\n      }\n      #mc-checkout-v5-coupon__apply {\n        flex:0 0 auto !important;\n        min-height:42px !important;\n        padding:8px 14px !important;\n        border:1px solid #111 !important;\n        background:#111 !important;\n        color:#fff !important;\n        font:700 12px/1 Arial, Helvetica, sans-serif !important;\n        letter-spacing:.06em !important;\n        text-transform:uppercase !important;\n        cursor:pointer !important;\n      }\n\n      #mc-checkout-v5-billing-toggle {\n        display:flex !important;\n        align-items:center !important;\n        gap:10px !important;\n        width:100% !important;\n        margin:0 !important;\n        padding:15px 17px !important;\n        border:1px solid #e1dcd6 !important;\n        background:#fff !important;\n        color:#222 !important;\n        font-size:14px !important;\n        font-weight:600 !important;\n        box-sizing:border-box !important;\n        cursor:pointer !important;\n      }\n\n      #mc-checkout-v5-billing-toggle input {\n        width:18px !important;\n        height:18px !important;\n        margin:0 !important;\n        accent-color:#111 !important;\n      }\n\n      #v65-onepage-CopyBillingToShippingLink,\n      #v65-onepage-DetailHeaders,\n      #billing-header,\n      #shipping-header,\n      #v65-checkout-payment-header {\n        display:none !important;\n      }\n\n      /*\n       * Legacy Volusion heading GIFs are fixed-width (420px) and blow out the\n       * card on narrow screens. Nothing in these cards should ever exceed the\n       * card\'s content box.\n       */\n      #mc-checkout-v5 img {\n        max-width:100% !important;\n        height:auto !important;\n      }\n\n      /* Requested checkout cleanup */\n      body.mc-checkout-v5-active #v65-onepage-MakeChanges > tbody > tr:first-child > td:first-child {\n        display:none !important;\n      }\n\n      body.mc-checkout-v5-active #v65-onepage-MakeChanges > tbody > tr:first-child > td:nth-child(2) {\n        min-width:500px !important;\n        width:100% !important;\n      }\n\n      body.mc-checkout-v5-active #table_checkout_cart2 {\n        display:none !important;\n      }\n\n      body.mc-checkout-v5-active #savedPayment input,\n      body.mc-checkout-v5-active #savedPayment select {\n        margin-bottom:6px !important;\n        width:300px !important;\n        max-width:100% !important;\n      }\n\n      body.mc-checkout-v5-active #v65-onepage-header {\n        margin-left:31px !important;\n      }\n\n      body.mc-checkout-v5-active .vol-cc-verify-content,\n      body.mc-checkout-v5-active #vol-pop-up-to-modal > div:first-child > div:first-child > div:first-child,\n      body.mc-checkout-v5-active #ssl__modal {\n        display:none !important;\n      }\n\n      /*\n       * Scope this to checkout only. Applying .vol-list-grid globally would\n       * hide product grids elsewhere on the site.\n       */\n      body.mc-checkout-v5-active .vol-list-grid {\n        display:none !important;\n      }\n\n      @media (max-width:900px) {\n        body.mc-checkout-v5-active #v65-onepage-MakeChanges > tbody > tr:first-child > td:nth-child(2) {\n          min-width:0 !important;\n          width:100% !important;\n        }\n\n        body.mc-checkout-v5-active #savedPayment input,\n        body.mc-checkout-v5-active #savedPayment select {\n          width:100% !important;\n        }\n\n        body.mc-checkout-v5-active #v65-onepage-header {\n          margin-left:0 !important;\n        }\n      }\n\n      #btncalc_shipping,\n      label[for="btncalc_shipping"] {\n        position:absolute !important;\n        left:-99999px !important;\n        width:1px !important;\n        height:1px !important;\n        overflow:hidden !important;\n        opacity:0 !important;\n        pointer-events:none !important;\n      }\n\n      #mc-checkout-v5-order {\n        padding:0 !important;\n      }\n\n      #mc-checkout-v5-order > .mc-checkout-v5-title {\n        margin:0 !important;\n        padding:16px 18px !important;\n        border-bottom:1px solid #e1dcd6 !important;\n        text-align:left !important;\n      }\n\n      #mc-checkout-v5-order table {\n        table-layout:fixed !important;\n      }\n\n      #mc-checkout-v5-order textarea {\n        width:calc(100% - 32px) !important;\n        margin:0 16px 16px !important;\n      }\n\n      #placeOrderButton {\n        width:100% !important;\n        min-height:54px !important;\n        border:1px solid #111 !important;\n        background:#111 !important;\n        color:#fff !important;\n        font-size:12px !important;\n        font-weight:700 !important;\n        letter-spacing:.1em !important;\n        text-transform:uppercase !important;\n      }\n\n      #v65-onepage-Detail.mc-v5-detail-empty {\n        display:none !important;\n      }\n\n      @media (max-width:900px) {\n        /*\n         * ROOT CAUSE OF THE "CUT OFF ON THE RIGHT" MOBILE CHECKOUT:\n         *\n         * Volusion emits the shipping / billing / payment forms as legacy\n         * two-column tables (label cell + value cell) whose value cells hold\n         * <input size="25"> / <select> controls. An auto-layout table can never\n         * be narrower than its min-content width, and an input\'s min-content\n         * width comes from its size attribute (~280px here) -- a percentage\n         * width does not participate in intrinsic sizing. Label column (~130px)\n         * + input column (280px) = a 412-420px hard floor. The v5 card is 304px\n         * wide on a 390px phone and sets overflow:hidden, so the surplus was\n         * clipped rather than scrolled: fields and the payment dropdown were\n         * literally sliced off at the card edge.\n         *\n         * Fix: on narrow screens take these legacy tables out of table layout\n         * entirely so each cell becomes a full-width block (label above field).\n         * There is then no intrinsic-width floor to fight, and the inputs\'\n         * existing width:100% resolves against the real card width.\n         *\n         * Scoped to the three legacy form cards -- the order summary keeps its\n         * table layout, which is correct and already fits.\n         */\n        #mc-checkout-v5-shipping table,\n        #mc-checkout-v5-billing table,\n        #mc-checkout-v5-payment table,\n        #mc-checkout-v5-shipping tbody,\n        #mc-checkout-v5-billing tbody,\n        #mc-checkout-v5-payment tbody,\n        #mc-checkout-v5-shipping tr,\n        #mc-checkout-v5-billing tr,\n        #mc-checkout-v5-payment tr,\n        #mc-checkout-v5-shipping td,\n        #mc-checkout-v5-billing td,\n        #mc-checkout-v5-payment td {\n          display:block !important;\n          width:100% !important;\n          max-width:100% !important;\n          box-sizing:border-box !important;\n        }\n\n        /*\n         * The rule above is (0,1,0,1) and would otherwise re-show the legacy\n         * heading cells that are deliberately hidden. Re-assert those hides at\n         * (0,2,0,0) so they stay hidden.\n         */\n        #mc-checkout-v5-shipping #shipping-header,\n        #mc-checkout-v5-billing #billing-header,\n        #mc-checkout-v5-payment #v65-checkout-payment-header,\n        #mc-checkout-v5 #v65-onepage-DetailHeaders {\n          display:none !important;\n        }\n\n        /*\n         * Volusion right-aligns the label text with a legacy align="right"\n         * attribute so it sits next to its input in the two-column layout.\n         * Stacked, the label belongs above the field on the left.\n         */\n        #mc-checkout-v5-shipping td div[align="right"],\n        #mc-checkout-v5-billing td div[align="right"],\n        #mc-checkout-v5-payment td div[align="right"] {\n          text-align:left !important;\n        }\n\n        /* Let the controls shrink with the card instead of holding a floor. */\n        .mc-checkout-v5-card input,\n        .mc-checkout-v5-card select,\n        .mc-checkout-v5-card textarea {\n          min-width:0 !important;\n        }\n\n        #mc-checkout-v5 {\n          grid-template-columns:1fr !important;\n        }\n\n        #mc-checkout-v5-right {\n          order:-1 !important;\n          max-width:none !important;\n        }\n\n        #mc-checkout-v5-order {\n          max-width:none !important;\n        }\n\n        #mc-checkout-v5-right-inner {\n          position:static !important;\n        }\n\n        body.mc-checkout-v5-active #content_area {\n          padding:18px 14px 44px !important;\n        }\n      }\n    ';
    (document.head || document.documentElement).appendChild(s);
  }
})();

/**
 * McCabe's Checkout Layout v11 Recovery
 * Reconstructed from the saved working checkout page dated 2026-07-28.
 *
 * This keeps Volusion's native form, shipping calculation, payment controls,
 * coupon handling, tax calculation, and order submission intact.
 */
(function () {
  "use strict";

  var BUILD_ID = "mc-checkout-v5";
  var STYLE_ID = "mc-checkout-v5-css";

  function checkoutPage() {
    return /\/one-page-checkout\.asp/i.test(String(location.pathname || "")) ||
      /onepagecheckout|checkout/i.test(String(location.pathname || ""));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function form() {
    return byId("v65-onepage-CheckoutForm") ||
      document.forms.OnePageCheckoutForm ||
      document.querySelector('form[action*="OnePageCheckout"],form[action*="onepagecheckout"]');
  }

  function field(name) {
    var f = form();
    if (f && f.elements && f.elements[name]) return f.elements[name];
    return document.querySelector('[name="' + name + '"]');
  }

  function fireChange(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) {
      var ev = document.createEvent("HTMLEvents");
      ev.initEvent("change", true, false);
      el.dispatchEvent(ev);
    }
  }

  function copyValue(sourceName, targetName) {
    var source = field(sourceName);
    var target = field(targetName);
    if (!source || !target) return;

    if ((target.tagName || "").toLowerCase() === "select") {
      var sourceValue = String(source.value || "").toLowerCase();
      var sourceText = "";
      if (source.options && source.selectedIndex >= 0) {
        sourceText = String(source.options[source.selectedIndex].text || "").toLowerCase();
      }

      var matched = false;
      for (var i = 0; i < target.options.length; i++) {
        var option = target.options[i];
        if (
          String(option.value || "").toLowerCase() === sourceValue ||
          (sourceText && String(option.text || "").toLowerCase() === sourceText)
        ) {
          target.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) target.value = source.value;
    } else {
      target.value = source.value;
    }

    fireChange(target);
  }

  function syncShippingToBilling() {
    [
      ["ShipFirstName", "BillingFirstName"],
      ["ShipLastName", "BillingLastName"],
      ["ShipCompanyName", "BillingCompanyName"],
      ["ShipAddress1", "BillingAddress1"],
      ["ShipAddress2", "BillingAddress2"],
      ["ShipCity", "BillingCity"],
      ["ShipCountry", "BillingCountry"],
      ["ShipPostalCode", "BillingPostalCode"],
      ["ShipPhoneNumber", "BillingPhoneNumber"]
    ].forEach(function (pair) {
      copyValue(pair[0], pair[1]);
    });

    if (field("ShipState_dropdown") && field("BillingState_dropdown")) {
      copyValue("ShipState_dropdown", "BillingState_dropdown");
    } else {
      copyValue("ShipState", "BillingState");
    }

    var shipEmail = field("ShipEmail") || field("ShippingEmail");
    var billingEmail = field("BillingEmail");
    if (shipEmail && billingEmail) {
      billingEmail.value = shipEmail.value;
      fireChange(billingEmail);
    }
  }

  function hide(el) {
    if (!el) return;
    el.style.setProperty("display", "none", "important");
    el.setAttribute("aria-hidden", "true");
  }

  function hideRegistrationAndReturningUser() {
    [
      "v65-onepage-RegistrationHeader",
      "v65-onepage-RegistrationFormFields",
      "v65-onepage-registration"
    ].forEach(function (id) {
      hide(byId(id));
    });

    document.querySelectorAll(
      '#v65-onepage-RegistrationFormFields input[type="password"],' +
      '#v65-onepage-registration input[type="password"],' +
      'input[name="password"],input[name="passwordagain"]'
    ).forEach(function (input) {
      input.disabled = true;
      input.removeAttribute("required");
      input.removeAttribute("aria-required");
    });

    document.querySelectorAll("div,span,td,p,a,strong,b").forEach(function (el) {
      var txt = String(el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (
        txt === "returning customer? sign in" ||
        txt === "returning customer? signin"
      ) {
        var target = el;
        while (
          target.parentElement &&
          target.parentElement !== document.body &&
          String(target.parentElement.textContent || "").replace(/\s+/g, " ").trim().length < 100
        ) {
          target = target.parentElement;
        }
        hide(target);
      }
    });
  }

  function addTitle(card, text) {
    var title = document.createElement("h2");
    title.className = "mc-checkout-v5-title";
    title.textContent = text;
    card.appendChild(title);
  }

  function card(id, title, content) {
    var section = document.createElement("section");
    section.id = id;
    section.className = "mc-checkout-v5-card";
    addTitle(section, title);
    section.appendChild(content);
    return section;
  }

  function billingToggle(billingCard, shippingRoot) {
    var label = document.createElement("label");
    label.id = "mc-checkout-v5-billing-toggle";
    label.setAttribute("for", "mc-checkout-v5-billing-toggle-input");

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "mc-checkout-v5-billing-toggle-input";
    checkbox.checked = true;

    var text = document.createElement("span");
    text.textContent = "Billing address is the same as shipping";

    label.appendChild(checkbox);
    label.appendChild(text);

    function update() {
      if (checkbox.checked) {
        syncShippingToBilling();
        billingCard.classList.add("mc-checkout-v5-billing-hidden");
        billingCard.setAttribute("aria-hidden", "true");
      } else {
        billingCard.classList.remove("mc-checkout-v5-billing-hidden");
        billingCard.removeAttribute("aria-hidden");
      }
    }

    checkbox.addEventListener("change", update);

    shippingRoot.querySelectorAll("input,select,textarea").forEach(function (el) {
      el.addEventListener("input", function () {
        if (checkbox.checked) syncShippingToBilling();
      });
      el.addEventListener("change", function () {
        if (checkbox.checked) syncShippingToBilling();
      });
    });

    var f = form();
    if (f) {
      f.addEventListener("submit", function () {
        if (checkbox.checked) syncShippingToBilling();
      });
    }

    update();
    return label;
  }

  function cleanupWrongLayout() {
    var old = byId("mc-checkout-layout-v1");
    if (!old) return;

    /*
     * The native tables are moved out below when v5 builds. Remove only the
     * empty v1 wrappers, never the native Volusion tables themselves.
     */
    [
      "mc-checkout-shipping-card",
      "mc-checkout-billing-card",
      "mc-checkout-payment-card",
      "mc-checkout-order-card"
    ].forEach(function (id) {
      var wrapper = byId(id);
      if (!wrapper) return;
      while (wrapper.firstChild) {
        wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.remove();
    });

    var toggle = byId("mc-checkout-billing-toggle");
    if (toggle) toggle.remove();
    if (old.parentNode) old.parentNode.removeChild(old);

    document.body.classList.remove("mc-checkout-layout-active");
  }

  function build() {
    if (!checkoutPage() || !document.body) return false;
    if (byId(BUILD_ID)) return true;

    cleanupWrongLayout();

    var detail = byId("v65-onepage-Detail");
    var shipping = byId("v65-onepage-ShippingCostParent");
    var billing = byId("v65-onepage-Billing");
    var payment = byId("v65-onepage-payment-details-parent-table");
    var order = byId("table_checkout_cart0");

    if (!detail || !shipping || !billing || !payment || !order) return false;

    document.body.classList.add("mc-checkout-v5-active");
    document.documentElement.setAttribute("data-mc-checkout-layout", "v11");

    hideRegistrationAndReturningUser();

    var layout = document.createElement("div");
    layout.id = BUILD_ID;

    var left = document.createElement("div");
    left.id = "mc-checkout-v5-left";

    var right = document.createElement("aside");
    right.id = "mc-checkout-v5-right";

    var rightInner = document.createElement("div");
    rightInner.id = "mc-checkout-v5-right-inner";

    right.appendChild(rightInner);
    layout.appendChild(left);
    layout.appendChild(right);

    var checkoutForm = form();
    if (checkoutForm) {
      checkoutForm.insertBefore(layout, checkoutForm.firstChild);
    } else {
      detail.parentNode.insertBefore(layout, detail);
    }

    /*
     * Payment is nested inside the shipping-side legacy table. Detach first so
     * moving the shipping table does not carry payment along with it.
     */
    if (payment.parentNode) payment.parentNode.removeChild(payment);

    var shippingCard = card("mc-checkout-v5-shipping", "Shipping Information", shipping);
    var billingCard = card("mc-checkout-v5-billing", "Billing Information", billing);
    var paymentCard = card("mc-checkout-v5-payment", "Payment", payment);
    var orderCard = card("mc-checkout-v5-order", "Your Order", order);

    left.appendChild(shippingCard);
    left.appendChild(billingToggle(billingCard, shipping));
    left.appendChild(billingCard);
    left.appendChild(paymentCard);
    rightInner.appendChild(orderCard);

    detail.classList.add("mc-v5-detail-empty");

    hideRegistrationAndReturningUser();
    syncShippingToBilling();
    ensurePromoBox(orderCard);

    return true;
  }

  function ensurePromoBox(orderCard) {
    if (!orderCard || byId("mc-checkout-v5-coupon")) return;
    /* FB checkout already injects its own promo box. */
    try {
      if (/(?:^|[?&])fbcheckout=1(?:&|$)/i.test(window.location.search || "")) return;
    } catch (eFb) {}

    var box = document.createElement("div");
    box.id = "mc-checkout-v5-coupon";
    box.innerHTML =
      '<label id="mc-checkout-v5-coupon__label" for="mc-checkout-v5-coupon__input">Promo code</label>' +
      '<div id="mc-checkout-v5-coupon__row">' +
      '<input id="mc-checkout-v5-coupon__input" type="text" autocomplete="off" spellcheck="false" placeholder="Enter code">' +
      '<button id="mc-checkout-v5-coupon__apply" type="button">Apply</button>' +
      "</div>";

    var totals = byId("v65-onepage-ShippingCostDetails");
    if (totals && totals.parentNode) {
      totals.parentNode.insertBefore(box, totals);
    } else {
      orderCard.appendChild(box);
    }

    var input = byId("mc-checkout-v5-coupon__input");
    var apply = byId("mc-checkout-v5-coupon__apply");
    var native = document.querySelector('input[name="CouponCode"]');
    var nativeBtn = document.querySelector(
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
    if (build()) return;

    var attempts = 0;
    var timer = window.setInterval(function () {
      attempts++;
      if (build() || attempts >= 40) window.clearInterval(timer);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.addEventListener("load", start);
})();