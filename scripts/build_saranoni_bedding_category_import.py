#!/usr/bin/env python3
"""Create the minimal Volusion Products-table import for Saranoni Bedding.

`CategoryIDs` replaces the product's category associations, so this intentionally
contains only products that are approved to live exclusively in Bedding (209).
It does not touch blanket, kids, snugglewear, or Luxe Comforts records.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "tmp" / "saranoni_full_audit_results.json"
OUT = ROOT / "catalog" / "saranoni-gap-report"

# Pillows and pillowcase sets are exclusive to Bedding.  The approved related
# bedding families are also moved there: quilts, sheets, crib products, dust
# ruffles, and bed-size blankets.
BEDDING_PATTERNS = (
    ("pillow", "pillow or pillowcase"),
    ("quilt", "quilt"),
    ("crib", "crib bedding"),
    ("sheet", "sheet"),
    ("dust-ruffle", "dust ruffle"),
    ("king", "bed-size blanket"),
    ("queen", "bed-size blanket"),
    ("twin", "bed-size blanket"),
    ("full", "bed-size blanket"),
)

# These live Volusion product codes are bedding even though their legacy code
# does not include the word "pillow".  Keeping them explicit prevents the two
# Grand Faux Fur pillow records from continuing to appear in Adult Blankets.
EXPLICIT_BEDDING_CODES = {
    "SAR-GRAND-FX-FUR-12X20": "pillow cover",
    "SAR-GRAND-FX-FUR-2-PACK-EURO": "pillow covers",
    "SAR-BMBU-RYN-MSLN-PILLOWCA": "pillowcase set",
    "SAR-FX-FUR-PILLOWCA": "pillowcase",
}


def main() -> int:
    products = json.loads(AUDIT.read_text(encoding="utf-8"))
    rows: list[dict[str, str]] = []
    audit_rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for product in products:
        code = str(product.get("code") or "").strip().upper()
        handle = str(product.get("handle") or "").strip().lower()
        if not code or not handle:
            continue
        reason = EXPLICIT_BEDDING_CODES.get(code) or next(
            (reason for needle, reason in BEDDING_PATTERNS if needle in handle), ""
        )
        if not reason:
            continue
        seen.add(code)
        rows.append({"ProductCode": code, "CategoryIDs": "209"})
        audit_rows.append(
            {
                "ProductCode": code,
                "SupplierHandle": handle,
                "Reason": reason,
                "CategoryIDs": "209",
            }
        )
    for code, reason in EXPLICIT_BEDDING_CODES.items():
        if code in seen:
            continue
        rows.append({"ProductCode": code, "CategoryIDs": "209"})
        audit_rows.append(
            {
                "ProductCode": code,
                "SupplierHandle": "(live Volusion bedding record)",
                "Reason": reason,
                "CategoryIDs": "209",
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "volusion_saranoni_bedding_category_import.csv").open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.DictWriter(file, fieldnames=["ProductCode", "CategoryIDs"])
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda row: row["ProductCode"]))
    with (OUT / "saranoni_bedding_category_mapping_report.csv").open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.DictWriter(
            file, fieldnames=["ProductCode", "SupplierHandle", "Reason", "CategoryIDs"]
        )
        writer.writeheader()
        writer.writerows(sorted(audit_rows, key=lambda row: row["ProductCode"]))
    print(f"Wrote {len(rows)} Bedding category assignments.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
