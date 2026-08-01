(function (g, d) {
  'use strict';

  /* Mahjong-only overrides for the Facebook Marketplace checkout flow.
     Kept in its own file so nothing here can reach the regular storefront or
     the other Facebook checkout products: the whole script exits immediately
     unless the page carries ?fbcheckout=1, and every change below is additionally
     gated on the page/cart being Mahjong (TMH-).

     Two things this fixes, both confirmed live on 2026-08-01:

     1. Extra 10% off leaked onto Mahjong. mc-facebook-checkout.js picks the offer
        banner from the product code, but one-page-checkout.asp has no
        ProductCode input, so its getCode() returns "" there and the generic
        "Extra 10% off through Friday / CODE: FBSALE" banner rendered even for a
        cart holding nothing but tile sets. Mahjong is on its own MAHJ20 promo and
        must never be advertised as part of the FBSALE sale.

     2. The Mahjong banner copy is kept separate from the generic FBSALE /
        mattress banners so storefront and other FB products stay untouched. */

  var params = new URLSearchParams(g.location.search || '');
  if (params.get('fbcheckout') !== '1') return;

  var OFFER_ID = 'mc-fb-offer';
  var APPLIED_ATTR = 'data-mc-fb-mahjong';
  var MAHJONG_CODE = /^TMH-/;
  var SERIF = 'Cormorant Garamond, Georgia, Times New Roman, serif';
  var GIVE_UP_AFTER_MS = 12000;

  var MAHJONG_OFFER_HTML =
    '<div class="mc-fb-offer__headline" style="font-size:14px!important;line-height:1.35!important;text-align:center!important;margin:0!important;">' +
    'Mahjong Sale Ends Monday!' +
    '</div>';

  function productCode() {
    var input = d.querySelector('input[name="ProductCode"], input[name="productcode"]');
    var match = String(g.location.href).match(/[?&]ProductCode=([^&]+)/i);
    return String((input && input.value) || (match && match[1]) || '')
      .replace(/%2d/ig, '-')
      .toUpperCase();
  }

  function cartId() {
    var found = d.cookie.match(/(?:^|;\s*)CartID5=([^;]+)/);
    return found ? decodeURIComponent(found[1]) : '';
  }

  function cartCodesFromDom() {
    var codes = [];
    d.querySelectorAll('.v65-onepage-ordersummary-itemcode').forEach(function (el) {
      var text = String(el.textContent || '').replace(/\s+/g, '').toUpperCase();
      if (!text || /^(CODE|ITEM|SKU|PRODUCT|PRODUCTCODE|QTY|TOTAL)$/.test(text)) return;
      if (codes.indexOf(text) === -1) codes.push(text);
    });
    return codes;
  }

  function cartCodes() {
    var id = cartId();
    var domCodes = cartCodesFromDom();
    if (!id) return Promise.resolve(domCodes);
    return fetch('/api/v1/carts/' + encodeURIComponent(id), { credentials: 'include' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (payload) {
        var items = (payload && payload.data && payload.data.items) || [];
        var codes = items.map(function (item) { return String(item.code || '').toUpperCase(); }).filter(Boolean);
        return codes.length ? codes : domCodes;
      })
      .catch(function () { return domCodes; });
  }

  /* True only when everything being bought is Mahjong. On a product page the
     code on the page decides on its own - falling through to the cart there
     would let a leftover Mahjong cart rewrite the banner on, say, a mattress
     PDP. Elsewhere (cart, one-page checkout) there is no code to read, so the
     cart decides, and a mixed cart keeps whatever banner
     mc-facebook-checkout.js chose. Either way this file can never change the
     offer shown for another product family. */
  function isMahjongContext() {
    var code = productCode();
    if (code) return Promise.resolve(MAHJONG_CODE.test(code));
    var domCodes = cartCodesFromDom();
    if (domCodes.length) {
      return Promise.resolve(domCodes.every(function (item) { return MAHJONG_CODE.test(item); }));
    }
    return cartCodes().then(function (codes) {
      if (!codes.length) return false;
      return codes.every(function (item) { return MAHJONG_CODE.test(item); });
    });
  }

  /* mc-facebook-checkout.js paints these inline on the nodes it created, and it
     re-runs at 250ms and 1200ms. Matching it here keeps the replacement looking
     identical no matter which of the two lands last. */
  function paint(offer) {
    offer.style.setProperty('background', '#f8f8f8', 'important');
    offer.style.setProperty('color', '#333', 'important');
    offer.style.setProperty('font-family', SERIF, 'important');
    offer.querySelectorAll('*').forEach(function (node) {
      node.style.setProperty('color', '#333', 'important');
      node.style.setProperty('font-family', SERIF, 'important');
    });
  }

  function offerNeedsMahjongCopy(offer) {
    var text = String((offer && offer.innerText) || '');
    if (/FBSALE|Extra 10%\s*off|Facebook Marketplace Exclusive|Mahjong Set Offer|MAHJ20/i.test(text)) {
      return true;
    }
    return text.indexOf('Mahjong Sale Ends Monday') === -1;
  }

  function applyMahjongOffer() {
    var offer = d.getElementById(OFFER_ID);
    if (!offer) return false;
    /* Always re-assert copy. Checkout layout rebuilds can put FBSALE back while
       leaving data-mc-fb-mahjong="1", which used to make us stop updating. */
    if (offer.getAttribute(APPLIED_ATTR) !== '1' || offerNeedsMahjongCopy(offer)) {
      offer.innerHTML = MAHJONG_OFFER_HTML;
      offer.setAttribute(APPLIED_ATTR, '1');
    }
    paint(offer);
    return true;
  }

  /* Keep enforcing the Mahjong banner. mc-facebook-checkout.js inserts #mc-fb-offer
     once, then checkout layout scripts can rebuild the DOM and resurrect FBSALE.
     A one-shot watch was why the banner looked right and then went wrong again. */
  function watchForOffer() {
    var startedAt = Date.now();
    var observer = null;
    var timer = null;

    function attempt() {
      applyMahjongOffer();
      /* Keep watching past the first success — only idle after the settle window. */
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        if (observer) observer.disconnect();
        if (timer) g.clearInterval(timer);
      }
    }

    attempt();
    timer = g.setInterval(attempt, 200);
    if (g.MutationObserver && d.body) {
      observer = new g.MutationObserver(attempt);
      observer.observe(d.body, { childList: true, subtree: true });
    }
    /* One late pass after checkout cards finish moving. */
    g.setTimeout(attempt, 3500);
    g.setTimeout(attempt, 6000);
  }

  function start() {
    isMahjongContext().then(function (isMahjong) {
      if (isMahjong) watchForOffer();
    });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
}(window, document));
