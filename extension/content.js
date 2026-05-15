/**
 * Light product hints for popup prefill — prefers Open Graph, then safe fallbacks.
 * Does not traverse shadow DOM aggressively or scrape full pages.
 */

function metaContent(prop) {
  // Called only with fixed tag names/properties from this file (not user input).
  const byProp = document.querySelector(`meta[property="${prop}"]`);
  if (byProp) {
    const v = byProp.getAttribute('content');
    return v ? v.trim() : '';
  }
  const byName = document.querySelector(`meta[name="${prop}"]`);
  if (byName) {
    const v = byName.getAttribute('content');
    return v ? v.trim() : '';
  }
  return '';
}

function isElementVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 32 || r.height < 32) return false;
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
    return false;
  }
  return true;
}

function pickLargestVisibleImageUrl() {
  const imgs = document.querySelectorAll('img[src]');
  let best = { area: 0, src: '' };
  for (const img of imgs) {
    try {
      if (!isElementVisible(img)) continue;
      const r = img.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 80 * 80) continue;
      const w = img.naturalWidth || r.width;
      const h = img.naturalHeight || r.height;
      if (w < 80 || h < 80) continue;
      if (area > best.area) {
        best = { area, src: img.currentSrc || img.src };
      }
    } catch (_) {
      // Cross-origin or odd nodes — skip
    }
  }
  return best.src || '';
}

const PRICE_CHUNK = 8000;

function scrapePriceHint() {
  const roots = [];
  const main = document.querySelector('main, [role="main"], article, #content, #main');
  if (main && main.innerText && main.innerText.length) roots.push(main.innerText.slice(0, PRICE_CHUNK));
  if (roots.length === 0 && document.body) {
    roots.push(document.body.innerText.slice(0, PRICE_CHUNK));
  }
  const text = roots.join('\n');
  const patterns = [
    /\$\s*[\d,]+(?:\.\d{2})?\b/g,
    /USD\s*\$?\s*[\d,]+(?:\.\d{2})?\b/gi,
    /€\s*[\d,]+(?:\.\d{2})?\b/g,
    /£\s*[\d,]+(?:\.\d{2})?\b/g,
    /(?:^|\s)([\d,]+(?:\.\d{2})?)\s*(?:USD|EUR|GBP)(?:\s|$)/gi
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[0]) return m[0].trim().replace(/\s+/g, ' ');
  }
  const metaAmount = metaContent('product:price:amount');
  if (metaAmount) {
    const cur = metaContent('product:price:currency') || '';
    const combined = `${cur ? cur + ' ' : ''}${metaAmount}`.trim();
    return combined;
  }
  return '';
}

function collectHints() {
  const ogTitle = metaContent('og:title') || metaContent('twitter:title');
  const title = ogTitle || document.title || '';

  const ogImageRaw =
    metaContent('og:image') ||
    metaContent('og:image:url') ||
    metaContent('twitter:image') ||
    metaContent('twitter:image:src');
  let image = '';
  try {
    if (ogImageRaw) {
      image = new URL(ogImageRaw, document.baseURI).href;
    }
  } catch (_) {
    image = ogImageRaw || '';
  }
  if (!image) image = pickLargestVisibleImageUrl();

  let price = '';
  try {
    const priceNode = document.querySelector('[itemprop="price"][content], meta[itemprop="price"][content]');
    if (priceNode) price = priceNode.getAttribute('content')?.trim() || '';
    if (!price) {
      const priceEl = document.querySelector('[itemprop="price"]');
      const t = priceEl?.textContent?.trim();
      if (t && /^[$€£]?[\d,.\s]+/.test(t) && t.length < 40) price = t;
    }
  } catch (_) {
    price = '';
  }
  const ogAmount = metaContent('product:price:amount');
  if (!price && ogAmount) price = ogAmount;
  const currency = metaContent('product:price:currency');
  if (price && currency && !/^[\$€£]/.test(price)) {
    price = `${currency} ${price}`.trim();
  }
  if (!price) price = scrapePriceHint();

  const url = location.href;
  const source = location.hostname.replace(/^www\./, '');

  return {
    title: title.slice(0, 500),
    image: image.slice(0, 2000),
    price: (price || '').slice(0, 120),
    url: url.slice(0, 2000),
    source: source.slice(0, 200)
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'MCCABE_GET_PRODUCT_HINTS') {
    try {
      sendResponse({ ok: true, data: collectHints() });
    } catch (e) {
      sendResponse({ ok: false, error: String(e && e.message ? e.message : e) });
    }
    return true;
  }
  return false;
});
