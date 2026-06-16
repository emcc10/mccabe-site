from playwright.sync_api import sync_playwright
import json

URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"

with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(8000)
    before = page.evaluate("() => document.getElementById('product_photo')?.src")
    page.select_option('select[name*="___23"]', "1069")  # Blossom
    page.wait_for_timeout(2000)
    after = page.evaluate(
        """() => ({
      photo: document.getElementById('product_photo')?.src,
      altviews: [...document.querySelectorAll('#altviews img')].map(i => i.src).slice(0,5)
    })"""
    )
    print("before", before)
    print("after", json.dumps(after, indent=2))
