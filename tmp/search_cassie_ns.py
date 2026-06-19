import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
url = "https://stevesilver.com/?s=cassie+nightstand&post_type=product"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
    "utf-8", "replace"
)
for m in re.finditer(r'href="(https://stevesilver.com/product/[^"]+)"', html):
    print(m.group(1))
