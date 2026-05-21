import re
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}


def photos_on(cat: str) -> list[str]:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    return sorted(set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I)))


for cat in ["/category-s/177.htm", "/category-s/187.htm", "/category-s/188.htm", "/category-s/139.htm"]:
    names = photos_on(cat)
    print(f"\n{cat} — {len(names)} photos")
    for p in names:
        print(f"  {p}")
