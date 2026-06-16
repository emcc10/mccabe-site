from playwright.sync_api import sync_playwright

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    reqs = []
    page.on("request", lambda r: reqs.append(r.url) if r.resource_type == "image" else None)
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(5000)
    page.select_option('select[name*="___23"]', "1069")
    page.wait_for_timeout(3000)
    for u in reqs:
        if any(x in u.lower() for x in ["1069", "blossom", "lush", "swatch", "option"]):
            print(u)
