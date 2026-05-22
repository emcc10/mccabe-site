#!/usr/bin/env python3
"""Audit recliner category PLPs (all pages) and export missing stock photos CSV."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_plp_missing_stock_photos import (  # noqa: E402
    SITE,
    bean_hashes,
    classify_plp,
    collect_category,
)
CSV_OUT = ROOT / "reports" / "recliners-missing-stock-photos.csv"
JSON_OUT = ROOT / "tmp" / "plp-missing-recliners.json"

# Recliner-related Volusion categories
RECLINER_CATS = [
    ("/category-s/186.htm", "186", "Recliners"),
    ("/category-s/149.htm", "149", "Recliners & Accent Chairs"),
    ("/category-s/175.htm", "175", "Accent Chairs"),  # often mixed with recliners on site
]


def is_recliner_product(title: str, href: str, cat_id: str) -> bool:
    t, h = title.lower(), href.lower()
    if "bean bag" in t:
        return False
    if cat_id == "186":
        return True
    if cat_id == "149":
        return "recliner" in t or "reclining" in t or "wallhugger" in t or "rocker" in t
    if cat_id == "175":
        return "recliner" in t or "wallhugger" in t or "rocker" in t
    return "recliner" in t


def main() -> int:
    beans = bean_hashes()
    hash_cache: dict[str, str] = {}
    all_products: dict[str, dict] = {}
    page_totals: dict[str, int] = {}

    for cat_path, cat_id, cat_label in RECLINER_CATS:
        try:
            items, n_pages = collect_category(cat_path, cat_id)
        except Exception as exc:
            print(f"SKIP {cat_path}: {exc}", file=sys.stderr)
            continue
        page_totals[cat_label] = n_pages
        print(f"  {cat_label} ({cat_id}): {n_pages} page(s), {len(items)} products", file=sys.stderr)
        for item in items:
            if not is_recliner_product(item["title"], item["href"], cat_id):
                continue
            key = item["href"].lower()
            item["cat_label"] = cat_label
            item["cat_id"] = cat_id
            if key not in all_products:
                all_products[key] = item
            else:
                all_products[key].setdefault("also_in", []).append(cat_label)

    missing: list[dict] = []
    has_photo: list[dict] = []

    for href, p in sorted(all_products.items(), key=lambda x: x[1]["title"].lower()):
        reasons = classify_plp(p, beans, hash_cache)
        row = {
            "title": p["title"],
            "code": p.get("code", ""),
            "href": p["href"],
            "photo_file": p.get("photo_file", ""),
            "reasons": reasons,
            "category": p.get("cat_label", ""),
            "cat_path": p.get("cat_path", ""),
            "sources": p.get("sources", []),
        }
        if reasons:
            missing.append(row)
        else:
            has_photo.append(row)

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(
        json.dumps(
            {
                "page_totals": page_totals,
                "total_recliner_products": len(all_products),
                "missing_count": len(missing),
                "has_photo_count": len(has_photo),
                "missing": missing,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "#",
        "Product Title",
        "SKU / Product Code",
        "Product URL",
        "Category",
        "Category URL",
        "PLP Issue",
        "Current PLP photo file",
        "Found On (PLP page)",
        "Suggested upload filename",
        "Notes",
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for i, r in enumerate(missing, 1):
            cat_path = r.get("cat_path", "")
            w.writerow(
                {
                    "#": i,
                    "Product Title": r["title"],
                    "SKU / Product Code": r.get("code", ""),
                    "Product URL": r["href"],
                    "Category": r.get("category", ""),
                    "Category URL": SITE + cat_path if cat_path else "",
                    "PLP Issue": "; ".join(r.get("reasons", [])),
                    "Current PLP photo file": r.get("photo_file", ""),
                    "Found On (PLP page)": ", ".join(r.get("sources", [])),
                    "Suggested upload filename": (
                        f"{r.get('code', '')}-1.jpg" if r.get("code") else ""
                    ),
                    "Notes": "Upload in Volusion → Product Images; set as primary thumbnail",
                }
            )

    print(file=sys.stderr)
    print(
        f"Recliners: {len(all_products)} products scanned, "
        f"{len(missing)} missing stock photo, {len(has_photo)} OK",
        file=sys.stderr,
    )
    print(f"CSV: {CSV_OUT}", file=sys.stderr)
    print(f"JSON: {JSON_OUT}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
