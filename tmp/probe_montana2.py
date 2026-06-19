#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")

def imgs(html):
    seen = set()
    out = []
    for m in re.finditer(r'https://stevesilver\.com/wp-content/uploads/[^"\s]+\.(?:jpg|jpeg|png|webp)', html, re.I):
        u = m.group(0).replace("\\/", "/")
        if u in seen or re.search(r"-700x|-500x|-150x|logo|Logo", u, re.I):
            continue
        seen.add(u)
        if "MON900" in u.upper() or "Montana" in u:
            out.append(u)
    return out

pages = [
    "https://stevesilver.com/product/montana-4-piece-king-set-sand/",
    "https://stevesilver.com/product/montana-4-piece-queen-set-sand/",
    "https://stevesilver.com/product-category/bedroom/chests/",
]

for url in pages:
    print(f"\n=== {url} ===")
    try:
        html = fetch(url)
        mon = imgs(html)
        for u in mon[:20]:
            print(u.rsplit("/", 1)[-1])
        if not mon:
            # all gallery for set page
            all_u = []
            seen = set()
            for m in re.finditer(r'data-large_image="([^"]+)"', html):
                u = m.group(1)
                if u not in seen:
                    seen.add(u)
                    all_u.append(u.rsplit("/", 1)[-1])
            print("gallery:", all_u[:15])
    except Exception as e:
        print("ERR", e)

# probe direct image URLs
candidates = [
    "https://stevesilver.com/wp-content/uploads/2020/05/Montana_MON900CS_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2020/05/Montana_MON900CS_RS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2019/10/Montana_MON900CS_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2023/05/Montana_MON900CS_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2023/05/SteveSilverFurniture_Montana_MON900CS_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2023/05/SteveSilverFurniture_Montana_MON900CS_RS1.jpg",
]
print("\n=== direct probes ===")
for u in candidates:
    req = urllib.request.Request(u, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"OK {r.status} {u.split('/')[-1]} ({r.headers.get('Content-Length')})")
    except Exception as e:
        print(f"FAIL {u.split('/')[-1]}: {e}")
