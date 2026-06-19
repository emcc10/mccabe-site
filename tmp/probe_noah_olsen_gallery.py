#!/usr/bin/env python3
import re
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

PAGES = {
    "SS-NOAH-GRAY-SLEEPER-SOFA": "https://stevesilver.com/product/noah-flippable-convertible-storage-sleeper-chofa-gray/",
    "SS-OLSEN-DOVE-PWR-SOFA-a": "https://stevesilver.com/product/olsen-3-piece-dual-power-zero-gravity-modular-reclining-sofa/",
    "SS-OLSEN-DOVE-PWR-SOFA-b": "https://stevesilver.com/product/olsen-3-piece-dual-power-zero-gravity-modular-reclining-console-loveseat/",
    "SS-OLSEN-DOVE-PWR-SOFA-c": "https://stevesilver.com/product/olsen-power-console-dove/",
}


def extract(html: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for pat in (
        r'data-large_image="([^"]+)"',
        r'data-src="(https://[^"]+\.(?:jpg|jpeg|png|webp))"',
        r'src="(https://stevesilver\.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
    ):
        for m in re.finditer(pat, html, re.I):
            url = m.group(1).replace("\\/", "/")
            if url in seen or re.search(r"-\d+x\d+\.", url, re.I):
                continue
            seen.add(url)
            name = url.rsplit("/", 1)[-1]
            if any(x in name.upper() for x in ("LOGO", "MOBILE", "AMP1")):
                continue
            out.append(name)
    return out


for code, page in PAGES.items():
    print(f"\n=== {code} ===")
    html = urllib.request.urlopen(urllib.request.Request(page, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    for name in extract(html)[:12]:
        print(f"  {name}")
