#!/usr/bin/env python3
"""Fetch per-color swap images (-{optionId}-S.jpg / -{optionId}-T.jpg) for a
Saranoni product from saranoni.com, so the on-page color picker has an image
to swap #product_photo to for every live Volusion option ID.

Root cause this fixes: when new Color option values are imported into
Volusion (see catalog/saranoni-imports/_batch-20260716/Options_Import.csv),
the <SELECT> on the PDP immediately shows the new option IDs, but the color-
swap JS in mc-pdp-auth-cta-fix-v21.js looks for
    vspfiles/photos/{ProductCode}-{optionId}-T.jpg   (main image)
    vspfiles/photos/{ProductCode}-{optionId}-S.jpg   (swatch thumb)
If those files were never uploaded, choosing a color silently fails to swap
the main image (the request 404s and the old image stays put).

Usage:
    py scripts/fetch_saranoni_color_swap_images.py \
        --code SAR-PTRN-FX-FUR \
        --handle patterned-faux-fur-throw-blanket \
        --map 1373=Dusty Mauve --map 1374=Eucalyptus ...

Or pass --map-file with one "id=Color Name" per line.
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
UA = {"User-Agent": "Mozilla/5.0 (McCabe Saranoni color-swap images)"}
MIN_BYTES = 8_000
MIN_WIDTH = 650
SWATCH_SIZE = (320, 320)


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


def fetch_json(url: str, tries: int = 3) -> dict:
    last_err: Exception | None = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise last_err  # type: ignore[misc]


def variant_image_url(product: dict, color_name: str) -> str:
    color_name_l = color_name.strip().lower()
    options = product.get("options") or []
    opt_names = [(o.get("name") or "").strip().lower() for o in options]
    color_idx = opt_names.index("color") if "color" in opt_names else 0

    for v in product.get("variants") or []:
        opts = [v.get("option1"), v.get("option2"), v.get("option3")]
        label = str(opts[color_idx] or "").strip().lower()
        if label != color_name_l:
            continue
        img = v.get("featured_image")
        src = ""
        if isinstance(img, dict):
            src = str(img.get("src") or "")
        if src:
            return "https:" + src if src.startswith("//") else src
    return ""


def to_jpeg(data: bytes, size: tuple[int, int] | None = None) -> bytes:
    from PIL import Image  # noqa: PLC0415

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    if size:
        resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
        img = img.resize(size, resample)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92, optimize=True)
    return buf.getvalue()


def image_width(data: bytes) -> int:
    from PIL import Image  # noqa: PLC0415

    return Image.open(io.BytesIO(data)).size[0]


def parse_map_arg(pairs: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for pair in pairs:
        if "=" not in pair:
            continue
        opt_id, color = pair.split("=", 1)
        out[opt_id.strip()] = color.strip()
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--code", required=True, help="Volusion ProductCode")
    parser.add_argument("--handle", required=True, help="saranoni.com product handle")
    parser.add_argument("--map", action="append", default=[], help="optionId=Color Name")
    parser.add_argument("--map-file", help="Path to a file with one optionId=Color Name per line")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    id_to_color = parse_map_arg(args.map)
    if args.map_file:
        for line in Path(args.map_file).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            id_to_color.update(parse_map_arg([line]))

    if not id_to_color:
        print("No optionId=Color mappings given (use --map or --map-file)", file=sys.stderr)
        return 1

    product = fetch_json(f"https://saranoni.com/products/{args.handle}.js")

    ok, skipped, failed = 0, 0, 0
    for opt_id, color in id_to_color.items():
        main_path = PHOTOS / f"{args.code}-{opt_id}-T.jpg"
        swatch_path = PHOTOS / f"{args.code}-{opt_id}-S.jpg"
        if main_path.is_file() and swatch_path.is_file() and not args.force:
            print(f"skip {opt_id} ({color}): already exists")
            skipped += 1
            continue

        url = variant_image_url(product, color)
        if not url:
            print(f"  ::error:: {opt_id} ({color}): no matching Saranoni variant image found")
            failed += 1
            continue

        try:
            data = fetch_bytes(url)
            w = image_width(data)
            if w < MIN_WIDTH:
                print(f"  ::error:: {opt_id} ({color}): source width {w}px < {MIN_WIDTH}px minimum")
                failed += 1
                continue
            main_path.write_bytes(to_jpeg(data))
            swatch_path.write_bytes(to_jpeg(data, SWATCH_SIZE))
        except Exception as exc:  # noqa: BLE001
            print(f"  ::error:: {opt_id} ({color}) download failed ({url}): {exc}")
            failed += 1
            continue

        print(f"{opt_id} ({color}): wrote {main_path.name} + {swatch_path.name}")
        ok += 1

    print(f"\nDone: {ok} written, {skipped} already existed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
