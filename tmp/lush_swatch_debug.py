from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(14000)
    data = page.evaluate(
        """() => {
      const selects = [...document.querySelectorAll('#options_table select, #v65-product-parent select')];
      return {
        ver: window.__MC_PDP_AUTH_CTA_FIX_VER__,
        wrap: !!document.getElementById('mc-configured-color-swatch-wrapper'),
        selectCount: selects.length,
        selects: selects.map(s => ({name: s.name, opts: s.options.length, hidden: s.dataset.mcConfiguredColorHidden})),
        optionsTable: !!document.getElementById('options_table'),
        optBlock: document.getElementById('mc-pdp-option-block')?.innerHTML?.slice(0,200),
        errors: window.onerror ? 'has' : 'no',
      };
    }"""
    )
    print(json.dumps(data, indent=2))
