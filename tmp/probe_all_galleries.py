#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

PAGES = [
    ("montana", "https://stevesilver.com/product/montana-chest-sand/"),
    ("cassie set", "https://stevesilver.com/?s=cassie+bedroom+set"),
    ("cassie", "https://stevesilver.com/product/cassie-illuminating-5-drawer-chest-shimmering-pearl-finish/"),
    ("sigmund set", "https://stevesilver.com/product/sigmund-3-piece-king-bedroom-set/"),
    ("riverdale set", "https://stevesilver.com/?s=riverdale+bedroom"),
]

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def extract_gallery(html):
    out = []
    seen = set()
    for pat in (
        r'data-large_image="([^"]+)"',
        r'data-src="(https://[^"]+\.(?:jpg|jpeg|png|webp))"',
        r'src="(https://stevesilver\.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
    ):
        for m in re.finditer(pat, html, re.I):
            url = m.group(1).replace("\\/", "/")
            if url in seen or re.search(r"-700x545|-500x389|-150x|logo", url, re.I):
                continue
            seen.add(url)
            out.append(url)
    return out

for label, url in PAGES:
    print(f"\n=== {label}: {url} ===")
    html = fetch(url)
    if "product/" not in url:
        links = [l for l in dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)) if "cassie" in l.lower() or "riverdale" in l.lower()]
        for l in links[:10]:
            print(" link:", l)
    imgs = extract_gallery(html)
    for u in imgs[:12]:
        print(" ", u.rsplit("/", 1)[-1])
