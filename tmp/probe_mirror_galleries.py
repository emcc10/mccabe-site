import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver dresser photos)"}
pages = {
    "SS-BC900MR": "https://stevesilver.com/product/bear-creek-mirror/",
    "SS-BC950MRB": "https://stevesilver.com/product/bear-creek-mirror-brown/",
    "SS-CAS900M": "https://stevesilver.com/product/cassie-illuminating-glam-mirror-shimmering-pearl-finish/",
    "SS-RV900M": "https://stevesilver.com/product/riverdale-beveled-edge-mirror/",
}
room_pages = {
    "SS-BC900MR": "https://stevesilver.com/product/bear-creek-4-piece-king-setk-bed-ns-dresser-mir/",
    "SS-BC950MRB": "https://stevesilver.com/product/bear-creek-brown-4-piece-king-set/",
    "SS-CAS900M": "https://stevesilver.com/product/cassie-illuminating-4-piece-glam-king-set/",
    "SS-RV900M": "https://stevesilver.com/product/riverdale-4-piece-king-storage-bedroom-set/",
}
for code, url in pages.items():
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "replace")
    print(f"=== {code} ===")
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        print(" ", m.group(1).split("/")[-1])
for code, url in room_pages.items():
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "replace")
    print(f"=== {code} room ===")
    seen=set()
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u=m.group(1)
        if u in seen: continue
        seen.add(u)
        fn=u.split("/")[-1]
        if any(x in fn.upper() for x in ("RS","LS","K4PC","K5PC","MR","MIRROR")):
            print(" ", fn)
