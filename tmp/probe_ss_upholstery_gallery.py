#!/usr/bin/env python3
"""Probe gallery images on stevesilver upholstery product pages."""
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

PAGES = {
    "SS-CONROE-PWR-CHAISE-SECT": "https://stevesilver.com/product/conroe-dual-power-reclining-sectional-with-chaise-cobblestone/",
    "SS-CONROE-GRAY-PWR-SECT": "https://stevesilver.com/product/conroe-dual-power-6-piece-reclining-sectional-with-chaise-gray/",
    "SS-GATLIN-PWR-SECT": "https://stevesilver.com/product/gatlin-dual-power-leather-6-piece-modular-reclining-sectional/",
    "SS-DENVER-CHAR-PWR-SECT": "https://stevesilver.com/product/denver-dual-power-6-piece-sectional-charcoal/",
    "SS-DENVER-BROWN-PWR-SECT": "https://stevesilver.com/product/denver-dual-power-6-piece-sectional/",
    "SS-LUNA-CHAR-PWR-SOFA": "https://stevesilver.com/product/luna-home-cinema-power-reclining-sofa-charcoal-vegan-leather/",
    "SS-LUNA-ICE-PWR-SOFA": "https://stevesilver.com/product/luna-home-cinema-power-sofa-ice-vegan-leather/",
    "SS-DANIEL-PWR-SOFA": "https://stevesilver.com/product/daniel-triple-power-home-theater-leather-reclining-sofa-with-drop-down-control-console-built-in-speakers-heat-and-massage/",
    "SS-ZENITH-PWR-CONSOLE-SOFA": "https://stevesilver.com/product/zenith-triple-power-home-theater-reclining-sofa-with-drop-down-control-console-built-in-speakers-vibration/",
    "SS-ALEX-STONE-PWR-SECT": "https://stevesilver.com/product/alexandria-leather-6-piece-power-reclining-set-stone/",
    "SS-OLSEN-DOVE-PWR-SOFA": "https://stevesilver.com/product/olsen-3-piece-dual-power-zero-gravity-modular-reclining-sofa/",
    "SS-KEILY-BROWN-86SOFA": "https://stevesilver.com/product/keily-manual-motion-recliner-sofa-w-dropdown-table/",
    "SS-NOAH-GRAY-SLEEPER-SOFA": "https://stevesilver.com/product/noah-convertible-sleeper-sofa-gray/",
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
            out.append(url.rsplit("/", 1)[-1])
    return out


for code, page in PAGES.items():
    print(f"\n=== {code} ===")
    try:
        html = urllib.request.urlopen(urllib.request.Request(page, headers=UA), timeout=30).read().decode(
            "utf-8", "replace"
        )
    except Exception as exc:
        print(f"  FAIL {exc}")
        continue
    imgs = extract(html)
    print(f"  page OK, {len(imgs)} images")
    for name in imgs[:10]:
        print(f"    {name}")
