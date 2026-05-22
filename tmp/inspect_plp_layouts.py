import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

cats = [
    "/category-s/157.htm",
    "/category-s/192.htm",
    "/category-s/175.htm",
    "/category-s/179.htm",
]

for cat in cats:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    v = len(re.findall(r'class="v-product"', html, re.I))
    v65 = len(re.findall(r"v65-productDisplay", html, re.I))
    imgs = len(re.findall(r"v-product__img", html, re.I))
    photos = len(set(re.findall(r"/vspfiles/photos/([^\"'?]+)", html, re.I)))
    # try page 2
    p2 = 0
    try:
        h2 = urllib.request.urlopen(
            urllib.request.Request(SITE + cat + "?Page=2", headers=UA), timeout=90
        ).read().decode("utf-8", "replace")
        p2 = len(re.findall(r'class="v-product"', h2, re.I))
    except Exception as e:
        p2 = str(e)
    print(f"{cat}: v-product={v} page2={p2} v65={v65} v-product__img={imgs} unique_photos={photos}")
