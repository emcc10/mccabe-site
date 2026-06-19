import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver nightstand photos)"}
url = "https://stevesilver.com/product/highland-park-nightstand-waed-driftwood/"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
    "utf-8", "replace"
)
for m in re.finditer(r'data-large_image="([^"]+)"', html):
    print(m.group(1).replace("\\/", "/"))
