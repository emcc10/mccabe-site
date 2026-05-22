import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

def count(cat, page):
    url = SITE + cat + ("?Page=" + str(page) if page > 1 else "")
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode("utf-8", "replace")
    v = len(re.findall(r'class="v-product"', html, re.I))
    titles = len(re.findall(r"v-product__title", html, re.I))
    photos = set(re.findall(r"/vspfiles/photos/([^\"'?]+)", html, re.I))
    return v, titles, len(photos)

for cat in ["/category-s/175.htm", "/category-s/186.htm", "/category-s/177.htm", "/category-s/179.htm"]:
    print(cat)
    for p in range(1, 8):
        v, t, ph = count(cat, p)
        if v == 0 and t < 5:
            print(f"  page {p}: stop (v={v} titles={t} photos={ph})")
            break
        print(f"  page {p}: v-product={v} titles={t} photos={ph}")
