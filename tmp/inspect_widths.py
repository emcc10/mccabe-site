from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(6000)
    print(json.dumps(page.evaluate("""() => {
      const img = document.getElementById('product_photo');
      const feat = document.getElementById('mc-pdp-features');
      const title = document.getElementById('mc-pdp-title-right');
      function path(el) {
        if (!el) return null;
        const p = [];
        let n = el;
        for (let i=0;i<6 && n;i++) {
          p.push((n.id?'#'+n.id:'') || n.className?.split?.(' ')?.[0] || n.tagName);
          n = n.parentElement;
        }
        return p.join(' < ');
      }
      function box(el) {
        if (!el) return null;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return { w: r.width, maxW: s.maxWidth, width: s.width, path: path(el) };
      }
      return {
        img: img ? { w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, maxW: getComputedStyle(img).maxWidth, attrW: img.width, attrH: img.height, natural: [img.naturalWidth, img.naturalHeight] } : null,
        feat: box(feat),
        title: box(title),
        msg: box(document.getElementById('messaging-element')),
        priceHost: box(document.getElementById('mc-pdp-price-stack-host')),
        stack: box(document.getElementById('mc-pdp-purchase-stack')),
      };
    }"""), indent=2))
