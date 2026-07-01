#!/usr/bin/env python3
"""Force re-fetch Saranoni variant images for products with duplicate CDN photos."""
from __future__ import annotations

import csv
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT_CSV = ROOT / "saranoni-image-repair-report" / "04_full_variant_audit.csv"
FETCH_TMP = ROOT / "tmp" / "fetch_sar_remaining_colors.py"


def load_fetch():
    spec = importlib.util.spec_from_file_location("fsrc", FETCH_TMP)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules["fsrc"] = mod
    spec.loader.exec_module(mod)
    return mod


def dupe_products() -> set[str]:
    products: set[str] = set()
    with AUDIT_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("DuplicateInProduct"):
                products.add(row["ProductCode"])
    return products


def slots_for_products(products: set[str]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    with AUDIT_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["ProductCode"] in products and row.get("OptionID"):
                rows.append(row)
    return rows


def main() -> int:
    fsrc = load_fetch()
    products = dupe_products()
    rows = slots_for_products(products)
    cache: dict[str, dict] = {}
    color_index = fsrc.build_global_color_index(cache)
    option_index = fsrc.build_option_id_index()
    ok = 0
    fail = 0
    results: list[dict[str, str]] = []

    print(f"Force repair {len(rows)} slots / {len(products)} products")
    for row in rows:
        code = row["ProductCode"]
        oid = row["OptionID"]
        label = row["ColorName"]
        handle = fsrc.CODE_TO_HANDLE.get(code, "")
        product = fsrc.shopify_product(handle, cache) if handle else None
        variants = (product or {}).get("variants") or []
        note = ""
        success = False

        manual = fsrc.MANUAL_IMAGE_URLS.get((code, oid))
        try:
            if manual:
                data = fsrc.fetch(manual)
                fsrc.write_pair(data, code, oid)
                note = "manual"
                success = True
            else:
                variant = fsrc.match_variant(label, variants, handle, code) if variants else None
                url = None
                if variant:
                    url = fsrc.variant_image_url(product, variant)
                if not url:
                    url = color_index.get(fsrc.norm_color(label)) or color_index.get(
                        fsrc.norm_color(fsrc.COLOR_ALIASES.get(fsrc.norm_color(label), label))
                    )
                if not url and fsrc.copy_pair_from_option_id(code, oid, option_index):
                    note = "option_id_reuse"
                    success = True
                elif url:
                    data = fsrc.fetch(url)
                    t_name, s_name = fsrc.write_pair(data, code, oid)
                    option_index.setdefault(oid, fsrc.DEST / f"{code}-{oid}-T.jpg")
                    note = f"shopify:{url[:80]}"
                    success = True
                else:
                    note = "no_source"
        except Exception as exc:
            note = str(exc)

        if success:
            ok += 1
            print(f"  OK  {code}-{oid}-T ({label}) [{note}]")
        else:
            fail += 1
            print(f"  FAIL {code}-{oid}-T ({label}) [{note}]")
        results.append(
            {
                "ProductCode": code,
                "ColorName": label,
                "OptionID": oid,
                "Result": "OK" if success else "FAIL",
                "Note": note,
            }
        )

    out = ROOT / "saranoni-image-repair-report" / "05_duplicate_repair_results.csv"
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, fieldnames=["ProductCode", "ColorName", "OptionID", "Result", "Note"]
        )
        w.writeheader()
        w.writerows(results)
    print(f"\nOK {ok}, FAIL {fail} -> {out}")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
