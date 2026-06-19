import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
html = urllib.request.urlopen(
    urllib.request.Request("https://stevesilver.com/product/highland-park-3-piece-king-bed-cathedral-white/", headers=UA),
    timeout=45,
).read().decode("utf-8", "replace")
# all upload urls on page
urls = set(re.findall(r"https://stevesilver\.com/wp-content/uploads/[^\"'\s>]+\.(?:jpg|jpeg|png|webp)", html, re.I))
for u in sorted(urls):
    n = u.split("/")[-1]
    if "HP900" in n.upper() and "RS" not in n.upper():
        print(n)
