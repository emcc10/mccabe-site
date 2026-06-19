import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
slugs = [
    "bear-creek-nightstand",
    "bear-creek-nightstand-brown",
    "cassie-illuminating-2-drawer-nightstand-shimmering-pearl-finish",
    "cassie-illuminating-2-drawer-nightstand",
    "cassie-illuminating-nightstand-shimmering-pearl",
    "cassie-2-drawer-nightstand",
    "montana-nightstand-sand",
    "riverdale-nightstand",
    "sigmund-nightstand",
    "highland-park-nightstand-waed-driftwood",
    "highland-park-nightstand-cathedral-white",
]
for slug in slugs:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode(
            "utf-8", "replace"
        )
        if "404" in html[:500] and "not found" in html.lower():
            print("404", slug)
            continue
        imgs = re.findall(r'data-large_image="([^"]+)"', html)
        print("OK", slug, len(imgs), imgs[0].split("/")[-1][:50] if imgs else "no gallery")
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, slug)
