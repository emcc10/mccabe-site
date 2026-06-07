#!/usr/bin/env python3
"""List all Palliser recliners on cat 186 with SKU and current PLP image."""
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"

rows = []
for page in (1, 2, 3):
    url = f"{SITE}/searchresults.asp?cat=186&page={page}"
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    for block in re.findall(
        r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', html, re.I | re.S
    ):
        title = re.search(r'title="([^"]*)"', block)
        href = re.search(r'href="([^"]*product-p[^"]*)"', block, re.I)
        img = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)
        if not title or not href:
            continue
        t = title.group(1).strip()
        sku = re.search(r"product-p/([^\.]+)", href.group(1), re.I).group(1).upper()
        style = sku.split("-")[0] if "-" in sku else sku
        img_name = (img.group(1) if img else "").split("/")[-1].split("?")[0]
        rows.append((style, sku, t, img_name, page))

# Palliser numeric style collections only
palliser = [r for r in rows if re.match(r"^\d{5}", r[1])]
for style, sku, t, img, page in sorted(palliser, key=lambda x: (x[0], x[1])):
    print(f"{style}\t{sku}\t{img}\tp{page}\t{t[:55]}")

print(f"\nTotal Palliser recliners: {len(palliser)}")
from collections import Counter
styles = Counter(r[0] for r in palliser)
print("By style:", dict(sorted(styles.items())))
