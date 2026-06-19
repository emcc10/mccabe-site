import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
slugs = [
    "highland-park-king-headboard-cathedral-white",
    "highland-park-king-bed-cathedral-white",
    "highland-park-footboard-cathedral-white",
    "bear-creek-king-headboard",
]
for slug in slugs:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
    except Exception as e:
        print(slug, e)
        continue
    imgs = re.findall(r'data-large_image="([^"]+)"', html)
    print(f"\n{slug} ({len(imgs)})")
    for u in imgs[:8]:
        print(" ", u.split("/")[-1][:90])
