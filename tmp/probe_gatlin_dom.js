const https = require('https');
const { JSDOM } = require('jsdom');

// Simulate client-side without full browser - load scripts in order
const SITE = 'https://www.mccabestheaterandliving.com';
const url = SITE + '/product-p/ss-gatlin-pwr-sect.htm';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function fetchScript(path) {
  return fetch(SITE + path);
}

(async () => {
  const html = await fetch(url);
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', resources: 'usable' });
  const { window } = dom;
  const doc = window.document;

  // Minimal stubs
  window.MutationObserver = class { observe() {} disconnect() {} };
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // Extract inline isSectionalProductPage from html
  const secFnMatch = html.match(/window\.isSectionalProductPage = function[\s\S]*?return false;\s*\};/);
  if (secFnMatch) {
    window.eval(secFnMatch[0]);
  }
  console.log('isSectionalProductPage():', window.isSectionalProductPage && window.isSectionalProductPage());

  const authJs = await fetchScript('/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v=20260617pdp64');
  const unifiedJs = await fetchScript('/v/vspfiles/js/mc-unified-pdp-layout.js?v=20260617unified15');

  try {
    window.eval(authJs);
  } catch (e) {
    console.log('auth eval err', e.message);
  }
  try {
    window.eval(unifiedJs);
  } catch (e) {
    console.log('unified eval err', e.message);
  }

  if (typeof window.mcNormalizePdpLayout === 'function') {
    const ok = window.mcNormalizePdpLayout();
    console.log('mcNormalizePdpLayout returned:', ok);
  }

  const body = doc.body;
  console.log('body classes:', body.className.slice(0, 200));
  console.log('mc-pdp-unified-ready:', body.classList.contains('mc-pdp-unified-ready'));
  console.log('.mc-unified-purchase-controls:', !!doc.querySelector('.mc-unified-purchase-controls'));
  console.log('#mc-pdp-qty-row:', !!doc.querySelector('#mc-pdp-qty-row'));
  const atc = doc.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
  console.log('ATC in DOM:', !!atc);
  if (atc) {
    const style = atc.ownerDocument.defaultView.getComputedStyle(atc);
    console.log('ATC display:', style.display, 'visibility:', style.visibility);
    console.log('ATC parent chain:', atc.closest('.mc-unified-purchase-controls') ? 'in unified controls' : atc.closest('#mc-pdp-purchase-stack') ? 'in purchase stack' : 'elsewhere');
  }
  const qty = doc.querySelector('input[name^="QTY."], input.v65-productdetail-cartqty');
  console.log('qty in DOM:', !!qty);
  if (qty) {
    const qr = qty.closest('#mc-pdp-qty-row, .mc-unified-qty-row');
    console.log('qty row:', qr ? qr.id || qr.className : 'no row');
  }
})().catch((e) => console.error(e));
