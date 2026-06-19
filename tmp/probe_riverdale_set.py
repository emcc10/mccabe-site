#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")

def full_images(html):
    seen = set()
    out = []
    for m in re.finditer(r'https://stevesilver\.com/wp-content/uploads/[^"\s]+\.(?:jpg|jpeg|png|webp)', html, re.I):
        u = m.group(0).replace("\\/", "/")
        if re.search(r"-\d+x\d+\.", u) or "logo" in u.lower():
            continue
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out

for url in [
    "https://stevesilver.com/product/riverdale-4-piece-king-storage-bedroom-set/",
    "https://stevesilver.com/product/riverdale-4-piece-queen-storage-bedroom-set/",
]:
    html = fetch(url)
    print(f"\n=== {url.split('/')[-2]} ===")
    for u in full_images(html):
        n = u.rsplit("/", 1)[-1]
        if "RV900" in n.upper() or "LS" in n.upper() or "RS" in n.upper() or "K4PC" in n.upper():
            print(" ", n)
