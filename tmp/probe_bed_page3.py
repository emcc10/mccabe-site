import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://stevesilver.com/product/bear-creek-3-piece-king-bed/"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")

for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.I | re.S):
    try:
        data = json.loads(block)
    except json.JSONDecodeError:
        continue
    items = data if isinstance(data, list) else [data]
    if isinstance(data, dict) and "@graph" in data:
        items = data["@graph"]
    for item in items:
        if isinstance(item, dict) and item.get("@type") == "Product":
            print("NAME:", item.get("name"))
            print("DESC:", (item.get("description") or "")[:500])
            print("SKU:", item.get("sku"))

m = re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S)
if m:
    body = m.group(1)
    print("TAB:", re.sub(r"<[^>]+>", "\n", body).strip()[:800])

m = re.search(r'Additional information.*?<table class="woocommerce-product-attributes[^"]*"[^>]*>(.*?)</table>', html, re.I | re.S)
if m:
    print("--- ATTRS ---")
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.I | re.S):
        th = re.search(r"<th[^>]*>(.*?)</th>", row, re.I | re.S)
        td = re.search(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if th and td:
            k = re.sub(r"<[^>]+>", "", th.group(1)).strip()
            v = re.sub(r"<[^>]+>", "", td.group(1)).strip()
            print(f"{k}: {v}")

# features list in description tab
if m := re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S):
    bullets = re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.I | re.S)
    print("BULLETS in desc:", len(bullets))
    for b in bullets:
        print(" *", re.sub(r"<[^>]+>", " ", b).strip())
