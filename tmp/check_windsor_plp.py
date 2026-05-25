#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
for url in [
    "https://www.mccabestheaterandliving.com/searchresults.asp?cat=177&page=3",
    "https://www.mccabestheaterandliving.com/searchresults.asp?cat=186&page=1",
]:
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=60
    ).read().decode("utf-8", "replace")
    print("===", url.split("cat=")[1], "===")
    for block in re.findall(
        r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', html, re.I | re.S
    ):
        if not re.search(r"77176|42306-31", block, re.I):
            continue
        title = re.search(r'title="([^"]*)"', block)
        img = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)
        print((title.group(1) if title else "?")[:50])
        print(" ", (img.group(1) if img else "?")[-80:])
