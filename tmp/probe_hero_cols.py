#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
for label, url in [
    ("sectional", "https://www.mccabestheaterandliving.com/product-p/leeds-sc-07-40.htm"),
    ("bean", "https://www.mccabestheaterandliving.com/product-p/bb-chinchilla.htm"),
    ("robe", "https://www.mccabestheaterandliving.com/product-p/sar-wearable.htm"),
]:
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode("utf-8", "replace")
    print(f"\n=== {label} ===")
    for needle in ["mc-pdp-main-row", "mc-pdp-options-td", "mc-pdp-media-td", "mc-product-shell", "product_photo_td", "mtl-product-summary"]:
        print(f"  {needle}: {needle in html}")
    btn = re.search(r"<input[^>]*name=[\"']btnaddtocart[\"'][^>]*>", html, re.I)
    print("  atc:", (btn.group(0)[:180] if btn else "none"))
