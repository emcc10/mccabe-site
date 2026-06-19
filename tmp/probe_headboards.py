import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
slugs = [
    "highland-park-king-headboard-cathedral-white",
    "highland-park-queen-headboard-cathedral-white",
    "highland-park-king-footboard-cathedral-white",
    "highland-park-queen-footboard-cathedral-white",
    "highland-park-king-headboard-waxed-driftwood",
    "highland-park-queen-headboard-waxed-driftwood",
    "bear-creek-king-headboard",
    "bear-creek-queen-headboard",
]
for slug in slugs:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
    except Exception as e:
        print(slug, "->", e)
        continue
    imgs = re.findall(r'data-large_image="([^"]+)"', html)
    print(f"{slug}: {[u.split('/')[-1] for u in imgs]}")
