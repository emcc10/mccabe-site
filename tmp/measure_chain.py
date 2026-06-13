from playwright.sync_api import sync_playwright
import json

PDP = "https://www.mccabestheaterandliving.com/Trento-Grey-Leather-Sofa-p/trento%20grey%20leather%20sofa.htm"

JS = """
() => {
  const photo = document.getElementById('product_photo') || document.querySelector('img#main-image');
  const chain = [];
  let el = photo;
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    chain.push({
      tag: el.tagName, id: el.id || '', cls: (el.className||'').toString().slice(0,60),
      top: Math.round(r.top), pt: cs.paddingTop, mt: cs.marginTop, h: Math.round(r.height)
    });
    el = el.parentElement;
  }
  const title = document.getElementById('mc-pdp-title-right');
  const chain2 = [];
  el = title;
  while (el && el !== document.body) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    chain2.push({
      tag: el.tagName, id: el.id || '', cls: (el.className||'').toString().slice(0,60),
      top: Math.round(r.top), pt: cs.paddingTop, mt: cs.marginTop
    });
    el = el.parentElement;
  }
  return {photoChain: chain, titleChain: chain2};
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(PDP, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(5000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
