#!/usr/bin/env python3
"""Probe Palliser / dealer sources for product stock image URLs."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe stock photo probe)"}

MODELS = [
    ("77743", "CHARLI", ["77743-01", "77743-A1", "77743-D1"]),
    ("77752", "LAGUNA", ["77752-01", "77752-A1", "77752-D1"]),
    ("77651", "MADISON", ["77651-01"]),
    ("77176", "WINDSOR", ["77176-A4"]),
    ("77768", "PYPER", ["77768-91"]),
    ("42306", "PINECREST", ["42306-31", "42306-32"]),
    ("42002", "THEO", ["42002-39", "42002-32"]),
    ("41094", "REGENT", ["41094-39"]),
    ("43003", "DENALI", ["43003-38"]),
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def imgs_from_html(html: str) -> list[str]:
    from html import unescape

    return sorted(
        set(
            unescape(m)
            for m in re.findall(
                r'(?:src|href)=["\'](https?://[^"\']+\.(?:jpg|jpeg|png|webp)(?:\?[^"\']*)?)["\']',
                html,
                re.I,
            )
        )
    )


def main() -> None:

    out: dict[str, list[str]] = {}

    # sofasandsectionals slug patterns
    for model, style, skus in MODELS:
        slug = f"{style.lower()}-{model}"
        for path in [
            f"https://www.sofasandsectionals.com/{slug}-sofa-50-fabrics-by-palliser-furniture",
            f"https://www.sofasandsectionals.com/{slug}-{model}-sofa-50-fabrics-by-palliser-furniture",
            f"https://www.sofasandsectionals.com/palliser-{slug}-sofa",
        ]:
            try:
                html = fetch(path)
                imgs = [
                    u
                    for u in imgs_from_html(html)
                    if "palliser" in u.lower() or "cloudinary" in u.lower() or "cdn" in u.lower()
                ]
                if imgs:
                    out[f"{model} {style}"] = imgs[:8]
                    print("OK", path, len(imgs))
                    break
            except urllib.error.HTTPError as e:
                print("HTTP", e.code, path)
            except Exception as exc:  # noqa: BLE001
                print("ERR", path, exc)

    # Try images.palliser.com product paths (guess)
    guesses = [
        "https://images.palliser.com/products/77743/77743-01.jpg",
        "https://images.palliser.com/product/77743-01.jpg",
        "https://images.palliser.com/media/77743%20CHARLI.jpg",
    ]
    for g in guesses:
        try:
            req = urllib.request.Request(g, headers=UA, method="HEAD")
            with urllib.request.urlopen(req, timeout=15) as resp:
                print("HEAD OK", g, resp.status)
        except Exception as exc:  # noqa: BLE001
            print("HEAD fail", g, type(exc).__name__)

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
