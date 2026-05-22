#!/usr/bin/env python3
"""Compare live PLP photo bytes to repo for cat 177 — find beanbag on live only."""
import hashlib
import re
import urllib.request
from pathlib import Path

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}
ROOT = Path(__file__).resolve().parents[1] / "vspfiles" / "photos"
BB = md5(ROOT.joinpath("bb-chinchilla-1.jpg").read_bytes()).hexdigest()

html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/177.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")

BLOCK = re.compile(r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', re.I | re.S)
TITLE = re.compile(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", re.I | re.S)
IMG = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
PHOTO = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)

for block in BLOCK.findall(html):
    t = TITLE.search(block)
    im = IMG.search(block)
    if not t or not im:
        continue
    title = t.group(1).strip()
    pm = PHOTO.search(im.group(1))
    if not pm:
        continue
    photo = pm.group(1)
    live = urllib.request.urlopen(
        urllib.request.Request(f"{SITE}/v/vspfiles/photos/{photo}", headers=UA), timeout=60
    ).read()
    lh = hashlib.md5(live).hexdigest()
    local = ROOT / photo
    if not local.is_file():
        local = ROOT / photo.lower()
    rh = hashlib.md5(local.read_bytes()).hexdigest() if local.is_file() else None
    flag = []
    if lh == BB:
        flag.append("LIVE=beanbag")
    if rh and rh == BB:
        flag.append("REPO=beanbag")
    if rh and lh != rh:
        flag.append("live!=repo")
    if flag:
        print(title, photo, ", ".join(flag))
