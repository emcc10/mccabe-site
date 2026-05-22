#!/usr/bin/env python3
"""Every PLP photo on all category paths — flag if MD5 matches bb-chinchilla."""
from __future__ import annotations

import hashlib
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "x"}
BB = hashlib.md5((ROOT / "vspfiles/photos/bb-chinchilla-1.jpg").read_bytes()).hexdigest()

paths_file = ROOT / "scripts/plp_category_paths.txt"
cats = []
for line in paths_file.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line and not line.startswith("#"):
        cats.append(line if line.startswith("/") else "/" + line)

PHOTO_RE = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
TITLE_RE = re.compile(
    r'v-product__title[^>]*>\s*([^<]+?)\s*</a>.*?/photos/([^\"\'?]+)',
    re.I | re.S,
)
BLOCK = re.compile(r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', re.I | re.S)
cache: dict[str, str] = {}


def h(photo: str) -> str:
    if photo in cache:
        return cache[photo]
    url = f"{SITE}/v/vspfiles/photos/{photo}"
    try:
        data = urllib.request.urlopen(
            urllib.request.Request(url, headers=UA), timeout=60
        ).read()
        cache[photo] = hashlib.md5(data).hexdigest()
    except Exception:
        cache[photo] = ""
    return cache[photo]


hits = []
for cat in cats:
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(SITE + cat, headers=UA), timeout=90
        ).read().decode("utf-8", "replace")
    except Exception:
        continue
    for block in BLOCK.findall(html):
        if not re.search(r"sofa|sectional|loveseat", block, re.I):
            continue
        t = re.search(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", block, re.I | re.S)
        im = re.search(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", block, re.I)
        if not t or not im:
            continue
        photo = im.group(1).lower()
        if h(photo) == BB:
            link = re.search(
                r'href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"',
                block,
                re.I,
            )
            hits.append((t.group(1).strip(), photo, cat, link.group(1) if link else ""))

print(f"Bean-bag matches on sofa/sectional PLPs: {len(hits)}")
for title, photo, cat, href in hits:
    print(f"- {title} | {photo} | {cat}")
    print(f"  {href}")
