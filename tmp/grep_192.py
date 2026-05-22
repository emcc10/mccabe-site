import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/192.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

for pat in [r"77743", r"77752", r"Charli", r"Laguna", r"Apartment", r"product-p", r"v-product__img", r"colors_productname"]:
    ms = re.findall(pat, html, re.I)
    print(pat, len(ms))

# any .htm product links
for m in re.finditer(r'href="(/[^"]+\.htm)"', html):
    p = m.group(1)
    if "777" in p or "apartment" in p.lower() or "charli" in p.lower():
        print(p)
