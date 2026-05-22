import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/192.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

# img tags with v-product__img in parent context
for im in re.finditer(r'<img[^>]+src="([^"]+)"[^>]*>', html, re.I):
    src = im.group(1)
    if "/photos/" not in src.lower() and "nophoto" not in src.lower():
        continue
    chunk = html[max(0, im.start() - 400) : im.start() + 200]
    href_m = re.search(r'href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"', chunk, re.I)
    if not href_m:
        href_m = re.search(r'href="(/[^"]+\.htm)"', chunk, re.I)
    href = href_m.group(1) if href_m else "?"
    if href.startswith("/"):
        href = "https://www.mccabestheaterandliving.com" + href
    pm = re.search(r"/photos/([^\"'?]+)", src, re.I)
    photo = pm.group(1) if pm else src
    if "777" in href or "apartment" in chunk.lower() or "charli" in chunk.lower():
        print(photo, href)
