import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/192.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

links = re.findall(
    r'href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"',
    html,
    re.I,
)
prod = [u for u in links if "product-p" in u.lower() or "-p/" in u.lower()]
print("product links", len(prod))
for u in sorted(set(prod))[:15]:
    print(" ", u)

# img near apartment
for kw in ["apartment", "77743", "77752", "77658", "77494"]:
    if kw.lower() in html.lower():
        print("has", kw)
