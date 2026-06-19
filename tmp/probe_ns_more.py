import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
for slug in ["bear-creek-nightstand-brown", "riverdale-nightstand", "bear-creek-4-piece-king-bedroom-set"]:
    url = f"https://stevesilver.com/product/{slug}/"
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    print(f"=== {slug} ===")
    seen = set()
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u = m.group(1).replace("\\/", "/")
        if u in seen:
            continue
        seen.add(u)
        fn = u.split("/")[-1]
        print(f"  {fn}")
