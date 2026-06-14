from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    for wait in [5, 10, 15, 20]:
        page.wait_for_timeout(5000)
        ot = page.evaluate("() => !!document.getElementById('options_table')")
        sel = page.evaluate("() => document.querySelectorAll('#v65-product-parent select').length")
        print(f"after {wait}s options_table={ot} selects={sel}")

    before = page.evaluate("() => document.getElementById('product_photo')?.src")
    page.click(".beanbag-swatch[data-option*='Pink']")
    page.wait_for_timeout(1500)
    after = page.evaluate("""() => ({
      img: document.getElementById('product_photo')?.src,
      label: document.getElementById('beanbag-selected-cover-name')?.textContent,
      active: document.querySelector('.beanbag-swatch.active')?.getAttribute('data-option'),
      selects: [...document.querySelectorAll('#v65-product-parent select')].map(s=>({name:s.name, val:s.value, txt:s.options[s.selectedIndex]?.text})),
    })""")
    print("click result", json.dumps(after, indent=2))
    print("img changed", before != after.get("img"))
