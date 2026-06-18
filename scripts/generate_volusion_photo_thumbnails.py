#!/usr/bin/env python3
"""Generate Volusion PDP/PLP thumbnail files (-1T, -2T, -3T) from full-size photos.

Volusion uses {ProductCode}-1.jpg as the large primary and {ProductCode}-1T.jpg as
the sharper PDP thumbnail. Alt views use -2/-2T (and -3/-3T). Downscale from the
large source with LANCZOS so thumbnails are not blurry on the product page.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
THUMB_MAX = (900, 700)
JPEG_QUALITY = 90
SLOTS = (1, 2, 3)


def make_thumbnail(src: Path, dest: Path, max_size: tuple[int, int] = THUMB_MAX) -> int:
    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError("Pillow is required: pip install pillow") from exc

    img = Image.open(src)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    w, h = img.size
    max_w, max_h = max_size
    scale = min(max_w / w, max_h / h, 1.0)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    if (new_w, new_h) != (w, h):
        resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        img = img.resize((new_w, new_h), resample)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return dest.stat().st_size


def generate_for_code(code: str, slots: tuple[int, ...] = SLOTS) -> list[str]:
    written: list[str] = []
    for slot in slots:
        src = PHOTOS / f"{code}-{slot}.jpg"
        if not src.is_file():
            continue
        dest = PHOTOS / f"{code}-{slot}T.jpg"
        size = make_thumbnail(src, dest)
        written.append(f"{dest.name} ({size} bytes, from {src.name})")
    return written


def discover_codes(pattern: str) -> list[str]:
    rx = re.compile(r"^(.+)-(\d+)\.jpg$", re.I)
    codes: set[str] = set()
    for path in PHOTOS.glob(pattern):
        m = rx.match(path.name)
        if m:
            codes.add(m.group(1))
    return sorted(codes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--glob",
        default="SS-*.jpg",
        help="Glob under vspfiles/photos for product codes (default: SS-*.jpg)",
    )
    parser.add_argument("--code", action="append", help="Only these Volusion product codes")
    args = parser.parse_args()

    codes = args.code if args.code else discover_codes(args.glob)
    if not codes:
        print("No product codes found", file=sys.stderr)
        return 1

    total = 0
    for code in codes:
        lines = generate_for_code(code)
        if not lines:
            continue
        print(f"=== {code} ===")
        for line in lines:
            print(f"  {line}")
            total += 1

    print(f"\nDone: {total} thumbnail(s) for {len(codes)} product code(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
