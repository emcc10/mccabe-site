#!/usr/bin/env python3
"""Search category HTML for bb-chinchilla or bean-bag photo references."""
import re
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "x"}
CATS = [
    "/category-s/177.htm",
    "/category-s/187.htm",
    "/category-s/188.htm",
    "/category-s/175.htm",
    "/category-s/186.htm",
    "/category-s/179.htm",
    "/category-s/147.htm",
    "/bean-bag-seating-s/103.htm",
]

PATTERNS = ["bb-chinchilla", "chinchilla-1", "xl-chinchilla", "bb-nest", "bean bag", "faux fur"]

for cat in CATS:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    hits = [p for p in PATTERNS if p.lower() in html.lower()]
    if hits:
        print(cat, hits)
        # show product blocks with chinchilla
        if "chinchilla" in html.lower():
            for block in re.findall(r'<div class="v-product">.*?</div>\s*</div>\s*</div>', html, re.I | re.S):
                if "chinchilla" in block.lower():
                    t = re.search(r"v-product__title[^>]*>\s*([^<]+)", block, re.I)
                    print(" ", t.group(1).strip() if t else "?")
