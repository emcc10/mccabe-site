#!/usr/bin/env python3
"""Probe Mahjong House Shopify for missing TMH product images."""
from __future__ import annotations

import json
import re
import urllib.request

BASE = "https://themahjonghousewholesale.com"
PATHS = [
    "/products.json?limit=250",
    "/collections/mats/products.json?limit=250",
    "/collections/travel-mahjong/products.json?limit=250",
    "/collections/accessories/products.json?limit=250",
]


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode())


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def main() -> None:
    seen: dict[str, dict] = {}
    for path in PATHS:
        try:
            data = fetch(BASE + path)
            for prod in data.get("products", []):
                seen[prod["handle"]] = prod
        except Exception as exc:
            print(f"ERR {path}: {exc}")

    print(f"TOTAL unique products: {len(seen)}\n")
    for handle, prod in sorted(seen.items(), key=lambda x: x[1]["title"].lower()):
        title = prod["title"]
        imgs = prod.get("images") or []
        img = imgs[0]["src"] if imgs else "NO IMAGE"
        print(f"{title}")
        print(f"  handle={handle}")
        print(f"  norm={norm(title)}")
        print(f"  img={img}")
        print()


if __name__ == "__main__":
    main()
