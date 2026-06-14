from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    page.wait_for_timeout(10000)
    print(json.dumps(page.evaluate("""() => {
      const rows = [...document.querySelectorAll('#v65-product-parent > tbody > tr')].slice(0,6).map((tr,i) => {
        const tds = [...tr.querySelectorAll(':scope > td')].map(td => ({
          cls: td.className,
          h: Math.round(td.getBoundingClientRect().height),
          top: Math.round(td.getBoundingClientRect().top),
          bottom: Math.round(td.getBoundingClientRect().bottom),
          ids: [...td.querySelectorAll('[id]')].slice(0,8).map(n => n.id)
        }));
        return { i, h: Math.round(tr.getBoundingClientRect().height), tds };
      });
      const desc = document.getElementById('ProductDetail_ProductDetails_div2');
      return {
        rows,
        descTop: desc ? Math.round(desc.getBoundingClientRect().top) : null,
        features: !!document.getElementById('mc-pdp-features'),
        featParent: document.getElementById('mc-pdp-features')?.parentElement?.tagName,
        stackParent: document.getElementById('mc-pdp-purchase-stack')?.parentElement?.tagName
      };
    }"""), indent=2))
