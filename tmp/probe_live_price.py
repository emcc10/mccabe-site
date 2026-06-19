import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://www.mccabestheaterandliving.com/product-p/ss-hy500pt.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode(
    "utf-8", "replace"
)
for pat in [
    r"listprice\s*=\s*['\"]([\d.]+)",
    r"productprice\s*=\s*['\"]([\d.]+)",
    r"VCompare\('([^']+)',\s*([\d.]+)\)",
    r"colors_productprice[^>]*>\s*\$?\s*([\d,]+)",
    r"product_price[^>]*>\s*\$?\s*([\d,]+)",
]:
    m = re.search(pat, html, re.I)
    print(pat[:50], "->", m.group(1) if m else None)
idx = html.find("colors_price")
print("snippet:", html[idx : idx + 600] if idx >= 0 else "none")
