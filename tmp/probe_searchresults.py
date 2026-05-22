import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

def titles(url):
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    t = [
        x.strip()
        for x in re.findall(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", html, re.I | re.S)
    ]
    return t

cat_id = "177"
for p in range(1, 6):
    for tmpl in [
        f"/searchresults.asp?cat={cat_id}&page={p}",
        f"/searchresults.asp?Category={cat_id}&page={p}",
        f"/category-s/{cat_id}.htm?Page={p}",
        f"/category-s/{cat_id}.htm?page={p}",
    ]:
        url = SITE + tmpl
        try:
            t = titles(url)
            if t:
                print(f"p{p} {tmpl[-40:]:40} n={len(t)} first={t[0][:40]}")
        except Exception as e:
            print(f"ERR {tmpl} {e}")
