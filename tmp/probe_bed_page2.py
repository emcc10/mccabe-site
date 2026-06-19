import json
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://stevesilver.com/product/bear-creek-3-piece-king-bed/"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")

for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.I | re.S):
    try:
        data = json.loads(block)
        if isinstance(data, dict) and data.get("@type") == "Product":
            print("NAME:", data.get("name"))
            print("DESC:", (data.get("description") or "")[:400])
            print("SKU:", data.get("sku"))
    except json.JSONDecodeError:
        pass

m = re.search(r'class="woocommerce-product-details__short-description"[^>]*>\s*(.*?)\s*</div>', html, re.I | re.S)
if m:
    print("SHORT:", re.sub(r"<[^>]+>", " ", m.group(1)).strip()[:400])

m = re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S)
if m:
    print("TAB-DESC len:", len(m.group(1)))

m = re.search(r'Additional information.*?<table class="woocommerce-product-attributes[^"]*"[^>]*>(.*?)</table>', html, re.I | re.S)
if m:
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.I | re.S):
        th = re.search(r"<th[^>]*>(.*?)</th>", row, re.I | re.S)
        td = re.search(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if th and td:
            k = re.sub(r"<[^>]+>", "", th.group(1)).strip()
            v = re.sub(r"<[^>]+>", "", td.group(1)).strip()
            print(f"ATTR {k}: {v[:120]}")

tab = re.search(r'id="tab-additional_information"[^>]*>(.*?)(?:id="tab-|</div>\s*</div>\s*<div class="woocommerce-tabs)', html, re.I | re.S)
if tab:
    bullets = re.findall(r"<li[^>]*>(.*?)</li>", tab.group(1), re.I | re.S)
    print("BULLETS:", len(bullets))
    for b in bullets[:8]:
        print(" -", re.sub(r"<[^>]+>", " ", b).strip()[:100])

imgs = re.findall(r'data-large_image="([^"]+)"', html)
print("GALLERY:", len(imgs), [u.split("/")[-1][:40] for u in imgs[:4]])
