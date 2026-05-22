#!/usr/bin/env python3
"""Sofa/sectionals with NoPhoto.gif on PDP (proper URL encoding)."""
from __future__ import annotations

import re
import urllib.parse
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "x"}

# from prior collect — key sofa SKUs across cats
URLS = []
# parse 177 + 188 + 179 from live quickly
import pathlib

BLOCK = re.compile(r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', re.I | re.S)
TITLE = re.compile(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", re.I | re.S)
LINK = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*v-product__title',
    re.I,
)
PDP = re.compile(r'id="product_photo"[^>]*src="([^"]+)"', re.I)

PAGE = re.compile(r"page=(\d+)", re.I)

for cat in ["/category-s/177.htm", "/category-s/188.htm", "/category-s/179.htm", "/category-s/175.htm", "/category-s/186.htm"]:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    pages = {int(m.group(1)) for m in PAGE.finditer(html)}
    chunks = [html]
    sep = "&" if "?" in cat else "?"
    for p in sorted(pages):
        if p <= 1:
            continue
        chunks.append(
            urllib.request.urlopen(
                urllib.request.Request(f"{SITE}{cat}{sep}Page={p}", headers=UA),
                timeout=90,
            )
            .read()
            .decode("utf-8", "replace")
        )
    for block in BLOCK.findall("\n".join(chunks)):
        t, l = TITLE.search(block), LINK.search(block)
        if not t or not l:
            continue
        title = t.group(1).strip()
        if not re.search(r"sofa|sectional|loveseat", title, re.I):
            continue
        URLS.append((title, l.group(1)))

seen = set()
nophoto = []
for title, href in sorted(URLS, key=lambda x: x[0].lower()):
    if href in seen:
        continue
    seen.add(href)
    safe = href  # already absolute from site
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(safe, headers=UA), timeout=90
        ).read().decode("utf-8", "replace")
    except Exception as e:
        nophoto.append((title, href, f"fetch error: {e}"))
        continue
    m = PDP.search(html)
    src = m.group(1).lower() if m else ""
    if not m or "nophoto" in src:
        nophoto.append((title, href, src or "no product_photo"))

print(f"Checked {len(seen)} URLs, NoPhoto/missing: {len(nophoto)}\n")
for title, href, src in nophoto:
    print(f"- {title}")
    print(f"  {href}")
    print(f"  PDP: {src}\n")
