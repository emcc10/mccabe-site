import re
import urllib.request
from playwright.sync_api import sync_playwright
import json

slugs = ["sar-lush-throw.htm", "sar-lush-xl.htm", "sar-lush-large.htm", "sar-lush-extra-large.htm", "sar-chnk-knt-lg.htm"]
base = "https://www.mccabestheaterandliving.com/product-p/"

for slug in slugs:
    url = base + slug
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=15).read().decode("utf-8", "replace")
    except Exception as e:
        print(slug, "ERR", e)
        continue
    pc = re.search(r'name="ProductCode" value="([^"]+)"', html)
    pc = pc.group(1) if pc else "?"
    sel = re.search(r'name="(SELECT___[^"]+___23)"', html)
    print(slug, pc, "select" if sel else "no-select")
    if pc != "?":
        # test first color option
        m = re.search(r'<option[^>]*value="(\d+)"[^>]*>([^<]+)</option>', html)
        if m:
            oid, label = m.group(1), m.group(2).strip()
            if oid and label:
                for path in [f"/v/vspfiles/photos/{pc}-{oid}-S.jpg", f"/v/vspfiles/photos/{pc}-2S.jpg"]:
                    u = "https://www.mccabestheaterandliving.com" + path
                    try:
                        urllib.request.urlopen(urllib.request.Request(u, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
                        print("  OK", path, label)
                    except Exception:
                        pass

# playwright on lush throw if exists
with sync_playwright() as p:
    page = p.chromium.launch(headless=True).new_page()
    for slug in ["sar-lush-throw.htm", "sar-chnk-knt-lg.htm"]:
        url = base + slug
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(10000)
            n = page.evaluate("() => document.querySelectorAll('.mc-configured-color-swatch').length")
            print("swatches", slug, n)
        except Exception as e:
            print("pw err", slug, e)
