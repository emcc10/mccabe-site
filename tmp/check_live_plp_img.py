#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://www.mccabestheaterandliving.com/searchresults.asp?cat=177&page=2"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers=UA), timeout=60
).read().decode("utf-8", "replace")

blocks = re.findall(
    r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>',
    html,
    re.I | re.S,
)
for block in blocks:
    if not re.search(r"77743-01|77651-01", block, re.I):
        continue
    title = re.search(r'title="([^"]*)"', block)
    img = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)
    print(title.group(1) if title else "?", "->", img.group(1) if img else "no img")
