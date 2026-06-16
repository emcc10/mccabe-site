#!/usr/bin/env python3
"""Inspect live PDP HTML for features li vs description p structure and CSS hits."""
from __future__ import annotations

import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe typography inspect)"}
URL = "https://www.mccabestheaterandliving.com/product-p/sar-lush-xl-lg.htm"


def fetch(url: str) -> str:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode(
        "utf-8", "replace"
    )


html = fetch(URL)

# Find mc-pdp-features block
feat = re.search(r'(<div[^>]*id="mc-pdp-features"[^>]*>.*?</div>\s*</div>)', html, re.I | re.S)
if feat:
    block = feat.group(1)[:3000]
    print("=== mc-pdp-features snippet ===")
    print(block[:2000])
    li = re.search(r'<li[^>]*>([^<]{0,120})', block)
    if li:
        print("\nFirst li tag:", li.group(0)[:200])

# Description area
for pat in [
    r'id="mc-pdp-description-below-features"[^>]*>(.{0,2500})',
    r'id="product_description"[^>]*>(.{0,1500})',
    r'id="ProductDetail_ProductDetails_div"[^>]*>(.{0,2500})',
]:
    m = re.search(pat, html, re.I | re.S)
    if m:
        print(f"\n=== {pat[:40]} ===")
        print(m.group(0)[:1800])

# Script version
m = re.search(r"mc-pdp-auth-cta-fix\.js\?v=([^\"']+)", html)
print("\nJS version:", m.group(1) if m else "NOT FOUND")

# custom-safe link
m = re.search(r"custom-safe\.css[^\"']*", html)
print("CSS ref:", m.group(0)[:80] if m else "NOT FOUND")

# Count typography rules in inline styles for description
inline_blocks = re.findall(r"<style[^>]*>(.*?)</style>", html, re.I | re.S)
rules_hitting = []
needles = [
    r"mc-pdp-features__list\s+li",
    r"ProductDetail_ProductDetails_div\s+p",
    r"itemprop=.description",
    r"product_description",
    r"mc-pdp-description-below-features",
    r"span\[itemprop=.description.\]",
    r"\.productdetails\s+span\[itemprop",
    r"#v65-product-parent\s+p",
]
for i, block in enumerate(inline_blocks):
    for n in needles:
        if re.search(n.replace(".", r"\."), block, re.I):
            rules_hitting.append((i, n))
print("\nInline style blocks matching needles:", len(rules_hitting))
for item in rules_hitting[:20]:
    print(" ", item)

# Fetch custom-safe and grep conflicting rules
css = fetch("https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css")
print("\n=== custom-safe deploy marker ===", css.split("\n")[0][:120])
for pat in [
    "mc-pdp-features__list li",
    "mc-pdp-description-below-features",
    "ProductDetail_ProductDetails_div p",
    "span[itemprop=\"description\"]",
    "font-weight: 300px",
    "SHARED FEATURES",
]:
    print(f"  {pat!r}: {pat in css}")
