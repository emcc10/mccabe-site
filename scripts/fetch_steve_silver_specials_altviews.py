#!/usr/bin/env python3
"""Download alternate gallery photos for Steve Silver closeout products."""
from __future__ import annotations

import hashlib
import io
import re
import time
import urllib.request
from urllib.parse import quote
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
MAX_SIZE = 2000
MIN_WIDTH = 650
QUALITY = 92
UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver closeout photos)"}

# Exact Volusion ProductCode -> supplier page.  The first URL is the primary
# Steve Silver Specials source; a manufacturer URL is retained as a fallback.
PAGES = {
    "Adeline-Patio-Set": (
        "https://stevesilverspecials.com/product/adeline-patio-3-pack-round-side-table-2-swivel-chairs/",
        "https://stevesilver.com/product/adeline-3-piece-outdoor-set/",
    ),
    "Delilah-Patio-Chairs": (
        "https://stevesilverspecials.com/product/daliilah-patio-arm-chair/",
        "https://stevesilver.com/product/dalilah-patio-arm-chair/",
    ),
    "Sapphire-Sleep-Cal-King": (
        "https://stevesilverspecials.com/product/sapphire-sleep-14-thermic-cal-king/",
        "https://stevesilver.com/product/sapphire-sleep-14-inch-california-king-mattress/",
    ),
    "Burlington-Dining-Set": (
        "https://stevesilverspecials.com/product/burlington-5-piece-52-round-dining-set/",
        "https://stevesilver.com/product/burlington-52-inch-round-table/",
    ),
    "Canova-Dining-Set": (
        "https://stevesilverspecials.com/product/canova-5-piece-gray-marble-dining-settable-4-side-chairs/",
        "https://stevesilver.com/product/canova-round-gray-marble-top-dining-table/",
    ),
    "Grayson-Dining-Set": (
        "https://stevesilver.com/product/grayson-5-piece-marble-top-counter-storage-dining-set/",
    ),
    "Molly-Olson-Dining-Set": (
        "https://stevesilverspecials.com/product/mollyolson-5-piece-dining-set/",
        "https://stevesilver.com/product/molly-round-dining-table/",
    ),
    "Ramona-Dining-Set": (
        "https://stevesilverspecials.com/product/ramona-5-piece-marble-top-settable-4-side-chairs/",
        "https://stevesilver.com/product/ramona-white-marble-top-rounddining-table/",
    ),
    "Tamara-Outdoor-Sectional": (
        "https://stevesilverspecials.com/product/tamyra-sectional/",
    ),
    "Tyler-Bar-Set": (
        "https://stevesilverspecials.com/product/tyler-3-piece-38-inch-counter-bar-set/",
    ),
    "Wyatt-Chofa": (
        "https://stevesilverspecials.com/product/wyatt-chofa/",
    ),
}


def fetch(url: str) -> bytes:
    url = quote(url, safe=":/?&=%#")
    request = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def page_images(html: str) -> list[str]:
    """Extract full product-gallery URLs from either supplier's WooCommerce HTML."""
    patterns = (
        r'data-large_image="([^"]+)"',
        r'data-src="(https?://[^"]+\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"',
        r'<img[^>]+src="(https?://[^"]+\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"',
    )
    urls: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        for match in re.finditer(pattern, html, re.I):
            url = match.group(1).replace("\\/", "/").replace("&amp;", "&")
            canonical = re.sub(r"-\d+x\d+(?=\.(?:jpe?g|png|webp)(?:\?|$))", "", url, flags=re.I)
            if canonical in seen or not re.search(r"\.(?:jpe?g|png|webp)(?:\?|$)", canonical, re.I):
                continue
            filename = canonical.rsplit("/", 1)[-1].upper()
            if any(token in filename for token in ("LOGO", "ICON", "DTL", "DIMENSION", "HARDWARE", "AMP1")):
                continue
            seen.add(canonical)
            urls.append(canonical)
    return urls


def image_hash(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def existing_hashes(code: str) -> set[str]:
    hashes: set[str] = set()
    for path in PHOTOS.glob(f"{code}-*.jpg"):
        digest = image_hash(path)
        if digest:
            hashes.add(digest)
    return hashes


def save_image(data: bytes, path: Path) -> str:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    if image.width < MIN_WIDTH:
        raise ValueError(f"width {image.width} is below {MIN_WIDTH}")
    image.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
    image.save(path, "JPEG", quality=QUALITY, optimize=True)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    PHOTOS.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    for code, pages in PAGES.items():
        existing = sorted(PHOTOS.glob(f"{code}-altview*.jpg"))
        if len(existing) >= 3:
            print(f"SKIP {code}: already has {len(existing)} alternate images")
            continue
        urls: list[str] = []
        for page in pages:
            try:
                urls = page_images(fetch(page).decode("utf-8", "replace"))
            except Exception as error:
                print(f"WARN {code}: {page} ({error})")
                continue
            if urls:
                break
        if not urls:
            failures.append(code)
            print(f"FAIL {code}: no supplier gallery found")
            continue

        known = existing_hashes(code)
        slot = len(existing) + 1
        for url in urls:
            if slot > 3:
                break
            path = PHOTOS / f"{code}-altview{slot}.jpg"
            try:
                digest = save_image(fetch(url), path)
                if digest in known:
                    path.unlink(missing_ok=True)
                    continue
                known.add(digest)
                print(f"OK {path.name}")
                slot += 1
            except Exception as error:
                path.unlink(missing_ok=True)
                print(f"WARN {code}: {url} ({error})")
            time.sleep(0.15)
        if slot <= 3:
            failures.append(code)
            print(f"FAIL {code}: only {slot - 1} alternate images available")
    print(f"Done. Unresolved: {', '.join(failures) if failures else 'none'}")
    return 1 if failures else 0


if __name__ == "__main__":
    if hasattr(__import__("sys").stdout, "reconfigure"):
        __import__("sys").stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
