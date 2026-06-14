from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"

JS = """
() => {
  const src = document.getElementById('ProductDetail_TechSpecs_div');
  const feat = document.getElementById('mc-pdp-features');
  const out = {
    techSpecsHtml: src ? src.innerHTML.slice(0, 3000) : null,
    techSpecsText: src ? src.textContent.replace(/\\s+/g, ' ').trim().slice(0, 1500) : null,
    liCount: src ? src.querySelectorAll('li').length : 0,
    lis: src ? [...src.querySelectorAll('li')].map(li => li.textContent.replace(/\\s+/g,' ').trim().slice(0,200)) : [],
    featuresHtml: feat ? feat.innerHTML.slice(0, 3000) : null,
    featuresLi: feat ? [...feat.querySelectorAll('li')].map(li => li.textContent.replace(/\\s+/g,' ').trim().slice(0,200)) : [],
  };
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1400, "height": 1200})
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(10000)
    print(json.dumps(pg.evaluate(JS), indent=2))
    b.close()
