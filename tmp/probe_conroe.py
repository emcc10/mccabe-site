import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe)"}
for slug in [
    "conroe-dual-power-7-piece-reclining-sectional-with-chaise-cobblestone",
    "conroe-7-piece-reclining-sectional-with-chaise-cobblestone",
    "conroe-reclining-sectional-with-chaise",
]:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode()
    except Exception as e:
        print(slug, e)
        continue
    imgs = re.findall(r'data-large_image="([^"]+)"', html)
    print("\n", slug, len(imgs))
    for u in imgs[:6]:
        print(" ", u.split("/")[-1][:90])
