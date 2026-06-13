from playwright.sync_api import sync_playwright
import json

PDP = "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm"

JS = """
() => {
  const out = {};
  const sels = ['#mc-pdp-brand-logo','#mc-pdp-title-right','#mc-pdp-price-stack-host',
    '#messaging-element','.colors_pricebox','#mc-pdp-features','img#product_photo','.mc-atc-button-wrap'];
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    out[sel] = {top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height)};
  }
  const msg = document.querySelector('#messaging-element');
  if (msg) {
    let p = msg.parentElement;
    const chain = [];
    while (p && chain.length < 6) {
      const cs = getComputedStyle(p);
      chain.push({tag: p.tagName, cls: (p.className||'').slice(0,60), pl: cs.paddingLeft, ml: cs.marginLeft, left: Math.round(p.getBoundingClientRect().left)});
      p = p.parentElement;
    }
    out.msgChain = chain;
  }
  const imgs = [...document.querySelectorAll('#v65-product-parent img')].slice(0,8).map(i => ({
    id: i.id, src: (i.src||'').slice(-80), alt: (i.alt||'').slice(0,40), w: i.naturalWidth||i.width
  }));
  out.sampleImgs = imgs;
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(PDP, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(7000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
