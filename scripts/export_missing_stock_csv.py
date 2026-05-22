#!/usr/bin/env python3
"""Export tmp/plp-missing-stock.json to downloadable CSV (sofas/sectionals only)."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_IN = ROOT / "tmp" / "plp-missing-stock.json"
CSV_OUT = ROOT / "reports" / "sofas-sectionals-missing-stock-photos.csv"
SITE = "https://www.mccabestheaterandliving.com"

CAT_NAMES = {
    "177": "Stationary Sofas",
    "187": "Stationary Sectionals",
    "188": "Reclining Sectionals",
    "179": "Reclining Sofas",
    "157": "Stationary Loveseats",
    "147": "Reclining Loveseats",
    "192": "Apartment Sofas",
    "186": "Recliners",
    "175": "Accent Chairs",
}


def is_sofa_or_sectional(title: str) -> bool:
    t = title.lower()
    if not any(w in t for w in ("sofa", "sectional", "loveseat")):
        return False
    if re.search(r"\brecliner\b", t) and "sofa" not in t and "loveseat" not in t:
        return False
    return True


def main() -> None:
    data = json.loads(JSON_IN.read_text(encoding="utf-8"))
    rows = [r for r in data["missing_sofa_sectional"] if is_sofa_or_sectional(r["title"])]
    rows.sort(key=lambda r: (r.get("code", ""), r["title"]))

    CSV_OUT.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "#",
        "Product Title",
        "SKU / Product Code",
        "Product URL",
        "Category",
        "Category URL",
        "PLP Issue",
        "Found On (PLP page)",
        "Suggested upload filename",
        "Notes",
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for i, r in enumerate(rows, 1):
            cat_path = r.get("category", "")
            cat_id = re.search(r"/(\d+)\.htm", cat_path)
            cat_id = cat_id.group(1) if cat_id else ""
            cat_name = CAT_NAMES.get(cat_id, cat_path)
            sources = ", ".join(r.get("sources", []))
            code = r.get("code", "")
            suggested = f"{code}-1.jpg" if code else ""
            w.writerow(
                {
                    "#": i,
                    "Product Title": r["title"],
                    "SKU / Product Code": code,
                    "Product URL": r["href"],
                    "Category": cat_name,
                    "Category URL": SITE + cat_path if cat_path else "",
                    "PLP Issue": "; ".join(r.get("reasons", [])),
                    "Found On (PLP page)": sources,
                    "Suggested upload filename": suggested,
                    "Notes": "Upload to Volusion Product Images; assign as primary thumbnail",
                }
            )

    print(f"Wrote {len(rows)} rows -> {CSV_OUT}")


if __name__ == "__main__":
    main()
