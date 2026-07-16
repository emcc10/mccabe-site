#!/usr/bin/env python3
"""Fetch a second product-level image (-2.jpg / -2T.jpg) for Saranoni codes
that currently only have a single main photo.

For each SAR-* product missing a -2/-2T file, this pulls
https://saranoni.com/products/{handle}.js, finds a "standalone" image (one not
tied to any color/size variant -- i.e. a genuine second angle / detail /
lifestyle shot rather than a duplicate of a color swatch), and saves it
locally. Does not touch -1.jpg or any color-variant -{optionId}-T/S.jpg file.

Usage:
    py scripts/fetch_saranoni_secondary_images.py [--force] [--code SAR-XXX ...]
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
CATALOG_CSV = Path(
    r"C:\Users\erink\Downloads\Saranoni_Complete_Volusion_Image_Recovery\current_saranoni_products.csv"
)
UA = {"User-Agent": "Mozilla/5.0 (McCabe Saranoni secondary images)"}
MIN_BYTES = 15_000


def fetch_bytes(url: str, tries: int = 3) -> bytes:
    last_err: Exception | None = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = resp.read()
            if len(data) < MIN_BYTES:
                raise ValueError(f"too small ({len(data)} bytes)")
            return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise last_err  # type: ignore[misc]


def fetch_json(url: str, tries: int = 3) -> dict | None:
    last_err: Exception | None = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (i + 1))
    print(f"  ::warning:: fetch failed for {url}: {last_err}")
    return None


def pick_secondary_url(product: dict) -> str:
    featured = str(product.get("featured_image") or "")
    if featured.startswith("//"):
        featured = "https:" + featured
    media = product.get("media") or []
    variant_media_ids = {
        v.get("featured_media", {}).get("id")
        for v in (product.get("variants") or [])
        if v.get("featured_media")
    }
    standalone = [
        m for m in media
        if m.get("media_type") == "image" and m.get("id") not in variant_media_ids
    ]
    for m in standalone:
        src = str(m.get("src") or "")
        if src and src != featured:
            return src
    # Fallback: any image after the first that differs from the featured one.
    for src in (product.get("images") or []):
        url = "https:" + src if src.startswith("//") else src
        if url != featured:
            return url
    return ""


def to_jpeg(data: bytes) -> bytes:
    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError:
        return data
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92, optimize=True)
    return buf.getvalue()


def make_thumbnail(data: bytes, max_size: tuple[int, int] = (900, 900)) -> bytes:
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
    img.save(buf, format="JPEG", quality=92, optimize=True)
    return buf.getvalue()


def load_catalog() -> list[dict[str, str]]:
    import csv

    with CATALOG_CSV.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--code", action="append", help="Only these ProductCodes")
    args = parser.parse_args()

    catalog = load_catalog()
    if args.code:
        catalog = [r for r in catalog if r["ProductCode"].strip() in args.code]

    handle_cache: dict[str, dict | None] = {}
    ok, skipped, failed = 0, 0, 0

    for row in catalog:
        code = row["ProductCode"].strip()
        handle = row.get("Handle", "").strip()
        main_path = PHOTOS / f"{code}-2.jpg"
        thumb_path = PHOTOS / f"{code}-2T.jpg"

        if main_path.is_file() and thumb_path.is_file() and not args.force:
            skipped += 1
            continue
        if not handle:
            print(f"skip {code}: no handle")
            failed += 1
            continue

        if handle not in handle_cache:
            time.sleep(0.4)
            handle_cache[handle] = fetch_json(f"https://saranoni.com/products/{handle}.js")
        product = handle_cache[handle]
        if not product:
            failed += 1
            continue

        url = pick_secondary_url(product)
        if not url:
            print(f"skip {code}: no distinct secondary image found")
            failed += 1
            continue

        try:
            data = fetch_bytes(url)
            main_path.write_bytes(to_jpeg(data))
            thumb_path.write_bytes(make_thumbnail(data))
        except Exception as exc:  # noqa: BLE001
            print(f"  ::error:: {code} download failed ({url}): {exc}")
            failed += 1
            continue

        print(f"{code}: wrote {main_path.name} + {thumb_path.name} from {url.rsplit('/', 1)[-1]}")
        ok += 1

    print(f"\nDone: {ok} written, {skipped} already had -2/-2T, {failed} failed/no-image")
    return 0


if __name__ == "__main__":
    sys.exit(main())
