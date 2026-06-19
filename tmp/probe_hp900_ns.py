import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
u = "https://stevesilver.com/product/highland-park-nightstand-cathedral-white/"
h = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=45).read().decode()
for x in re.findall(r'data-large_image="([^"]+)"', h):
    print(x.split("/")[-1])
