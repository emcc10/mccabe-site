from playwright.sync_api import sync_playwright
import json

PDP = "https://www.mccabestheaterandliving.com/Double-Ruched-Faux-Fur-Throw-Blankets-p/double%20ruched%20faux%20fur%20throw%20blankets.htm"

JS = """
() => {
  const out = {};
  const sels = ['#mc-pdp-brand-logo','#mc-pdp-title-right','img#product_photo','.mc-atc-button-wrap',
    'input[name="btnaddtocart"]','#mc-pdp-features'];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[sel] = {
      top: Math.round(r.top), left: Math.round(r.left),
      w: Math.round(r.width), h: Math.round(r.height),
      fontSize: cs.fontSize,
      border: cs.border,
      borderColor: cs.borderColor,
      borderRadius: cs.borderRadius
    };
  }
  const imgs = [...document.querySelectorAll('#v65-product-parent img, #content_area img')]
    .filter(i => i.id !== 'product_photo' && !/^alternate_/.test(i.id||''))
    .slice(0, 12)
    .map(i => ({
      id: i.id,
      src: (i.getAttribute('src')||'').slice(-90),
      alt: (i.alt||'').slice(0,50),
      w: i.naturalWidth||i.width,
      parent: i.parentElement ? i.parentElement.className : '',
      inMedia: !!(i.closest && i.closest('td.mc-pdp-media-td'))
    }));
  out.candidateImgs = imgs;
  out.logoFn = typeof window.mcPlaceBrandLogoAboveTitle;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(PDP, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(8000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
