"""Merge per-product Volusion_Saranoni option CSVs into one master file."""
from __future__ import annotations

import csv
from pathlib import Path

DOWNLOADS = Path(r"c:\Users\erink\Downloads")
SUMMARY = DOWNLOADS / "Volusion_Saranoni_Options_Summary.csv"
OUT = DOWNLOADS / "Volusion_Saranoni_Missing_Options.csv"


def main() -> None:
    code_by_file: dict[str, tuple[str, str]] = {}
    if SUMMARY.exists():
        with SUMMARY.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                if row.get("status") == "generated" and row.get("csv_file"):
                    code_by_file[row["csv_file"]] = (
                        row["productcode"],
                        row.get("productname", ""),
                    )

    code_by_file["Volusion_Harry_Potter_Nursery_Options.csv"] = (
        "SAR-HP-HP-MSLN-NRS",
        "Harry Potter Muslin Nursery Collection",
    )

    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for path in sorted(DOWNLOADS.glob("Volusion_*_Options.csv")):
        if path.name == OUT.name:
            continue
        code, name = code_by_file.get(path.name, ("", path.stem))
        with path.open(newline="", encoding="utf-8-sig") as f:
            for line in csv.DictReader(f):
                key = (code, line["optionid"], line["optionsdesc"])
                if key in seen:
                    continue
                seen.add(key)
                rows.append(
                    {
                        "productcode": code,
                        "productname": name,
                        "optionid": line["optionid"],
                        "optionsdesc": line["optionsdesc"],
                        "pricediff": line["pricediff"],
                    }
                )

    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "productcode",
                "productname",
                "optionid",
                "optionsdesc",
                "pricediff",
            ],
        )
        w.writeheader()
        w.writerows(rows)

    products = {r["productcode"] for r in rows if r["productcode"]}
    print(f"Wrote {OUT} ({len(rows)} rows, {len(products)} products)")


if __name__ == "__main__":
    main()
