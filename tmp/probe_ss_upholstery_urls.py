#!/usr/bin/env python3
"""Probe stevesilver.com for upholstery product page URLs."""
import re
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe probe)"}

PRODUCTS = {
    "SS-CONROE-PWR-CHAISE-SECT": "conroe dual-power reclining sectional chaise cobblestone",
    "SS-CONROE-GRAY-PWR-SECT": "conroe dual-power reclining sectional gray",
    "SS-GATLIN-PWR-SECT": "gatlin dual-power leather modular reclining sectional",
    "SS-DENVER-CHAR-PWR-SECT": "denver dual-power sectional charcoal",
    "SS-DENVER-BROWN-PWR-SECT": "denver dual-power leather sectional brown",
    "SS-LUNA-CHAR-PWR-SOFA": "luna charcoal power reclining sofa",
    "SS-LUNA-ICE-PWR-SOFA": "luna ice power reclining sofa",
    "SS-DANIEL-PWR-SOFA": "daniel triple power leather reclining sofa",
    "SS-ZENITH-PWR-CONSOLE-SOFA": "zenith power console sofa",
    "SS-ALEX-STONE-PWR-SECT": "alexandria stone power reclining sectional",
    "SS-OLSEN-DOVE-PWR-SOFA": "olsen dove power sofa",
    "SS-KEILY-BROWN-86SOFA": "keily sofa manual reclining drop-down console brown",
    "SS-NOAH-GRAY-SLEEPER-SOFA": "noah gray sleeper sofa",
}

# Also try direct slug guesses
GUESSES = {
    "SS-CONROE-PWR-CHAISE-SECT": [
        "https://stevesilver.com/product/conroe-dual-power-reclining-7-piece-sectional-with-chaise-cobblestone/",
        "https://stevesilver.com/product/conroe-dual-power-7-piece-reclining-sectional-with-chaise-cobblestone/",
    ],
    "SS-GATLIN-PWR-SECT": [
        "https://stevesilver.com/product/gatlin-dual-power-leather-6-piece-modular-reclining-sectional/",
    ],
}


def search(q: str) -> list[str]:
    url = "https://stevesilver.com/?s=" + urllib.parse.quote(q)
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    return list(dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+/)"', html)))


def check_url(url: str) -> bool:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status == 200
    except Exception:
        return False


for code, q in PRODUCTS.items():
    print(f"\n=== {code} ===")
    for url in GUESSES.get(code, []):
        ok = check_url(url)
        print(f"  guess {'OK' if ok else 'FAIL'}: {url}")
    for url in search(q)[:5]:
        print(f"  search: {url}")
