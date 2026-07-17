#!/usr/bin/env python3
"""Batch-run fetch_saranoni_color_swap_images for every product code in
catalog/saranoni-imports/_batch-20260716/Options_Import.csv that does not yet
have ANY per-option swap images (-{id}-S.jpg / -{id}-T.jpg) locally.

This proactively prevents the exact bug reported on SAR-PTRN-FX-FUR (color
picked, main image never swaps) from recurring on every other product in the
same options-import batch once/if those rows get imported into Volusion.

Read-only against the option/catalog CSVs; only writes new
vspfiles/photos/SAR-*-{id}-[ST].jpg files. Never overwrites an existing file.

Usage:
    py scripts/backfill_saranoni_color_swap_images_batch.py
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_saranoni_color_swap_images import (  # noqa: E402
    fetch_bytes,
    fetch_json,
    image_width,
    to_jpeg,
    variant_image_url,
    MIN_BYTES,  # noqa: F401
    MIN_WIDTH,
    SWATCH_SIZE,
)

PHOTOS = ROOT / "vspfiles" / "photos"
OPTIONS_CSV = ROOT / "catalog" / "saranoni-imports" / "_batch-20260716" / "Options_Import.csv"
CATALOG_CSV = Path(
    r"C:\Users\erink\Downloads\Saranoni_Complete_Volusion_Image_Recovery\current_saranoni_products.csv"
)


def load_handles() -> dict[str, str]:
    with CATALOG_CSV.open(newline="", encoding="utf-8-sig") as f:
        return {
            row["ProductCode"].strip(): row.get("Handle", "").strip()
            for row in csv.DictReader(f)
        }


def load_product_option_maps() -> dict[str, dict[str, str]]:
    """productcode -> {optionId: colorName}"""
    out: dict[str, dict[str, str]] = {}
    with OPTIONS_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["optioncatid"].strip() != "23":
                continue  # color only
            opt_id = row["id"].strip()
            desc = row["optionsdesc"].strip()
            codes = [c.strip() for c in row["applytoproductcodes"].split(",") if c.strip()]
            for code in codes:
                out.setdefault(code, {})[opt_id] = desc
    return out


def has_any_swap_images(code: str) -> bool:
    return any(PHOTOS.glob(f"{code}-*-[ST].jpg"))


def process_one(code: str, handle: str, id_to_color: dict[str, str]) -> tuple[int, int, int]:
    try:
        product = fetch_json(f"https://saranoni.com/products/{handle}.js")
    except Exception as exc:  # noqa: BLE001
        print(f"  ::error:: {code}: could not fetch saranoni.com/products/{handle}.js ({exc})")
        return 0, 0, len(id_to_color)

    ok, skipped, failed = 0, 0, 0
    for opt_id, color in id_to_color.items():
        main_path = PHOTOS / f"{code}-{opt_id}-T.jpg"
        swatch_path = PHOTOS / f"{code}-{opt_id}-S.jpg"
        if main_path.is_file() and swatch_path.is_file():
            skipped += 1
            continue

        url = variant_image_url(product, color)
        if not url:
            print(f"  ::warning:: {code} {opt_id} ({color}): no matching saranoni variant image")
            failed += 1
            continue
        try:
            data = fetch_bytes(url)
            w = image_width(data)
            if w < MIN_WIDTH:
                print(f"  ::warning:: {code} {opt_id} ({color}): source {w}px < {MIN_WIDTH}px")
                failed += 1
                continue
            main_path.write_bytes(to_jpeg(data))
            swatch_path.write_bytes(to_jpeg(data, SWATCH_SIZE))
        except Exception as exc:  # noqa: BLE001
            print(f"  ::error:: {code} {opt_id} ({color}) failed: {exc}")
            failed += 1
            continue
        ok += 1
    return ok, skipped, failed


def main() -> int:
    handles = load_handles()
    product_maps = load_product_option_maps()

    at_risk = [code for code in product_maps if not has_any_swap_images(code)]
    print(f"{len(at_risk)} product codes need swap images backfilled\n")

    total_ok, total_skip, total_fail = 0, 0, 0
    no_handle: list[str] = []
    for code in sorted(at_risk):
        handle = handles.get(code, "")
        if not handle:
            no_handle.append(code)
            continue
        print(f"=== {code} ({handle}) ===")
        ok, skip, fail = process_one(code, handle, product_maps[code])
        total_ok += ok
        total_skip += skip
        total_fail += fail
        print(f"  {ok} written, {skip} already existed, {fail} failed\n")

    print(f"TOTAL: {total_ok} written, {total_skip} already existed, {total_fail} failed")
    if no_handle:
        print(f"\nNo handle on file for: {', '.join(no_handle)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
