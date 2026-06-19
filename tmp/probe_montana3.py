#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")

def full_images(html, needle=""):
    seen = set()
    out = []
    for m in re.finditer(r'https://stevesilver\.com/wp-content/uploads/[^"\s]+\.(?:jpg|jpeg|png|webp)', html, re.I):
        u = m.group(0).replace("\\/", "/")
        if re.search(r"-\d+x\d+\.", u):
            continue
        if "logo" in u.lower():
            continue
        if u in seen:
            continue
        seen.add(u)
        if needle and needle.upper() not in u.upper():
            continue
        out.append(u)
    return out

pages = {
    "montana king set": "https://stevesilver.com/product/montana-4-piece-king-set-sand/",
    "cassie chest": "https://stevesilver.com/product/cassie-illuminating-5-drawer-chest-shimmering-pearl-finish/",
    "cassie king set": "https://stevesilver.com/?s=cassie+king+bedroom",
    "sigmund set": "https://stevesilver.com/product/sigmund-3-piece-king-bedroom-set/",
    "riverdale chest": "https://stevesilver.com/product/riverdale-drawer-chest/",
}

for label, url in pages.items():
    print(f"\n=== {label} ===")
    html = fetch(url)
    if "?s=" in url:
        for l in dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)):
            if "cassie" in l.lower():
                print(" ", l)
    for u in full_images(html)[:25]:
        print(" ", u.rsplit("/", 1)[-1])

print("\n=== MON900CS needle ===")
html = fetch("https://stevesilver.com/product/montana-4-piece-king-set-sand/")
for u in full_images(html, "MON900CS"):
    print(u)
for u in full_images(html, "MON900C"):
    print(u)

# search site for MON900CS in any page
html = fetch("https://stevesilver.com/?s=Montana+Chest+Sand")
print("\n=== search Montana Chest Sand ===")
for l in dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)):
    print(l)

# try stevesilver CDN patterns from bundle components
for slug in [
    "montana-chest-sand-finish",
    "montana-chest-weathered-sand",
    "montana-5-drawer-chest-weathered-sand",
]:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = fetch(url)
        print(f"\nOK {slug}")
        for u in full_images(html)[:8]:
            print(" ", u.rsplit("/", 1)[-1])
    except Exception as e:
        print(f"FAIL {slug}: {e}")
