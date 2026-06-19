import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
pages = {
    "montana": "https://stevesilver.com/product/montana-nightstand-sand/",
    "sigmund": "https://stevesilver.com/product/sigmund-nightstand/",
    "cassie": "https://stevesilver.com/product/cassie-illuminating-glam-nightstand-shimmering-pearl-finish/",
    "bear-creek": "https://stevesilver.com/product/bear-creek-nightstand/",
}
for name, url in pages.items():
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    print(f"=== {name} ===")
    seen = set()
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u = m.group(1).replace("\\/", "/")
        if u in seen:
            continue
        seen.add(u)
        fn = u.split("/")[-1]
        kind = "ROOM" if any(x in fn.upper() for x in ("_RS", "_LS", "BRREG", "K4PC", "K5PC")) else "PIECE?"
        print(f"  {kind} {fn}")
