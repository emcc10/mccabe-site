import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver chest photos)"}
pages = {
    "SS-BC900DR": "https://stevesilver.com/product/bear-creek-dresser/",
    "SS-BC950DRB": "https://stevesilver.com/product/bear-creek-dresser-brown-2/",
    "SS-CAS900DR": "https://stevesilver.com/product/cassie-illuminating-glam-58-dresser-shimmering-pearl-finish/",
    "SS-MON900DRST": "https://stevesilver.com/product/montana-dresser-sand/",
    "SS-RV900DR": "https://stevesilver.com/product/riverdale-dresser/",
    "SS-SIG900DR": "https://stevesilver.com/product/sigmund-6-drawer-dresser/",
}
room_pages = {
    "SS-BC900DR": "https://stevesilver.com/product/bear-creek-4-piece-king-setk-bed-ns-dresser-mir/",
    "SS-BC950DRB": "https://stevesilver.com/product/bear-creek-brown-4-piece-king-set/",
    "SS-CAS900DR": "https://stevesilver.com/product/cassie-illuminating-4-piece-glam-king-set/",
    "SS-MON900DRST": "https://stevesilver.com/product/montana-4-piece-king-set-sand/",
    "SS-RV900DR": "https://stevesilver.com/product/riverdale-4-piece-king-storage-bedroom-set/",
    "SS-SIG900DR": "https://stevesilver.com/product/sigmund-3-piece-king-bedroom-set/",
}
for code, url in pages.items():
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    print(f"=== {code} piece page ===")
    seen = set()
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u = m.group(1).replace("\\/", "/")
        if u in seen:
            continue
        seen.add(u)
        fn = u.split("/")[-1]
        kind = "ROOM" if any(x in fn.upper() for x in ("_RS", "_LS", "BRREG", "K4PC", "K5PC", "KS4PC")) else "PIECE"
        print(f"  {kind} {fn}")

for code, url in room_pages.items():
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
            "utf-8", "replace"
        )
    except urllib.error.HTTPError as e:
        print(f"=== {code} room page HTTP {e.code} ===")
        continue
    print(f"=== {code} room page ===")
    seen = set()
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u = m.group(1).replace("\\/", "/")
        if u in seen:
            continue
        seen.add(u)
        fn = u.split("/")[-1]
        if any(x in fn.upper() for x in ("_RS", "_LS", "BRREG", "K4PC", "K5PC", "DR", "DRESS")):
            print(f"  {fn}")
