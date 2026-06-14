"""Inspect bean bag swatch visibility on live PDP."""
import json
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("playwright not installed")
    sys.exit(1)

URL = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(3000)

    data = page.evaluate(
        """() => {
      const wrap = document.getElementById('beanbag-swatch-wrapper');
      const swatches = document.querySelectorAll('.beanbag-swatch');
      const opts = document.getElementById('options_table');
      const desc = document.getElementById('ProductDetail_ProductDetails_div2');
      function info(el) {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          id: el.id || null,
          className: el.className || null,
          parentId: el.parentElement && el.parentElement.id,
          parentTag: el.parentElement && el.parentElement.tagName,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          height: cs.height,
          width: cs.width,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
          moved: el.dataset && el.dataset.moved,
        };
      }
      const swatchInfos = [];
      swatches.forEach((s, i) => {
        if (i > 2) return;
        const cs = getComputedStyle(s);
        const r = s.getBoundingClientRect();
        swatchInfos.push({
          alt: s.alt,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          rect: { width: r.width, height: r.height, top: r.top },
        });
      });
      return {
        bodyClass: document.body.className,
        wrap: info(wrap),
        swatchCount: swatches.length,
        swatchSamples: swatchInfos,
        optionsTable: info(opts),
        desc: info(desc),
        pdpVer: window.__MC_PDP_AUTH_CTA_FIX_VER__ || null,
      };
    }"""
    )

    print(json.dumps(data, indent=2))
    browser.close()
