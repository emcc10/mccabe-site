#!/usr/bin/env python3
import re
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/175.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")

BLOCK = re.compile(r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', re.I | re.S)
TITLE = re.compile(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", re.I | re.S)
IMG = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
PHOTO = re.compile(r"/photos/([^\"'?]+)", re.I)

for block in BLOCK.findall(html):
    t = TITLE.search(block)
    im = IMG.search(block)
    if not t:
        continue
    title = t.group(1).strip()
    photo = ""
    if im:
        pm = PHOTO.search(im.group(1))
        if pm:
            photo = pm.group(1)
    if "sofa" in title.lower() or "sectional" in title.lower() or "loveseat" in title.lower():
        flag = ""
        if re.search(r"chinchilla|bb-|bean", photo, re.I):
            flag = " *** BEAN BAG PHOTO ***"
        print(f"{title} | {photo}{flag}")
