import json
from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(6000)

    data = page.evaluate(
        """() => {
      const btn = document.querySelector('input[name="btnaddtocart"], button[name="btnaddtocart"]');
      const wrap = document.querySelector('.mc-atc-button-wrap');
      const qty = document.querySelector('input.v65-productdetail-cartqty, input[name^="QTY."], #mc-pdp-qty-row input');
      const stack = document.getElementById('mc-pdp-purchase-stack');
      const feat = document.getElementById('mc-pdp-features');
      const div2 = document.getElementById('ProductDetail_ProductDetails_div2');
      const descLi = document.querySelector('#ProductDetail_ProductDetails_div2 li, span[itemprop="description"] li');
      const offers = document.querySelector('[itemprop="offers"]');
      function path(el) {
        if (!el) return null;
        const parts = [];
        let n = el;
        for (let i = 0; i < 8 && n; i++) {
          parts.push((n.id ? '#' + n.id : '') || (n.className ? '.' + String(n.className).split(' ')[0] : '') || n.tagName);
          n = n.parentElement;
        }
        return parts.join(' < ');
      }
      return {
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        hasMcMount: typeof window.mcMountPdpFeaturesBlock,
        btn: btn ? { tag: btn.tagName, type: btn.type, parent: path(btn) } : null,
        wrap: wrap ? { parent: path(wrap) } : null,
        qty: qty ? { id: qty.id, parent: path(qty), rowId: qty.closest('#mc-pdp-qty-row')?.id } : null,
        stack: stack ? path(stack) : null,
        feat: feat ? { display: getComputedStyle(feat).display, html: feat.innerHTML.slice(0,200) } : null,
        div2: div2 ? { display: getComputedStyle(div2).display, textLen: div2.textContent.length } : null,
        descLi: descLi ? { font: getComputedStyle(descLi).font, text: descLi.textContent.slice(0,80) } : null,
        offersPath: path(offers),
        atcBlock: path(document.querySelector('.v65-product-addtocart')),
        qtyRow: path(document.getElementById('mc-pdp-qty-row')),
        errors: window.__MC_PDP_PATCH_ERR__ || null,
      };
    }"""
    )
    print(json.dumps(data, indent=2))

    # Try calling our global functions if exposed
    data2 = page.evaluate(
        """() => {
      const out = {};
      try { if (typeof window.mcMountPdpFeaturesBlock === 'function') window.mcMountPdpFeaturesBlock(); out.mountedFeatures = !!document.getElementById('mc-pdp-features'); } catch(e) { out.featErr = String(e); }
      return out;
    }"""
    )
    print("after manual mount:", json.dumps(data2))
    browser.close()
