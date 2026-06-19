import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
for slug in ["bear-creek-queen-bed", "bear-creek-king-bed-brown"]:
    html = urllib.request.urlopen(
        urllib.request.Request(f"https://stevesilver.com/product/{slug}/", headers=UA),
        timeout=45,
    ).read().decode("utf-8", "replace")
    print("\n", slug)
    for u in re.findall(r'data-large_image="([^"]+)"', html):
        n = u.split("/")[-1]
        if "RS" not in n.upper():
            print(" ", n[:95])
