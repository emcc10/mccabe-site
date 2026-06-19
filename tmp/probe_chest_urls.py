#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

SLUGS = [
    "bear-creek-chest",
    "bear-creek-chest-tobacco",
    "bear-creek-chest-brown-tobacco",
    "cassie-illuminating-chest",
    "cassie-chest",
    "montana-chest",
    "riverdale-chest",
    "sigmund-chest",
]

QUERIES = [
    "bear creek chest",
    "cassie illuminating chest",
    "montana chest",
    "riverdale chest",
    "sigmund chest",
]


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.geturl(), r.read().decode("utf-8", "replace")
    except Exception as e:
        return None, url, str(e)


print("=== slug probes ===")
for slug in SLUGS:
    url = f"https://stevesilver.com/product/{slug}/"
    status, final, body = fetch(url)
    if status == 200:
        title = re.search(r"<title>([^<]+)</title>", body, re.I)
        print(f"OK {slug} -> {title.group(1) if title else '?'}")
    else:
        print(f"FAIL {slug}: {body[:80]}")

print("\n=== search ===")
for q in QUERIES:
    url = "https://stevesilver.com/?s=" + q.replace(" ", "+")
    status, final, body = fetch(url)
    links = re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', body)
    uniq = []
    for l in links:
        if l not in uniq:
            uniq.append(l)
    print(f"\n{q}:")
    for l in uniq[:8]:
        print(f"  {l}")
