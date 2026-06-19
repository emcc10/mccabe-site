#!/usr/bin/env python3
import time
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}

GUESSES = [
    "https://stevesilver.com/product/noah-convertible-sleeper-sofa-gray/",
    "https://stevesilver.com/product/noah-gray-convertible-sleeper-sofa/",
    "https://stevesilver.com/product/noah-convertible-sleeper-sofa/",
    "https://stevesilver.com/product/noah-sleeper-sofa-gray/",
    "https://stevesilver.com/product/olsen-dove-power-reclining-console-sofa/",
    "https://stevesilver.com/product/olsen-dove-dual-power-reclining-sofa/",
    "https://stevesilver.com/product/olsen-3-piece-dual-power-reclining-set-dove-sofa-loveseat-recliner/",
    "https://stevesilver.com/product/olsen-dual-power-reclining-console-sofa-dove/",
    "https://stevesilver.com/product/olsen-3-piece-dual-power-reclining-set-dove/",
]

for url in GUESSES:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as resp:
            print("OK", resp.status, url)
    except Exception as exc:
        print("FAIL", url, exc)
    time.sleep(1)
