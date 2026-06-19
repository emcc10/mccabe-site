import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
slugs = [
    "bear-creek-dresser",
    "bear-creek-dresser-brown",
    "bear-creek-dresser-and-mirror",
    "cassie-illuminating-glam-dresser-shimmering-pearl-finish",
    "cassie-illuminating-glam-58-dresser-shimmering-pearl-finish",
    "montana-dresser-sand",
    "montana-dresser-and-mirror-sand",
    "riverdale-dresser",
    "riverdale-6-drawer-dresser",
    "sigmund-dresser",
    "sigmund-6-drawer-dresser",
]
for slug in slugs:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
            "utf-8", "replace"
        )
        imgs = re.findall(r'data-large_image="([^"]+)"', html)
        print("OK", slug, len(imgs), imgs[0].split("/")[-1][:70] if imgs else "")
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, slug)
