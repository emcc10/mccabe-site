#!/usr/bin/env python3
"""Download a secondary "room scene" alt image for Steve Silver bed frames.

The 16 SS-*KFB/QFB bed frame SKUs only had a primary product shot (`-1.jpg`,
written by build_steve_silver_bed_catalog.py). This script fetches the same
stevesilver.com product page(s) and any linked bedroom-set page, picks the
best lifestyle/room-scene shot, and writes it as `-2.jpg` / `-2T.jpg` so the
PDP alt-view row has a second image. Does not touch `-1.jpg`.

Reuses BED_PRODUCTS from build_steve_silver_bed_catalog.py (single source of
truth for stevesilver.com page URLs); adds no new product mapping data.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_steve_silver_bed_catalog import (  # noqa: E402
    BED_PRODUCTS,
    UA,
    extract_gallery_images,
    fetch_text,
)

PHOTOS = ROOT / "vspfiles" / "photos"
MIN_BYTES = 15_000

ROOM_MARKERS = ("_RS", "REVISED", "BRREG", "K4PC", "K5PC", "KS4PC", "-K4PC", "-K5PC", "BEDROOM", "_LS")
SKIP_MARKERS = ("LOGO", "_DTL", "DTL", "INFO", "HARDWARE", "AMP1", "MOBILE.PNG")


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < MIN_BYTES:
        raise ValueError(f"too small ({len(data)} bytes): {url}")
    return data


def is_room_scene(alt: str, url: str) -> bool:
    text = (alt + " " + url).upper()
    if any(m in text for m in SKIP_MARKERS):
        return False
    return any(marker in text for marker in ROOM_MARKERS)


def room_score(alt: str, url: str, sku_hint: str) -> int:
    text = (alt + " " + url).upper()
    score = 0
    if "_RS" in text or "REVISED" in text:
        score += 100
    if any(x in text for x in ("K4PC", "K5PC", "KS4PC", "-K4PC", "-K5PC")):
        score += 80
    if "BRREG" in text:
        score += 70
    if "_LS" in text:
        score += 50
    if sku_hint.upper() in text:
        score += 20
    return score


def pick_room_url(images: list[tuple[str, str]], sku_hint: str) -> str:
    candidates = [
        (room_score(alt, url, sku_hint), url)
        for alt, url in images
        if is_room_scene(alt, url)
    ]
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1] if candidates else ""


def to_jpeg(data: bytes) -> bytes:
    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError:
        return data
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def make_thumbnail(data: bytes, max_size: tuple[int, int] = (900, 700)) -> bytes:
    from PIL import Image  # noqa: PLC0415

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    w, h = img.size
    scale = min(max_size[0] / w, max_size[1] / h, 1.0)
    new_w, new_h = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    if (new_w, new_h) != (w, h):
        resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        img = img.resize((new_w, new_h), resample)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def process(config: dict[str, str], force: bool) -> bool:
    code = config["volusion_code"]
    alt_path = PHOTOS / f"{code}-2.jpg"
    alt_thumb_path = PHOTOS / f"{code}-2T.jpg"
    if alt_path.is_file() and alt_thumb_path.is_file() and not force:
        print(f"skip {code} (alt already exists)")
        return True

    pages = [config["page"]] + [p.strip() for p in config.get("extra_pages", "").split(",") if p.strip()]
    images: list[tuple[str, str]] = []
    for page in pages:
        try:
            images += extract_gallery_images(fetch_text(page))
        except urllib.error.HTTPError as exc:
            print(f"  ::warning:: {code} page HTTP {exc.code}: {page}")

    if not images:
        print(f"  ::error:: {code} no gallery images found")
        return False

    room_url = pick_room_url(images, config["sku_hint"])
    if not room_url:
        print(f"  ::warning:: {code} no room-scene image found; skipping alt")
        return False

    print(f"=== {code} ===\n  alt: {room_url.rsplit('/', 1)[-1]}")
    try:
        data = fetch_bytes(room_url)
        alt_path.write_bytes(to_jpeg(data))
        alt_thumb_path.write_bytes(make_thumbnail(data))
    except Exception as exc:  # noqa: BLE001
        print(f"  ::error:: {code} download failed: {exc}")
        return False
    print(f"  wrote {alt_path.name} ({alt_path.stat().st_size} bytes)")
    print(f"  wrote {alt_thumb_path.name} ({alt_thumb_path.stat().st_size} bytes)")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--code", action="append", help="Only these Volusion codes")
    args = parser.parse_args()

    products = BED_PRODUCTS
    if args.code:
        products = [p for p in BED_PRODUCTS if p["volusion_code"] in args.code]

    ok, fail = 0, 0
    for config in products:
        if process(config, args.force):
            ok += 1
        else:
            fail += 1
    print(f"\nDone: {ok} ok, {fail} failed/skipped-no-room-image")
    return 0


if __name__ == "__main__":
    sys.exit(main())
