#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://www.mccabestheaterandliving.com/searchresults.asp?cat=177&page=1"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers=UA), timeout=60
).read().decode("utf-8", "replace")

blocks = re.findall(
    r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>',
    html,
    re.I | re.S,
)
for block in blocks[:5]:
    title = re.search(r'title="([^"]*)"', block)
    img = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)
    t = (title.group(1) if title else "?")[:60]
    i = img.group(1) if img else "no img"
    print(t)
    print(" ", i[:100])
    print()
