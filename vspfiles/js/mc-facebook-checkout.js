(function (g, d) {
  'use strict';
  var params = new URLSearchParams(g.location.search || '');
  var active = params.get('fbcheckout') === '1';
  if (!active) return;
  d.documentElement.classList.add('mc-facebook-checkout');
  var path = String(g.location.pathname || '').toLowerCase();
  var isCheckout = /one-page-checkout|checkout/.test(path);
  var isCart = /shoppingcart|shopcart/.test(path);
  var isProduct = /productdetails|product-p\//.test(path);

  function hideNormalSiteChrome() {
    var selectors = [
      'header.header', '.microblock.main-menu', '#display_menu_1',
      'footer.footer', '#related_products_header', '#related_products_content',
      '.v65-product-related-details-row', '[data-mc-related-plp="1"]',
      '.mc-account-float', '.mc-cart-float', '.mc-home-float', '.mc-search-float',
      /* Sitewide promo strip still advertises FBSALE / MAHJ20 / mattress 10%.
         FB flow has its own #mc-fb-offer banner — hide the store marquee so
         Mahjong is never shown as part of the Extra 10% Facebook sale. */
      '#mcPromoBanner', '.mc-promo-banner', '[class*="promo-banner"]'
    ];
    selectors.forEach(function (selector) {
      d.querySelectorAll(selector).forEach(function (node) {
        node.style.setProperty('display', 'none', 'important');
      });
    });
    var offer = d.getElementById('mc-fb-offer');
    if (offer) {
      offer.style.setProperty('background', '#f8f8f8', 'important');
      offer.style.setProperty('color', '#333', 'important');
      offer.style.setProperty('font-family', 'Cormorant Garamond, Georgia, Times New Roman, serif', 'important');
      offer.querySelectorAll('*').forEach(function (node) {
        node.style.setProperty('color', '#333', 'important');
        node.style.setProperty('font-family', 'Cormorant Garamond, Georgia, Times New Roman, serif', 'important');
      });
    }
  }

  /* Checkout-only UI fixes. Kept behind isCheckout so product pages are untouched.
     1) Billing card stays hidden while "same as shipping" is checked.
        Live mc-checkout-layout.js toggles class mc-checkout-v5-billing-hidden,
        but its injected CSS only hides .mc-v5-hidden — class-name mismatch.
     2) Newsletter opt-in is removed from the FB flow.
     3) Promo/coupon entry is restored. Layout hides #table_checkout_cart2
        (the "Apply a coupon" toggle), so the real CouponCode field never appears. */
  function ensureCheckoutUiStyles() {
    if (d.getElementById('mc-fb-checkout-ui-style')) return;
    var style = d.createElement('style');
    style.id = 'mc-fb-checkout-ui-style';
    style.textContent =
      'html.mc-facebook-checkout #mc-checkout-v5-billing.mc-checkout-v5-billing-hidden,' +
      'html.mc-facebook-checkout #mc-checkout-v5-billing.mc-v5-hidden,' +
      'html.mc-facebook-checkout #mc-checkout-v5-billing[aria-hidden="true"]{' +
      'display:none!important;}' +
      'html.mc-facebook-checkout .v65-onepage-newsletter-row,' +
      'html.mc-facebook-checkout #v65-onepage-newsletter-checkbox,' +
      'html.mc-facebook-checkout label[for="v65-onepage-newsletter-checkbox"]{' +
      'display:none!important;}' +
      'html.mc-facebook-checkout #mc-fb-coupon{' +
      'display:block!important;margin:12px 16px 16px!important;padding:12px!important;' +
      'border:1px solid #e1dcd6!important;background:#fff!important;box-sizing:border-box!important;}' +
      'html.mc-facebook-checkout #mc-fb-coupon__label{' +
      'display:block!important;margin:0 0 8px!important;color:#222!important;' +
      'font:600 14px/1.3 Arial,Helvetica,sans-serif!important;}' +
      'html.mc-facebook-checkout #mc-fb-coupon__row{' +
      'display:flex!important;gap:8px!important;align-items:stretch!important;}' +
      'html.mc-facebook-checkout #mc-fb-coupon__input{' +
      'flex:1 1 auto!important;min-width:0!important;min-height:42px!important;' +
      'padding:8px 10px!important;border:1px solid #cec8c1!important;box-sizing:border-box!important;}' +
      'html.mc-facebook-checkout #mc-fb-coupon__apply{' +
      'flex:0 0 auto!important;min-height:42px!important;padding:8px 14px!important;' +
      'border:1px solid #111!important;background:#111!important;color:#fff!important;' +
      'font:700 12px/1 Arial,Helvetica,sans-serif!important;letter-spacing:.06em!important;' +
      'text-transform:uppercase!important;cursor:pointer!important;}' +
      'html.mc-facebook-checkout #mc-fb-offer[data-mc-fb-mahjong="1"],' +
      'html.mc-facebook-checkout #mc-fb-offer[data-mc-fb-mahjong="1"] .mc-fb-offer__headline{' +
      'font-size:14px!important;line-height:1.35!important;}';
    d.head.appendChild(style);
  }

  function hideNewsletter() {
    var box = d.getElementById('v65-onepage-newsletter-checkbox') ||
      d.querySelector('input[name="emailsubscriber"]');
    if (box) {
      box.checked = false;
      box.removeAttribute('checked');
    }
    d.querySelectorAll('.v65-onepage-newsletter-row, #v65-onepage-newsletter-checkbox').forEach(function (node) {
      node.style.setProperty('display', 'none', 'important');
    });
    d.querySelectorAll('label[for="v65-onepage-newsletter-checkbox"]').forEach(function (node) {
      node.style.setProperty('display', 'none', 'important');
    });
    /* Also catch unlabeled text nodes Volusion wraps around the checkbox. */
    d.querySelectorAll('tr, label, div, p').forEach(function (node) {
      var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      if (/newsletter emails from McCabe/i.test(text) && text.length < 140) {
        node.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function enforceBillingVisibility() {
    var billing = d.getElementById('mc-checkout-v5-billing');
    var toggle = d.getElementById('mc-checkout-v5-billing-toggle-input') ||
      d.getElementById('mc-checkout-v5-toggle-input');
    if (!billing || !toggle) return;
    if (toggle.checked) {
      billing.classList.add('mc-checkout-v5-billing-hidden');
      billing.classList.add('mc-v5-hidden');
      billing.setAttribute('aria-hidden', 'true');
      billing.style.setProperty('display', 'none', 'important');
    } else {
      billing.classList.remove('mc-checkout-v5-billing-hidden');
      billing.classList.remove('mc-v5-hidden');
      billing.removeAttribute('aria-hidden');
      billing.style.removeProperty('display');
    }
    if (toggle.getAttribute('data-mc-fb-billing-bound') === '1') return;
    toggle.setAttribute('data-mc-fb-billing-bound', '1');
    toggle.addEventListener('change', enforceBillingVisibility);
  }

  function nativeCouponField() {
    return d.querySelector('input[name="CouponCode"]');
  }

  function nativeCouponButton() {
    return d.querySelector('input[name="btnCouponCode"], #btn_apply, input[value="Apply"][name*="Coupon"]');
  }

  function applyCoupon(code) {
    var value = String(code || '').trim();
    if (!value) return;
    var field = nativeCouponField();
    var button = nativeCouponButton();
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (button) {
      button.click();
      return;
    }
    /* Fall back to submitting the checkout form with the coupon field filled. */
    var form = field && field.form;
    if (form) form.submit();
  }

  function ensurePromoBox() {
    if (d.getElementById('mc-fb-coupon')) return;
    var order = d.getElementById('mc-checkout-v5-order');
    if (!order) return;

    var box = d.createElement('div');
    box.id = 'mc-fb-coupon';
    box.innerHTML =
      '<label id="mc-fb-coupon__label" for="mc-fb-coupon__input">Promo code</label>' +
      '<div id="mc-fb-coupon__row">' +
      '<input id="mc-fb-coupon__input" type="text" autocomplete="off" spellcheck="false" placeholder="Enter code">' +
      '<button id="mc-fb-coupon__apply" type="button">Apply</button>' +
      '</div>';

    /* Sit above the totals when possible so the code is visible next to the order. */
    var totals = d.getElementById('v65-onepage-ShippingCostDetails');
    if (totals && totals.parentNode) {
      totals.parentNode.insertBefore(box, totals);
    } else {
      order.appendChild(box);
    }

    var input = d.getElementById('mc-fb-coupon__input');
    var apply = d.getElementById('mc-fb-coupon__apply');
    var native = nativeCouponField();
    if (native && native.value && input) input.value = native.value;

    function run() {
      applyCoupon(input && input.value);
    }
    if (apply) apply.addEventListener('click', run);
    if (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          run();
        }
      });
    }
  }

  function polishCheckoutUi() {
    if (!isCheckout) return;
    ensureCheckoutUiStyles();
    hideNewsletter();
    enforceBillingVisibility();
    ensurePromoBox();
  }

  var MAHJONG_OFFER_HTML =
    '<div class="mc-fb-offer__headline" style="font-size:14px!important;line-height:1.35!important;text-align:center!important;margin:0!important;">Mahjong Sale Ends Monday!</div>';

  function applyMahjongOfferHtml(offer) {
    if (!offer) return;
    offer.innerHTML = MAHJONG_OFFER_HTML;
    offer.setAttribute('data-mc-fb-mahjong', '1');
  }

  function isIgnorableCartCode(code) {
    return (
      !code ||
      /^(CODE|ITEM|SKU|PRODUCT|PRODUCTCODE|QTY|TOTAL)$/.test(code) ||
      /^DSC-/.test(code) ||
      /DISCOUNT|COUPON|PROMO|GIFT|CERTIFICATE|SHIPPING|TAX|%OFF|OFFTRAVEL|OFF\s/i.test(code)
    );
  }

  /* Real Volusion SKUs look like TMH-TRV-… / MHH-… — not discount labels. */
  function isProductSku(code) {
    return /^[A-Z]{2,}[A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(code || '');
  }

  /* Order-summary codes only. Do NOT scan every product link on the page —
     footer/related links made Mahjong carts look "mixed" and kept FBSALE up. */
  function cartCodesFromDom() {
    var codes = [];
    d.querySelectorAll('.v65-onepage-ordersummary-itemcode').forEach(function (el) {
      var row = el.closest('tr') || el.parentElement;
      if (row && !/\$\s*[\d,]/.test(row.textContent || '')) return;
      var text = String(el.textContent || '')
        .replace(/%2d/gi, '-')
        .replace(/\s+/g, '')
        .toUpperCase();
      if (isIgnorableCartCode(text) || !isProductSku(text)) return;
      if (codes.indexOf(text) === -1) codes.push(text);
    });
    return codes;
  }

  function cartCodes() {
    var id = cartId();
    if (!id) return Promise.resolve(cartCodesFromDom());
    return fetch('/api/v1/carts/' + encodeURIComponent(id), { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        var items = (payload && payload.data && payload.data.items) || [];
        var codes = items
          .map(function (item) { return String(item.code || '').toUpperCase(); })
          .filter(function (code) { return !isIgnorableCartCode(code) && isProductSku(code); });
        return codes.length ? codes : cartCodesFromDom();
      })
      .catch(function () { return cartCodesFromDom(); });
  }

  function codesAreMahjongOnly(codes) {
    var real = (codes || []).filter(function (item) {
      return !isIgnorableCartCode(item) && isProductSku(item);
    });
    if (!real.length) return false;
    return real.every(function (item) { return /^TMH-/.test(item); });
  }

  function cartHasMahjong(codes) {
    return (codes || []).some(function (item) {
      return /^TMH-/.test(item) && isProductSku(item) && !isIgnorableCartCode(item);
    });
  }

  /* Product pages use ProductCode. Checkout has no ProductCode input, so a
     Mahjong-only cart must be detected from the order summary / cart API or
     the FBSALE banner incorrectly stays up. */
  function isMahjongContext() {
    var code = getCode();
    if (code) return Promise.resolve(/^TMH-/.test(code));
    if (!isCheckout && !isCart) return Promise.resolve(false);
    var domCodes = cartCodesFromDom();
    if (domCodes.length) return Promise.resolve(codesAreMahjongOnly(domCodes));
    return cartCodes().then(codesAreMahjongOnly);
  }

  function paintDefaultOffer(offer, productCode) {
    if (/^MHH-/.test(productCode)) {
      offer.innerHTML = '<div><div class="mc-fb-offer__eyebrow">CordaRoy\u2019s Mattress Offer</div><div class="mc-fb-offer__headline">Save 10% + Free Shipping</div></div><div class="mc-fb-offer__code">CODE: CORD10</div><div class="mc-fb-offer__delivery">Quick delivery<br>2\u20133 days after purchase</div>';
      offer.removeAttribute('data-mc-fb-mahjong');
      return;
    }
    offer.innerHTML = '<div><div class="mc-fb-offer__eyebrow">Facebook Marketplace Exclusive</div><div class="mc-fb-offer__headline">Extra 10% off through Friday</div></div><div class="mc-fb-offer__code">CODE: FBSALE</div><div class="mc-fb-offer__delivery">Quick delivery<br>2\u20133 days after purchase</div>';
    offer.removeAttribute('data-mc-fb-mahjong');
  }

  function ensureOffer() {
    var area = d.getElementById('content_area');
    if (!area) return null;
    var offer = d.getElementById('mc-fb-offer');
    var productCode = getCode();
    var domCodes = cartCodesFromDom();
    var mahjongOffer = /^TMH-/.test(productCode) || ((isCheckout || isCart) && codesAreMahjongOnly(domCodes));
    var created = false;
    if (!offer) {
      offer = d.createElement('section');
      offer.id = 'mc-fb-offer';
      offer.className = 'mc-fb-offer';
      offer.setAttribute('aria-label', 'Facebook Marketplace offer');
      created = true;
    }
    if (mahjongOffer) {
      applyMahjongOfferHtml(offer);
    } else if (created) {
      /* On checkout, never paint FBSALE until the cart is known. Mahjong-only
         carts were getting stuck on Extra 10% when the summary/API lagged. */
      if ((isCheckout || isCart) && !productCode) {
        if (cartHasMahjong(domCodes)) {
          applyMahjongOfferHtml(offer);
        } else {
          offer.innerHTML = '<div class="mc-fb-offer__headline" style="font-size:14px!important;text-align:center!important;margin:0!important;">&nbsp;</div>';
          offer.setAttribute('data-mc-fb-pending', '1');
        }
      } else {
        paintDefaultOffer(offer, productCode);
      }
    } else if (
      (isCheckout || isCart) &&
      /FBSALE|Extra 10%\s*off/i.test(String(offer.innerText || ''))
    ) {
      isMahjongContext().then(function (yes) {
        if (yes) {
          applyMahjongOfferHtml(offer);
          hideNormalSiteChrome();
        }
      });
    }
    if (created) area.insertBefore(offer, area.firstChild);
    if (!mahjongOffer && (isCheckout || isCart)) {
      isMahjongContext().then(function (yes) {
        if (yes) {
          applyMahjongOfferHtml(offer);
          hideNormalSiteChrome();
        } else if (offer.getAttribute('data-mc-fb-pending') === '1' || !offer.innerText.trim()) {
          paintDefaultOffer(offer, productCode);
          offer.removeAttribute('data-mc-fb-pending');
        }
      });
    }
    return offer;
  }

  function ready() {
    if (!d.body) return;
    d.body.classList.add('mc-facebook-checkout-ready');
    if (isCheckout) d.body.classList.add('mc-facebook-checkout-page');
    ensureOffer();
    hideNormalSiteChrome();
    polishCheckoutUi();
    g.setTimeout(function () { ensureOffer(); hideNormalSiteChrome(); polishCheckoutUi(); }, 250);
    g.setTimeout(function () { ensureOffer(); hideNormalSiteChrome(); polishCheckoutUi(); }, 1200);
    g.setTimeout(function () { ensureOffer(); polishCheckoutUi(); }, 2500);
    g.setTimeout(function () { ensureOffer(); hideNormalSiteChrome(); }, 5000);
  }

  function getCode() {
    var input = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var match = String(g.location.href).match(/[?&]ProductCode=([^&]+)/i);
    return String((input && input.value) || (match && match[1]) || '').replace(/%2d/ig, '-').toUpperCase();
  }

  function cartId() {
    var found = d.cookie.match(/(?:^|;\s*)CartID5=([^;]+)/);
    return found ? decodeURIComponent(found[1]) : '';
  }

  function hasProductInCart(code) {
    var id = cartId();
    if (!id || !code) return Promise.resolve(false);
    return fetch('/api/v1/carts/' + encodeURIComponent(id), { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        var items = payload && payload.data && payload.data.items || [];
        return items.some(function (item) { return String(item.code || '').toUpperCase() === code; });
      }).catch(function () { return false; });
  }

  function routeToCheckoutWhenAdded(code) {
    var attempts = 0;
    function check() {
      attempts += 1;
      hasProductInCart(code).then(function (found) {
        if (found) { g.location.assign('/one-page-checkout.asp?fbcheckout=1'); return; }
        if (attempts < 14) g.setTimeout(check, 400);
      });
    }
    g.setTimeout(check, 350);
  }

  function wireBuyButton() {
    if (!isProduct) return;
    var code = getCode();
    var button = d.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
    if (button) {
      if (button.tagName === 'INPUT') button.value = 'BUY NOW \u2014 CONTINUE TO CHECKOUT';
      else button.textContent = 'BUY NOW \u2014 CONTINUE TO CHECKOUT';
      button.setAttribute('aria-label', 'Buy now and continue to checkout');
    }
    d.addEventListener('click', function (event) {
      var target = event.target && event.target.closest && event.target.closest('input[name="btnaddtocart"], button[name="btnaddtocart"], input[id*="btnaddtocart"]');
      if (!target) return;
      routeToCheckoutWhenAdded(code);
    }, true);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { ready(); wireBuyButton(); });
  else { ready(); wireBuyButton(); }
  if (isCart) g.setTimeout(function () { g.location.replace('/one-page-checkout.asp?fbcheckout=1'); }, 600);

  /* Layout finishes after us on slow loads — keep watching so Mahjong never
     falls back to the Extra 10% FBSALE banner after card rebuilds. */
  if ((isCheckout || isProduct) && g.MutationObserver && d.documentElement) {
    var tries = 0;
    var observer = new g.MutationObserver(function () {
      tries += 1;
      ensureOffer();
      hideNormalSiteChrome();
      polishCheckoutUi();
      if (tries > 60) observer.disconnect();
    });
    observer.observe(d.documentElement, { childList: true, subtree: true });
    g.setTimeout(function () { observer.disconnect(); }, 10000);
  }
}(window, document));
