from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    page.wait_for_timeout(10000)
    print(json.dumps(page.evaluate("""() => {
      const desc = document.getElementById('ProductDetail_ProductDetails_div2');
      const img = document.getElementById('product_photo');
      const heroRow = document.querySelector('#v65-product-parent > tbody > tr:nth-of-type(2)');
      const mediaTd = heroRow ? heroRow.querySelector('td:first-child') : null;
      const optTd = heroRow ? heroRow.querySelector('td:last-child') : null;
      function chain(el) {
        const out = [];
        let n = el;
        while (n && n !== document.body) {
          out.push((n.tagName || '') + (n.id ? '#'+n.id : '') + (n.className ? '.'+String(n.className).split(' ').slice(0,2).join('.') : ''));
          n = n.parentElement;
        }
        return out.slice(0,8);
      }
      return {
        descChain: chain(desc),
        imgChain: chain(img).slice(0,5),
        mediaTdH: mediaTd ? Math.round(mediaTd.getBoundingClientRect().height) : null,
        optTdH: optTd ? Math.round(optTd.getBoundingClientRect().height) : null,
        heroRowH: heroRow ? Math.round(heroRow.getBoundingClientRect().height) : null,
        descParentTag: desc && desc.parentElement ? desc.parentElement.tagName : null,
        mediaCanContain: mediaTd && desc ? mediaTd.contains(desc) : false
      };
    }"""), indent=2))
