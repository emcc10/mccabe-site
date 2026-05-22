import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/177.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

# pagination-ish links
for pat in [
    r'href="([^"]*(?:page|Page|offset|start)[^"]*)"',
    r"pagination",
    r"Next",
    r"Showing",
    r"products found",
    r"Records",
]:
    hits = re.findall(pat, html, re.I)
    if hits:
        print(pat, ":", hits[:8] if isinstance(hits[0], str) else hits[:3])

# subcategories on 135
html135 = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/135.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")
subs = sorted(set(re.findall(r"/category-s/(\d+)\.htm", html135)))
print("135 subcats:", subs)
