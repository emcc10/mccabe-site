import json
from playwright.sync_api import sync_playwright

URLS = [
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
]

CSS = r"""
@media (min-width: 992px) {
  html body.mc-bean-bag-pdp .mc-hero-media-col {
    flex: 0 0 auto !important;
    width: min(650px, 52%) !important;
    max-width: 650px !important;
    align-items: flex-start !important;
  }
  html body.mc-bean-bag-pdp td.mc-pdp-options-td {
    flex: 1 1 auto !important;
    max-width: none !important;
    margin-left: 0 !important;
  }
}
html body.mc-bean-bag-pdp .mc-hero-media-col #product_photo,
html body.mc-bean-bag-pdp #product_photo {
  width: 100% !important; max-width: 650px !important; height: auto !important;
}
html body.mc-bean-bag-pdp #mc-pdp-brand-logo {
  width: 100% !important; max-width: none !important; margin: 0 auto 14px auto !important;
  display: flex !important; justify-content: center !important;
}
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row {
  display: flex !important; flex-direction: row !important; align-items: center !important;
  justify-content: flex-start !important; flex-wrap: wrap !important; gap: 14px !important;
  width: 100% !important; max-width: 440px !important; margin: 4px 0 10px 0 !important; padding: 0 0 0 1.1em !important;
}
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row #mc-pdp-price-stack-host {
  margin: 0 !important; padding: 0 !important; width: auto !important; max-width: none !important; flex: 0 0 auto !important;
}
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row .mc-atc-button-wrap {
  margin: 0 !important; flex: 0 0 auto !important; padding: 7px 14px !important; gap: 7px !important;
  font-size: 12px !important; line-height: 1.2 !important; width: auto !important; max-width: none !important;
}
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row .mc-atc-button-wrap input,
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row .mc-atc-button-wrap button {
  font-size: 12px !important; padding: 0 !important; line-height: 1.2 !important;
}
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row .mc-pdp-stack-retail-amt,
html body.mc-bean-bag-pdp #mc-pdp-price-atc-row .product_list_price { color: #777 !important; }
html body.mc-bean-bag-pdp #mc-pdp-qty-row,
html body.mc-bean-bag-pdp #mc-pdp-purchase-stack { display: none !important; }
html body.mc-bean-bag-pdp #mc-pdp-description-below-features {
  display: block !important; width: 100% !important; max-width: 440px !important;
  margin: 10px 0 0 0 !important; padding: 0 0 0 1.1em !important; text-align: left !important; box-sizing: border-box !important;
}
html body.mc-bean-bag-pdp #mc-pdp-description-below-features #ProductDetail_ProductDetails_div,
html body.mc-bean-bag-pdp #mc-pdp-description-below-features #product_description {
  display: block !important; visibility: visible !important; height: auto !important; width: 100% !important; max-width: 100% !important;
  margin: 0 !important; padding: 0 !important; font-family: Inter, Arial, sans-serif !important; font-size: 14px !important; line-height: 1.55 !important; color: #444 !important;
}
html body.mc-bean-bag-pdp table.colors_descriptionbox[data-mc-empty-desc],
html body.mc-bean-bag-pdp [data-mc-empty-desc] { display: none !important; }
"""

REORDER = r"""
() => {
  const col = document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  if (!col) return 'no-col';
  const mediaCol = col.previousElementSibling;
  if (mediaCol && mediaCol.tagName==='TD') mediaCol.classList.add('mc-hero-media-col');
  const price = document.getElementById('mc-pdp-price-stack-host');
  const title = document.getElementById('mc-pdp-title-right');
  const atc = document.querySelector('.mc-atc-button-wrap');
  let row = document.getElementById('mc-pdp-price-atc-row');
  if (!row){ row=document.createElement('div'); row.id='mc-pdp-price-atc-row'; }
  if (title && title.parentNode===col && title.nextElementSibling!==row) col.insertBefore(row, title.nextSibling);
  else if (row.parentNode!==col) col.insertBefore(row, col.firstChild);
  if (price && price.parentNode!==row) row.insertBefore(price, row.firstChild);
  if (atc && atc.parentNode!==row) row.appendChild(atc);
  if (price && atc && price.nextElementSibling!==atc) row.insertBefore(price, atc);
  const desc = document.getElementById('ProductDetail_ProductDetails_div') || document.getElementById('ProductDetail_ProductDetails_div2');
  let host = document.getElementById('mc-pdp-description-below-features');
  if (!host){ host=document.createElement('div'); host.id='mc-pdp-description-below-features'; }
  const feat = document.getElementById('mc-pdp-features');
  const anchor = (feat && feat.parentNode===col && getComputedStyle(feat).display!=='none') ? feat : row;
  if (anchor && anchor.parentNode===col && host.previousElementSibling!==anchor) { if(anchor.nextSibling) col.insertBefore(host, anchor.nextSibling); else col.appendChild(host); }
  if (desc && desc.parentNode!==host){ const box=desc.closest('table.colors_descriptionbox'); desc.querySelectorAll('script').forEach(s=>s.remove()); host.appendChild(desc); if(box&&!box.contains(desc)) box.setAttribute('data-mc-empty-desc','1'); const hdr=document.getElementById('Header_ProductDetail_ProductDetails'); if(hdr) hdr.setAttribute('data-mc-empty-desc','1'); }
  const qr=document.getElementById('mc-pdp-qty-row'); if(qr) qr.remove();
  return 'ok';
}
"""

MEASURE = r"""
() => {
  const rect = (el) => { if(!el) return null; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),disp:cs.display,ta:cs.textAlign}; };
  const photo=document.getElementById('product_photo');
  const mediaTd=photo?photo.closest('td'):null;
  const optTd=document.querySelector('#v65-product-parent td.mc-pdp-options-td');
  const row=document.getElementById('mc-pdp-price-atc-row');
  const desc=document.getElementById('ProductDetail_ProductDetails_div')||document.getElementById('ProductDetail_ProductDetails_div2');
  const feat=document.getElementById('mc-pdp-features');
  return {
    gapVisual: (photo&&optTd)?Math.round(optTd.getBoundingClientRect().left - photo.getBoundingClientRect().right):null,
    photo: rect(photo), mediaTd: rect(mediaTd), optTd: rect(optTd),
    logo: rect(document.getElementById('mc-pdp-brand-logo')),
    logoImg: rect(document.querySelector('#mc-pdp-brand-logo img')),
    title: rect(document.getElementById('mc-pdp-title-right')),
    priceRow: rect(row),
    price: rect(document.getElementById('mc-pdp-price-stack-host')),
    atc: rect(document.querySelector('#mc-pdp-price-atc-row .mc-atc-button-wrap')),
    priceLeftOfAtc: (function(){const p=document.getElementById('mc-pdp-price-stack-host');const a=document.querySelector('#mc-pdp-price-atc-row .mc-atc-button-wrap');return (p&&a)?(p.getBoundingClientRect().right<=a.getBoundingClientRect().left+2):null;})(),
    features: rect(feat),
    descHost: rect(document.getElementById('mc-pdp-description-below-features')),
    descInOpt: (optTd&&desc)?optTd.contains(desc):null,
    descBelowFeatures: (function(){const d=document.getElementById('mc-pdp-description-below-features');if(!d||!feat||getComputedStyle(feat).display==='none')return 'noFeat';return d.getBoundingClientRect().top>=feat.getBoundingClientRect().top;})(),
    related: rect(document.getElementById('v65-product-related')),
    qtyVisible: (function(){const q=document.getElementById('mc-pdp-qty-row');return q?getComputedStyle(q).display!=='none':false;})(),
    bodyText: document.body.innerText.includes('Related Items'),
  };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    for i, url in enumerate(URLS):
        pg = b.new_page(viewport={"width": 1440, "height": 1400})
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(11000)
        pg.add_style_tag(content=CSS)
        print("\n====", url, "reorder:", pg.evaluate(REORDER))
        pg.wait_for_timeout(800)
        print(json.dumps(pg.evaluate(MEASURE), indent=2))
        shot = f"tmp/after_{i}.png"
        pg.screenshot(path=shot, clip={"x": 0, "y": 80, "width": 1440, "height": 900})
        print("screenshot:", shot)
        pg.close()
    b.close()
