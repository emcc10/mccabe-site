#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

queries = [
    "MON900CS",
    "MON900",
    "montana sand chest",
    "montana 4 drawer",
    "montana drawer chest sand",
]

for q in queries:
    url = "https://stevesilver.com/?s=" + q.replace(" ", "+")
    html = fetch(url)
    links = [l for l in dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)) if "montana" in l.lower()]
    print(f"=== {q} ===")
    for l in links[:12]:
        print(l)

# try direct image search in site HTML for MON900CS
print("\n=== google-style image filename search via sitemap? ===")
for slug in [
    "montana-5-drawer-chest-sand",
    "montana-chest-sand-finish",
    "montana-sand-chest",
    "montana-4-drawer-chest-sand",
    "montana-5-drawer-chest-sand-finish",
    "montana-chest-sand-finish",
]:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = fetch(url)
        t = re.search(r"<title>([^<]+)</title>", html, re.I)
        print(f"OK {slug}: {t.group(1)}")
    except Exception as e:
        print(f"FAIL {slug}")
