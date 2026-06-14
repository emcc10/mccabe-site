from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page(viewport={"width": 1280, "height": 900})
    page.goto("https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm", wait_until="load", timeout=90000)
    page.wait_for_timeout(8000)
    mapping = {}
    for n in [2, 3, 4, 5, 6, 7]:
        page.evaluate(f"() => {{ if (typeof change_product_photo === 'function') change_product_photo({n}); }}")
        page.wait_for_timeout(300)
        src = page.evaluate("() => document.getElementById('product_photo')?.src || ''")
        mapping[n] = src.split("/")[-1].split("?")[0]
    print(mapping)
