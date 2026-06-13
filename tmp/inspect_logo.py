from playwright.sync_api import sync_playwright
import json

PDP = "https://www.mccabestheaterandliving.com/Trento-Grey-Leather-Sofa-p/trento%20grey%20leather%20sofa.htm"
PALLISER = "https://www.mccabestheaterandliving.com/Barrett-Sectional-Configuration-07-15-p/139.htm"

JS = """
() => {
  const ids = ['mc-pdp-brand-logo','mc-pdp-title-right','mc-pdp-price-stack-host','messaging-element','mc-pdp-features','product_photo'];
  const out = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) { out[id] = null; continue; }
    const r = el.getBoundingClientRect();
    out[id] = {top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width)};
  }
  const imgs = Array.from(document.querySelectorAll('#v65-product-parent img, #content_area img')).filter(img => {
    const s = ((img.src||'')+(img.alt||'')).toLowerCase();
    return /logo|brand|manufacturer|vendor/.test(s) && !/palliser|klarna|affirm|paypal|visa|master|discover|amex|clear1x1/.test(s);
  }).slice(0,5).map(img => ({id: img.id, src: (img.src||'').split('/').pop().slice(0,40), top: Math.round(img.getBoundingClientRect().top), left: Math.round(img.getBoundingClientRect().left)}));
  out.logoCandidates = imgs;
  return out;
}
"""

for url in [PDP, PALLISER]:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1000})
        pg.goto(url, wait_until="domcontentloaded", timeout=60000)
        pg.wait_for_timeout(6000)
        print("===", url.split("/")[-1], "===")
        print(json.dumps(pg.evaluate(JS), indent=2))
        b.close()
