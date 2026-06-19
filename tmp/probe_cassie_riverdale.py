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

html = fetch("https://stevesilver.com/product/cassie-illuminating-4-piece-glam-king-set/")
print("cassie king set images with CAS900 or LS or RS:")
for u in full_images(html):
    n = u.rsplit("/", 1)[-1].upper()
    if "CAS900" in n or "_LS" in n or "_RS" in n or "K4PC" in n:
        print(u.rsplit("/", 1)[-1])

# riverdale set?
for url in [
    "https://stevesilver.com/?s=riverdale+bedroom+set",
    "https://stevesilver.com/product/riverdale-3-piece-king-bedroom-set/",
]:
    try:
        html = fetch(url)
        print(f"\n{url}")
        if "?s=" in url:
            for l in dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)):
                if "riverdale" in l.lower():
                    print(" link", l)
        else:
            for u in full_images(html):
                n = u.rsplit("/", 1)[-1]
                if "RV900" in n.upper() or "LS" in n.upper() or "RS" in n.upper():
                    print(" ", n)
    except Exception as e:
        print("err", e)
