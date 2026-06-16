#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}
SITE = "https://www.mccabestheaterandliving.com"


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode(
        "utf-8", "replace"
    )


css = fetch(f"{SITE}/v/vspfiles/css/custom-safe.css")
needles = [
    "Universal PDP Add to Cart",
    "margin: 50px 0 -40px",
    "font-weight: 300px",
    "background: transparent !important",
    "mc-atc-button-wrap input[type=\"submit\"]",
    "min-width: 180px",
    "margin-top: 20px !important",
]
print("=== LIVE custom-safe.css", len(css))
for n in needles:
    print(f"  {n!r}: {n in css}")

html = fetch(f"{SITE}/product-p/sar-lush-xl-lg.htm")
print("\n=== LIVE sar-lush-xl-lg.htm", len(html))
for pat in [
    r"mc-pdp-auth-cta-fix\.js\?v=([^\"']+)",
    r'<input[^>]*name="btnaddtocart"[^>]*>',
    r"mc-atc-button-wrap",
    r"background: transparent !important",
    r"mc-product-topbar",
]:
    m = re.search(pat, html, re.I)
    print(f"  {pat[:50]}: {(m.group(0)[:140] if m else 'NOT FOUND')}")

# count transparent inner atc rules in template inline style
inline = re.findall(r"<style[^>]*>(.*?)</style>", html, re.I | re.S)
atc_transparent = sum(s.count("background: transparent !important") for s in inline)
print(f"\n  inline style blocks: {len(inline)}, transparent !important count: {atc_transparent}")
