#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
MISSING = (
    "Denali Rocker",
    "Denali Wallhugger",
    "Denali Swivel Glider Recliner",
    "Pinecrest Swivel Glider Power",
    "Henry Wallhugger",
    "Denali Power Rocker",
)

for page in (1, 2, 3):
    html = urllib.request.urlopen(
        urllib.request.Request(f"{SITE}/searchresults.asp?cat=186&page={page}", headers=UA),
        timeout=90,
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
        if not any(t.startswith(m) for m in MISSING):
            continue
        sku = re.search(r"product-p/([^\.]+)", href.group(1), re.I).group(1).upper()
        i = (img.group(1) if img else "").split("/")[-1]
        print(f"{t} | {sku} | {i}")
