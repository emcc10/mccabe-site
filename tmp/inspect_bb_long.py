from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    for wait in [5, 15, 30]:
        page.wait_for_timeout(wait * 1000 if wait == 5 else (wait - 5) * 1000)
        data = page.evaluate("""() => {
          const selects = [...document.querySelectorAll('#v65-product-parent select, form select')].map(s => ({
            name: s.name, id: s.id, opts: [...s.options].slice(0,5).map(o => o.text.trim())
          }));
          const alts = [...document.querySelectorAll('[class*="alternate"], a[rel*="ProductImages"], img[id*="alternate"]')].slice(0,8);
          const altImgs = [...document.querySelectorAll('img')].filter(i => /BB-FAUX-FUR/i.test(i.src)).map(i => ({src: i.src.split('/').pop(), alt: i.alt, title: i.title}));
          return {
            wait,
            selects,
            ot: !!document.getElementById('options_table'),
            wrap: !!document.getElementById('beanbag-swatch-wrapper'),
            wrapParent: document.getElementById('beanbag-swatch-wrapper')?.parentElement?.id || document.getElementById('beanbag-swatch-wrapper')?.parentElement?.className?.slice(0,40),
            feat: !!document.getElementById('mc-pdp-features'),
            img: document.getElementById('product_photo')?.src?.split('/').pop(),
            altImgs: altImgs.slice(0,10)
          };
        }""")
        data["wait"] = wait
        print(json.dumps(data, indent=2))
