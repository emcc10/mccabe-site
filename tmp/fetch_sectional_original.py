import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/product-p/alula-sc-07-15.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")
for pat in [
    r'/v/vspfiles/photos/[^"\']+',
    r'productphoto[^"\']+',
    r'og:image" content="([^"]+)"',
]:
    hits = re.findall(pat, html, re.I)
    if hits:
        print(pat, hits[:5])
