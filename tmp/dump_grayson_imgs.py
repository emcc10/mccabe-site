import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}
url = "https://stevesilver.com/product/grayson-5-piece-marble-top-counter-storage-dining-set/"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode()
imgs = re.findall(r"https://stevesilver\.com/wp-content/uploads/[^\"']+\.(?:jpg|jpeg|png)", html, re.I)
for u in dict.fromkeys(imgs):
    if "logo" in u.lower() or re.search(r"-\d+x\d+\.", u, re.I):
        continue
    print(u)
