from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(14000)
    data = page.evaluate(
        """() => {
      const row = document.querySelector('#v65-product-parent tr') || document.querySelector('#content_area table tr');
      const tds = [...document.querySelectorAll('#v65-product-parent tr td')].map((td,i) => ({
        i, cls: td.className, w: td.getBoundingClientRect().width,
        left: td.getBoundingClientRect().left, right: td.getBoundingClientRect().right,
        id: td.id, hasPhoto: !!td.querySelector('#product_photo')
      }));
      const mainRow = document.querySelector('tr.mc-pdp-main-row');
      return { tds, mainRow: !!mainRow, rowKids: tds.length };
    }"""
    )
    print(json.dumps(data, indent=2))
