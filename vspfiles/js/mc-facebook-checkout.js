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
      '.mc-account-float', '.mc-cart-float', '.mc-home-float', '.mc-search-float'
    ];
    selectors.forEach(function (selector) {
      d.querySelectorAll(selector).forEach(function (node) {
        node.style.setProperty('display', 'none', 'important');
      });
    });
    var offer = d.getElementById('mc-fb-offer');
    if (offer) {
      offer.style.setProperty('background', '#000', 'important');
      offer.querySelectorAll('*').forEach(function (node) {
        node.style.setProperty('color', '#fff', 'important');
        node.style.setProperty('font-family', 'Arial, Helvetica, sans-serif', 'important');
      });
    }
  }
  function mountWhiteGloveFinder() {
    if (!isProduct && !isCheckout) return;
    var code = getCode();
    if (/^(MHH-|TMH-)/.test(code)) return;
    var area = d.getElementById('content_area');
    var data = g.__MC_WHITE_GLOVE_ZIP_TIERS__;
    if (!area || !data || !data.zips) return;
    var finder = d.getElementById('mc-fb-white-glove');
    if (!finder) {
      finder = d.createElement('section');
      finder.id = 'mc-fb-white-glove';
      finder.className = 'mc-fb-white-glove';
      finder.innerHTML = '<strong>White Glove Delivery</strong><span>Enter your ZIP code to see your local delivery option.</span><div><input inputmode="numeric" maxlength="5" aria-label="ZIP code for White Glove Delivery" placeholder="ZIP code"><button type="button">Check ZIP</button></div><p aria-live="polite"></p>';
      var offer = d.getElementById('mc-fb-offer');
      if (offer && offer.nextSibling) area.insertBefore(finder, offer.nextSibling);
      else area.insertBefore(finder, area.firstChild);
      var input = finder.querySelector('input');
      var button = finder.querySelector('button');
      function showQuote() {
        var zip = String(input.value || '').match(/\b\d{5}\b/);
        var output = finder.querySelector('p');
        if (!zip) { output.textContent = 'Enter a 5-digit ZIP code.'; return; }
        var quote = data.zips[zip[0]];
        if (!quote) { output.textContent = 'White Glove Delivery is not available for this ZIP code.'; return; }
        output.textContent = 'White Glove Delivery available — $' + Number(quote.priceBeforeWeight || quote.basePrice || 0).toFixed(0) + ' (' + Number(quote.distanceMiles || 0).toFixed(1) + ' miles from Forney).';
        var checkoutZip = d.querySelector('#v65-onepage-shippostcode, input[name="ShipPostalCode"]');
        if (checkoutZip) {
          checkoutZip.value = zip[0];
          checkoutZip.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      button.addEventListener('click', showQuote);
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); showQuote(); } });
    }
  }
  function ready() {
    if (!d.body) return;
    d.body.classList.add('mc-facebook-checkout-ready');
    if (isCheckout) d.body.classList.add('mc-facebook-checkout-page');
    var area = d.getElementById('content_area');
    if (area && !d.getElementById('mc-fb-offer')) {
      var productCode = getCode();
      var mattressOffer = /^MHH-/.test(productCode);
      var mahjongOffer = /^TMH-/.test(productCode);
      var offer = d.createElement('section');
      offer.id = 'mc-fb-offer';
      offer.className = 'mc-fb-offer';
      offer.setAttribute('aria-label', 'Facebook Marketplace offer');
      offer.innerHTML = mattressOffer
        ? '<div><div class="mc-fb-offer__eyebrow">CordaRoy’s Mattress Offer</div><div class="mc-fb-offer__headline">Save 10% + Free Shipping</div></div><div class="mc-fb-offer__code">CODE: CORD10</div><div class="mc-fb-offer__delivery">Quick delivery<br>2–3 days after purchase</div>'
        : '<div><div class="mc-fb-offer__eyebrow">Facebook Marketplace Exclusive</div><div class="mc-fb-offer__headline">Extra 10% off through Friday</div></div><div class="mc-fb-offer__code">CODE: FBSALE</div><div class="mc-fb-offer__delivery">Quick delivery<br>2–3 days after purchase</div>';
      if (mahjongOffer) {
        offer.innerHTML = '<div><div class="mc-fb-offer__eyebrow">Mahjong Set Offer</div><div class="mc-fb-offer__headline">Save 20% on your tile set</div></div><div class="mc-fb-offer__code">CODE: MAHJ20</div><div class="mc-fb-offer__delivery">Fast Shipping<br>$10 per set</div>';
      }
      area.insertBefore(offer, area.firstChild);
    }
    hideNormalSiteChrome();
    mountWhiteGloveFinder();
    g.setTimeout(hideNormalSiteChrome, 250);
    g.setTimeout(hideNormalSiteChrome, 1200);
    [200, 900, 2200].forEach(function (delay) { g.setTimeout(mountWhiteGloveFinder, delay); });
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
      if (button.tagName === 'INPUT') button.value = 'BUY NOW — CONTINUE TO CHECKOUT';
      else button.textContent = 'BUY NOW — CONTINUE TO CHECKOUT';
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
}(window, document));
