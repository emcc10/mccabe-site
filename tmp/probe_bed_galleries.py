import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
pages = {
    "BC900K": "https://stevesilver.com/product/bear-creek-3-piece-king-bed/",
    "HP900W": "https://stevesilver.com/product/highland-park-3-piece-king-bed-cathedral-white/",
    "HP900D-Q": "https://stevesilver.com/product/highland-park-3-piece-queen-bed-waxed-driftwood/",
    "MON-Q": "https://stevesilver.com/product/montana-queen-bed-sand/",
    "RV-Q": "https://stevesilver.com/product/riverdale-queen-storage-bed/",
}
for label, url in pages.items():
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
    imgs = re.findall(r'data-large_image="([^"]+)"', html)
    print(f"\n{label} ({len(imgs)})")
    for u in imgs:
        name = u.split("/")[-1]
        if "-300x" not in name and "-150x" not in name:
            print(" ", name[:90])
