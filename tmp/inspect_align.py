from playwright.sync_api import sync_playwright
import json

PDP = "https://www.mccabestheaterandliving.com/Trento-Grey-Leather-Sofa-p/trento%20grey%20leather%20sofa.htm"

JS = """
() => {
  const sels = ['#mc-pdp-title-right','#mc-pdp-price-stack-host','#messaging-element','.colors_pricebox','.mc-atc-button-wrap','#mc-pdp-features'];
  const out = {};
  for (const sel of sels) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out[sel] = {left: Math.round(r.left), w: Math.round(r.width), pl: cs.paddingLeft, ml: cs.marginLeft};
  }
  const opt = document.querySelector('td.mc-pdp-options-td, td:has(#mc-pdp-title-right)');
  if (opt) {
    const cs = getComputedStyle(opt);
    out.optionsTd = {left: Math.round(opt.getBoundingClientRect().left), pl: cs.paddingLeft};
  }
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1000})
    pg.goto(PDP, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(6000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
