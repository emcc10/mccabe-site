import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
urls = [
    "https://stevesilver.com/product/bear-creek-4-piece-king-setk-bed-ns-dresser-mir/",
    "https://stevesilver.com/product/highland-park-white-4-piece-king-setk-bed-ns-dresser-mir/",
    "https://stevesilver.com/product/bear-creek-3-piece-king-bed/",
]
for url in urls:
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
    imgs = re.findall(r'data-large_image="([^"]+)"', html)
    print("\n", url.split("/")[-2], len(imgs))
    seen = set()
    for u in imgs:
        n = u.split("/")[-1]
        if n in seen:
            continue
        seen.add(n)
        if any(x in n.upper() for x in ("RS", "DTL", "COVER")):
            tag = "ROOM/DTL"
        elif any(x in n.upper() for x in ("WS", "VG1", "KFB", "QFB", "KHB", "QHB")):
            tag = "PIECE"
        else:
            tag = "?"
        print(f"  [{tag}] {n[:95]}")
