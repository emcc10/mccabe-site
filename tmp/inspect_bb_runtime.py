from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(10000)
    print(json.dumps(page.evaluate("""() => {
      const selects = [...document.querySelectorAll('#options_table select, #v65-product-parent select')].map(s => ({
        name: s.name, opts: [...s.options].slice(0,8).map(o => o.text.trim())
      }));
      const wrap = document.getElementById('beanbag-swatch-wrapper');
      const feat = document.getElementById('mc-pdp-features');
      return {
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        selects,
        wrapParent: wrap?.parentElement?.className,
        feat: !!feat,
        featParent: feat?.parentElement?.className,
        img: document.getElementById('product_photo')?.src?.split('/').pop(),
      };
    }"""), indent=2))
