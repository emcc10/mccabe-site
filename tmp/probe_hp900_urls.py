import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
for slug in ["highland-park-king-footboard-cathedral-white", "highland-park-king-headboard-cathedral-white"]:
    html = urllib.request.urlopen(
        urllib.request.Request(f"https://stevesilver.com/product/{slug}/", headers=UA),
        timeout=45,
    ).read().decode("utf-8", "replace")
    for u in re.findall(r'data-large_image="([^"]+)"', html):
        print(slug, u)
