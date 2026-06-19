import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}
pages = [
    "https://stevesilver.com/dining-tables/",
    "https://stevesilver.com/outdoor-seating/",
    "https://stevesilver.com/product/grayson-5-piece-marble-top-counter-storage-dining-set/",
    "https://stevesilver.com/product/dalilah-patio-arm-chair/",
]
for page in pages:
    print("\n===", page, "===")
    html = urllib.request.urlopen(urllib.request.Request(page, headers=UA), timeout=30).read().decode()
    imgs = re.findall(r"https://stevesilver\.com/wp-content/uploads/[^\"']+\.(?:jpg|jpeg|png)", html, re.I)
    for u in dict.fromkeys(imgs):
        if "logo" in u.lower() or re.search(r"-\d+x\d+\.", u, re.I):
            continue
        name = u.rsplit("/", 1)[-1].lower()
        if any(k in name for k in ("burlington", "canova", "ramona", "molly", "karina", "fitzgerald", "fortuna", "garcia", "laurel", "lovell", "natalia", "park", "adeline", "sapphire", "grayson")):
            print(u)
