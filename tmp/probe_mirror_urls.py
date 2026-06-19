import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver dresser photos)"}
slugs = [
    "bear-creek-mirror",
    "bear-creek-mirror-brown",
    "cassie-illuminating-glam-mirror-shimmering-pearl-finish",
    "riverdale-mirror",
    "highland-park-mirror-cathedral-white",
    "highland-park-mirror-waed-driftwood",
]
for slug in slugs:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
            "utf-8", "replace"
        )
        imgs = re.findall(r'data-large_image="([^"]+)"', html)
        print("OK", slug, len(imgs))
        for u in imgs[:5]:
            fn = u.split("/")[-1]
            kind = "ROOM" if any(x in fn.upper() for x in ("_RS", "_LS", "K4PC", "K5PC")) else "PIECE?"
            print(f"  {kind} {fn}")
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, slug)
