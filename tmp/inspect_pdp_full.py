from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm"

JS = """
() => {
  const out = {};
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), fs: cs.fontSize, pl: cs.paddingLeft, ml: cs.marginLeft, border: cs.border, display: cs.display};
  };
  ['#mc-pdp-brand-logo','#mc-pdp-title-right','#mc-pdp-price-stack-host','#mc-pdp-features','.mc-atc-button-wrap','input[name="btnaddtocart"]','#ProductDetail_ProductDetails_div2','.colors_descriptionbox','img#product_photo','.v65-productdetail-cartqty','#mc-surgical-qty-row','[itemprop="offers"] input[name^="QTY"]'].forEach(s => out[s]=pick(s));
  out.qtyInputs = [...document.querySelectorAll('input[name^="QTY"], input.v65-productdetail-cartqty')].map(i => ({name: i.name, id: i.id, display: getComputedStyle(i).display, vis: i.offsetParent !== null}));
  out.offersChildren = [...(document.querySelector('[itemprop="offers"]')||{children:[]}).children].map(c => c.tagName+'.'+(c.className||'').slice(0,40));
  out.ver = window.__MC_PDP_AUTH_CTA_FIX_VER__;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1200})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(9000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
