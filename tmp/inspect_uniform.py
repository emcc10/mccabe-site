import json
from playwright.sync_api import sync_playwright

URLS = [
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
]

JS = r"""
() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      left: Math.round(r.left), right: Math.round(r.right),
      top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      ta: cs.textAlign, ml: cs.marginLeft, mr: cs.marginRight,
      disp: cs.display, just: cs.justifyContent, vis: cs.visibility,
    };
  };
  const photo = document.getElementById('product_photo');
  const mediaTd = photo ? photo.closest('td') : null;
  const optTd = document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  const desc = document.getElementById('ProductDetail_ProductDetails_div')
            || document.getElementById('ProductDetail_ProductDetails_div2');
  const descSpan = document.getElementById('product_description');
  const parentChainTag = (el) => {
    const out = [];
    let n = el;
    for (let i=0; i<6 && n; i++){ out.push((n.tagName||'')+(n.id?'#'+n.id:'')+(n.className&&typeof n.className==='string'?'.'+n.className.trim().split(/\s+/).slice(0,2).join('.'):'')); n=n.parentElement; }
    return out;
  };
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    beanbag: document.body.classList.contains('mc-bean-bag-pdp'),
    photo: rect(photo),
    mediaTd: rect(mediaTd),
    optTd: rect(optTd),
    gap: (mediaTd && optTd) ? Math.round(optTd.getBoundingClientRect().left - mediaTd.getBoundingClientRect().right) : null,
    logo: rect(document.getElementById('mc-pdp-brand-logo')),
    logoImg: rect(document.querySelector('#mc-pdp-brand-logo img')),
    title: rect(document.getElementById('mc-pdp-title-right')),
    price: rect(document.getElementById('mc-pdp-price-stack-host')),
    klarna: rect(document.getElementById('messaging-element')),
    swatches: rect(document.getElementById('beanbag-swatch-wrapper')),
    features: rect(document.getElementById('mc-pdp-features')),
    qtyRow: rect(document.getElementById('mc-pdp-qty-row')),
    purchaseStack: rect(document.getElementById('mc-pdp-purchase-stack')),
    atcWrap: rect(document.querySelector('.mc-atc-button-wrap')),
    desc: rect(desc),
    descSpan: rect(descSpan),
    descInMedia: (mediaTd && desc) ? mediaTd.contains(desc) : null,
    descInOpt: (optTd && desc) ? optTd.contains(desc) : null,
    descChain: parentChainTag(descSpan || desc),
    related: rect(document.getElementById('v65-product-related')),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for url in URLS:
        pg = b.new_page(viewport={"width": 1440, "height": 1200})
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(9000)
        print("\n====", url, "====")
        print(json.dumps(pg.evaluate(JS), indent=2))
        pg.close()
    b.close()
