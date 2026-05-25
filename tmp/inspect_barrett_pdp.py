#!/usr/bin/env python3
import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/Barrett-Sectional-Configuration-07-15-p/139.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")

print("=== SCRIPTS ===")
for s in re.findall(r'<script[^>]+src="([^"]+)"', html, re.I):
    if any(k in s.lower() for k in ("sectional", "mtl", "auth", "emergency", "custom-safe")):
        print(s)

h1 = re.search(r"<h1[^>]*>[\s\S]{0,200}?</h1>", html, re.I)
if h1:
    start = max(0, h1.start() - 4000)
    end = min(len(html), h1.end() + 6000)
    chunk = html[start:end]
    chunk = re.sub(r"<script[\s\S]*?</script>", "", chunk, flags=re.I)
    print("\n=== ORDER markers (position in chunk) ===")
    markers = [
        "colors_pricebox",
        "mc-pdp-retail",
        "mc-pdp-top-price-panel",
        "mc-pdp-member",
        "klarna",
        "affirm",
        "<h1",
        "product_productprice",
        "Retail Price",
    ]
    for m in markers:
        pos = chunk.lower().find(m.lower())
        if pos >= 0:
            print(f"  {pos:5d}  {m}")

    print("\n=== SNIPPETS ===")
    for m in ["mc-pdp-top-price-panel", "mc-pdp-retail-row", "mc-pdp-member-pricing"]:
        for match in re.finditer(m, chunk, re.I):
            sn = chunk[max(0, match.start() - 80) : match.end() + 200]
            sn = re.sub(r"\s+", " ", sn)
            print(f"\n--- {m} ---\n{sn[:400]}")
