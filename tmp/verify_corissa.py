import re
import urllib.request

UA = {"User-Agent": "x"}
for slug in ["77500-01.htm", "77500-01"]:
    url = f"https://www.mccabestheaterandliving.com/product-p/{slug}"
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode(
        "utf-8", "replace"
    )
    m = re.search(r'id="product_photo"[^>]*src="([^"]+)"', html, re.I)
    print(url, m.group(1) if m else "no id=product_photo")
