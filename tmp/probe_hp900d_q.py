import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://stevesilver.com/product/highland-park-3-piece-queen-bed-waxed-driftwood/",
        headers=UA,
    ),
    timeout=45,
).read().decode("utf-8", "replace")
for u in re.findall(r'data-large_image="([^"]+)"', html):
    print(u.split("/")[-1])
