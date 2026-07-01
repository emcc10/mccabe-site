#!/usr/bin/env python3
"""Re-download Saranoni variant -T/-S images for products with duplicate variant photos."""
from __future__ import annotations

import csv
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT_CSV = ROOT / "saranoni-image-repair-report" / "04_full_variant_audit.csv"
PHOTOS = ROOT / "vspfiles" / "photos"
FETCH_PATH = ROOT / "scripts" / "fetch_saranoni_complete_volusion_images.py"


def load_fetch_module():
    spec = importlib.util.spec_from_file_location("sar_fetch", FETCH_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["sar_fetch"] = mod
    spec.loader.exec_module(mod)
    return mod


def read_dupe_products() -> set[str]:
    if not AUDIT_CSV.is_file():
        raise SystemExit(f"Missing audit CSV: {AUDIT_CSV}")
    products: set[str] = set()
    with AUDIT_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("DuplicateInProduct"):
                products.add(row["ProductCode"])
    return products


def rows_for_products(products: set[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with AUDIT_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["ProductCode"] in products and row.get("OptionID"):
                rows.append(row)
    return rows


def dest_flat(filename: str) -> Path:
    return PHOTOS / filename


def save_variant_pair(fetch, state, row: dict[str, str]) -> tuple[bool, str]:
    code = row["ProductCode"]
    color = row["ColorName"]
    oid = row["OptionID"]
    t_name = row["T_File"]
    s_name = row["S_File"]

    product = fetch.get_product(state, code)
    if not product:
        return False, "no_shopify_product"

    src, matched = fetch.find_variant_image(product, color)
    if not src:
        return False, f"no_variant_image_for:{color}"

    try:
        fetch.save_from_url(
            state,
            t_name,
            src,
            code=code,
            kind="variant-main",
            color=matched or color,
            option_id=oid,
            method="duplicate_repair",
        )
        t_path = fetch.dest_for(t_name)
        flat_t = dest_flat(t_name)
        flat_t.parent.mkdir(parents=True, exist_ok=True)
        flat_t.write_bytes(t_path.read_bytes())

        main_jpeg = flat_t.read_bytes()
        flat_s = dest_flat(s_name)
        flat_s.write_bytes(fetch.make_swatch(main_jpeg))
        return True, matched or color
    except Exception as exc:
        return False, str(exc)


def main() -> int:
    products = read_dupe_products()
    if not products:
        print("No duplicate products in audit CSV.")
        return 0

    fetch = load_fetch_module()
    state = fetch.load_state()
    rows = rows_for_products(products)

    ok = 0
    fail = 0
    results: list[dict[str, str]] = []

    print(f"Repairing {len(rows)} variant slots across {len(products)} products...")
    for row in rows:
        success, note = save_variant_pair(fetch, state, row)
        results.append(
            {
                "ProductCode": row["ProductCode"],
                "ColorName": row["ColorName"],
                "OptionID": row["OptionID"],
                "T_File": row["T_File"],
                "Result": "OK" if success else "FAIL",
                "Note": note,
            }
        )
        if success:
            ok += 1
            print(f"  OK  {row['T_File']} ({note})")
        else:
            fail += 1
            print(f"  FAIL {row['T_File']}: {note}")

    out = ROOT / "saranoni-image-repair-report" / "05_duplicate_repair_results.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["ProductCode", "ColorName", "OptionID", "T_File", "Result", "Note"],
        )
        writer.writeheader()
        writer.writerows(results)

    print(f"\nWrote {out}")
    print(f"OK: {ok}, FAIL: {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
