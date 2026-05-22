import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

urls = [
    "/category-s/192.htm",
    "/Apartment-Sofas-s/192.htm",
    "/productslist.asp?category=192",
    "/productslist.asp?CategoryID=192",
    "/searchresults.asp?cat=177&page=2",
    "/category-s/177.htm&Page=2",
    "/category-s/177/pg/2",
    "/category-s/177/page/2",
]

for path in urls:
    url = SITE + path if path.startswith("/") else SITE + "/" + path
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(url, headers=UA), timeout=60
        ).read().decode("utf-8", "replace")
        vp = len(re.findall(r'class="v-product"', html, re.I))
        tit = len(re.findall(r"v-product__title", html, re.I))
        print(f"OK {path[:50]:50} v-product={vp} titles={tit}")
    except Exception as e:
        print(f"ERR {path[:50]:50} {e}")
