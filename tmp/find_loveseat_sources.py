import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"

# Map cat 157 thumb to product page via HTML
html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/157.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")

# product link + nearby photo
for m in re.finditer(
    r'product-p/([^"]+\.htm)[^>]*>.*?/photos/([^"?]+\.jpg)',
    html,
    re.I | re.S,
):
    print(m.group(2), "->", m.group(1))
    if len(list(re.finditer(r"product-p/", html))) > 8:
        break

# try 77170 product
for slug in ["77170-03", "77319-03", "40109-03"]:
    try:
        phtml = urllib.request.urlopen(
            urllib.request.Request(f"{SITE}/product-p/{slug}.htm", headers=UA), timeout=60
        ).read().decode("utf-8", "replace")
        photos = sorted(set(re.findall(r"/photos/([^\"'?]+\.(?:jpg|jpeg))", phtml, re.I)))
        print(f"\n{slug} photos:", photos[:8])
    except Exception as exc:
        print(slug, exc)
