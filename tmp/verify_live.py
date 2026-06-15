import json
from playwright.sync_api import sync_playwright

URLS = [
    ("bb", "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"),
    ("sar", "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"),
]

MEASURE = r"""
() => {
  const rect = (el) => { if(!el) return null; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),disp:cs.display,color:cs.color}; };
  const photo=document.getElementById('product_photo');
  const optTd=document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  const row=document.getElementById('mc-pdp-price-atc-row');
  const price=document.getElementById('mc-pdp-price-stack-host');
  const atc=document.querySelector('#mc-pdp-price-atc-row .mc-atc-button-wrap');
  const feat=document.getElementById('mc-pdp-features');
  const descHost=document.getElementById('mc-pdp-description-below-features');
  return {
    ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
    heroReady: document.body.classList.contains('mc-pdp-hero-ready'),
    gapVisual: (photo&&optTd)?Math.round(optTd.getBoundingClientRect().left - photo.getBoundingClientRect().right):null,
    photo: rect(photo), optTd: rect(optTd),
    logo: rect(document.getElementById('mc-pdp-brand-logo')),
    logoImg: rect(document.querySelector('#mc-pdp-brand-logo img')),
    title: rect(document.getElementById('mc-pdp-title-right')),
    priceRow: rect(row),
    price: rect(price),
    atc: rect(atc),
    atcInRow: !!(row && atc && row.contains(atc)),
    priceLeftOfAtc: (price&&atc)?(price.getBoundingClientRect().right<=atc.getBoundingClientRect().left+4):null,
    priceColor: price?getComputedStyle(price.querySelector('*')||price).color:null,
    features: rect(feat),
    descHost: rect(descHost),
    descInOpt: (optTd&&descHost)?optTd.contains(descHost):null,
    descBelowFeatures: (descHost&&feat&&getComputedStyle(feat).display!=='none')?(descHost.getBoundingClientRect().top>=feat.getBoundingClientRect().top):'noFeat',
    qtyShown: (function(){const q=document.querySelector('input[name^=\"QTY.\"],input[name=\"QTY\"]');if(!q)return 'none';const r=q.getBoundingClientRect();return (r.width>5&&r.height>5);})(),
    relatedShown: !!document.getElementById('v65-product-related'),
    hasText: document.body.innerText.includes('ADD TO CART') || document.body.innerText.includes('Add to Cart') || document.body.innerText.toLowerCase().includes('add to cart'),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for tag, url in URLS:
        pg = b.new_page(viewport={"width": 1440, "height": 1500})
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(12000)
        print("\n====", tag, url)
        print(json.dumps(pg.evaluate(MEASURE), indent=2))
        pg.screenshot(path=f"tmp/live_{tag}.png", clip={"x": 0, "y": 80, "width": 1440, "height": 1000})
        pg.close()
    b.close()
