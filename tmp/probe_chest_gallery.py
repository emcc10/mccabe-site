#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

PAGES = {
    "SS-BC900CTT": "https://stevesilver.com/product/bear-creek-chest/",
    "SS-BC950CTBT": "https://stevesilver.com/product/bear-creek-chest-brown/",
    "SS-CAS900C": "https://stevesilver.com/product/cassie-illuminating-5-drawer-chest-shimmering-pearl-finish/",
    "SS-MON900CS": None,
    "SS-RV900C": "https://stevesilver.com/product/riverdale-drawer-chest/",
    "SS-SIG900C": "https://stevesilver.com/product/sigmund-5-drawer-chest/",
}

EXTRA_SLUGS = [
    "montana-chest-sand",
    "montana-5-drawer-chest",
    "montana-chest",
    "montana-drawer-chest",
    "montana-4-drawer-chest",
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
            if url in seen or re.search(r"-700x545|-500x389|-150x", url, re.I):
                continue
            seen.add(url)
            out.append(url.rsplit("/", 1)[-1])
    return out


print("=== montana slug probes ===")
for slug in EXTRA_SLUGS:
    url = f"https://stevesilver.com/product/{slug}/"
    try:
        html = fetch(url)
        title = re.search(r"<title>([^<]+)</title>", html, re.I)
        print(f"OK {slug}: {title.group(1) if title else '?'}")
        imgs = extract_gallery(html)[:4]
        for i in imgs:
            print(f"    {i}")
    except Exception as e:
        print(f"FAIL {slug}: {e}")

print("\n=== montana search ===")
html = fetch("https://stevesilver.com/?s=montana+chest+sand")
links = re.findall(r'href="(https://stevesilver\.com/product/[^"]+)"', html)
for l in dict.fromkeys(links):
    if "montana" in l.lower() and "chest" in l.lower():
        print(l)

print("\n=== product galleries ===")
for code, url in PAGES.items():
    if not url:
        continue
    html = fetch(url)
    imgs = extract_gallery(html)
    print(f"\n{code} -> {url}")
    for i in imgs[:8]:
        print(f"  {i}")
