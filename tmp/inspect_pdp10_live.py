"""Inspect live PDP: script version, DOM nodes, computed layout."""
import json
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("NO_PLAYWRIGHT")
    sys.exit(1)

URLS = [
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    "https://www.mccabestheaterandliving.com/product-p/saranoni-throw.htm",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for url in URLS:
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(5000)
        except Exception as e:
            print(url, "LOAD_ERR", e)
            continue

        data = page.evaluate(
            """() => {
          function cs(el) {
            if (!el) return null;
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              display: s.display,
              visibility: s.visibility,
              textAlign: s.textAlign,
              fontSize: s.fontSize,
              fontFamily: s.fontFamily,
              width: r.width,
              left: r.left,
            };
          }
          const stack = document.getElementById('mc-pdp-purchase-stack');
          const qty = document.getElementById('mc-pdp-qty-row');
          const atc = document.querySelector('.mc-atc-button-wrap, .v65-product-addtocart');
          const feat = document.getElementById('mc-pdp-features');
          const desc = document.querySelector('#ProductDetail_ProductDetails_div2 li, #ProductDetail_ProductDetails_div2 span[itemprop="description"] li');
          const title = document.getElementById('mc-pdp-title-right');
          const priceHost = document.getElementById('mc-pdp-price-stack-host');
          const scripts = Array.from(document.querySelectorAll('script[src*="mc-pdp-auth"]')).map(s => s.src);
          return {
            url: location.href,
            bodyClass: document.body.className,
            ver: window.__MC_PDP_AUTH_CTA_FIX_VER__ || null,
            heroReady: document.body.classList.contains('mc-pdp-hero-ready'),
            scripts,
            hasStack: !!stack,
            stackParent: stack && stack.parentElement ? (stack.parentElement.id || stack.parentElement.className || stack.parentElement.tagName) : null,
            stackAfterFeatures: !!(feat && stack && feat.nextElementSibling === stack),
            qty: cs(qty),
            atc: cs(atc),
            stack: cs(stack),
            feat: cs(feat),
            desc: cs(desc),
            title: cs(title),
            priceHost: cs(priceHost),
            titleLeft: title ? title.getBoundingClientRect().left : null,
            atcLeft: atc ? atc.getBoundingClientRect().left : null,
            featLeft: feat ? feat.getBoundingClientRect().left : null,
            optionsTd: cs(document.querySelector('td.mc-pdp-options-td, [itemprop="offers"]')),
          };
        }"""
        )
        print("===", url.split("/")[-1], "===")
        print(json.dumps(data, indent=2))

    browser.close()
