"""Turn tmp/saranoni-variant-stock-audit/saranoni_missing_options_to_add.csv into
Volusion-ready import CSVs, reusing known existing Option IDs where the
(category, value) pair already exists elsewhere in the catalog (e.g. "Charcoal"
color = 1048 everywhere), and only minting new IDs for genuinely new values.

Outputs to catalog/saranoni-imports/_batch-20260716/:
  - Options_Import.csv (id,optioncatid,optionsdesc,pricediff,applytoproductcodes)
    -- a single additive Options import; applytoproductcodes assigns each new
    option value directly to the right products in the same import (matches
    the format already used in saranoni_options_import_current.csv), so there
    is no separate Products import step and nothing to merge in Excel.
  - README.md with import instructions and the out-of-stock findings
"""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT_DIR = ROOT / "tmp" / "saranoni-variant-stock-audit"
MISSING_CSV = AUDIT_DIR / "saranoni_missing_options_to_add.csv"
AUDIT_CSV = AUDIT_DIR / "saranoni_variant_stock_audit.csv"
OOS_CSV = AUDIT_DIR / "saranoni_fully_out_of_stock_products.csv"

OUT_DIR = ROOT / "catalog" / "saranoni-imports" / "_batch-20260716"

KNOWN_ID_SOURCES = [
    Path(r"C:\Users\erink\Downloads\saranoni_options_import_current.csv"),
    Path(r"C:\Users\erink\Downloads\Saranoni_Options_PriceDiff_Import.csv"),
]

NEXT_NEW_ID_START = 1300  # above every ID seen in known sources as of 2026-07-16


def load_known_ids() -> dict[tuple[str, str], int]:
    """(optioncatid, optionsdesc) -> existing id, from prior export/import CSVs."""
    known: dict[tuple[str, str], int] = {}
    max_seen = 0
    for path in KNOWN_ID_SOURCES:
        if not path.is_file():
            continue
        with path.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                try:
                    oid = int(row["id"])
                except (KeyError, ValueError):
                    continue
                cat = str(row.get("optioncatid", "")).strip()
                desc = str(row.get("optionsdesc", "")).strip()
                if not cat or not desc:
                    continue
                key = (cat, desc.lower())
                known.setdefault(key, oid)
                max_seen = max(max_seen, oid)
    return known


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    known_ids = load_known_ids()
    next_id = NEXT_NEW_ID_START

    with MISSING_CSV.open(newline="", encoding="utf-8") as f:
        missing_rows = list(csv.DictReader(f))

    # Assign/reuse an ID per unique (optioncatid, optionsdesc, pricediff) value,
    # and collect every product code that value should apply to.
    value_to_id: dict[tuple[str, str, str], int] = {}
    value_products: dict[tuple[str, str, str], list[str]] = {}
    option_order: list[tuple[str, str, str]] = []
    reused, minted = 0, 0

    for row in missing_rows:
        cat = row["optioncatid"].strip()
        desc = row["optionsdesc"].strip()
        pricediff = row["pricediff"].strip()
        code = row["productcode"].strip()
        key = (cat, desc, pricediff)

        if key not in value_to_id:
            known_key = (cat, desc.lower())
            if pricediff == "0" and known_key in known_ids:
                value_to_id[key] = known_ids[known_key]
                reused += 1
            else:
                value_to_id[key] = next_id
                next_id += 1
                minted += 1
            option_order.append(key)
        value_products.setdefault(key, []).append(code)

    options_path = OUT_DIR / "Options_Import.csv"
    with options_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, fieldnames=["id", "optioncatid", "optionsdesc", "pricediff", "applytoproductcodes"]
        )
        w.writeheader()
        for key in option_order:
            cat, desc, pricediff = key
            codes = sorted(set(value_products[key]))
            w.writerow({
                "id": str(value_to_id[key]),
                "optioncatid": cat,
                "optionsdesc": desc,
                "pricediff": pricediff,
                "applytoproductcodes": ",".join(codes),
            })
    print(f"Wrote {options_path} ({len(option_order)} unique option rows; "
          f"{reused} reused existing IDs, {minted} newly minted from {NEXT_NEW_ID_START})")

    # Out-of-stock-on-Saranoni option VALUES that are already live on McCabe (recommend removal).
    oos_existing_rows: list[dict[str, str]] = []
    if AUDIT_CSV.is_file():
        with AUDIT_CSV.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r.get("status") != "ok":
                    continue
                oos = [v for v in (r.get("out_of_stock_on_saranoni") or "").split("|") if v]
                live = set((r.get("mccabe_values") or "").split("|"))
                already_live_but_oos = [v for v in oos if v in live]
                if already_live_but_oos:
                    oos_existing_rows.append({
                        "productcode": r["productcode"],
                        "productname": r["productname"],
                        "option_category": r["option_category"],
                        "values_oos_on_saranoni_but_live_on_mccabe": "|".join(already_live_but_oos),
                    })

    oos_existing_path = OUT_DIR / "Existing_Options_Out_Of_Stock_On_Saranoni.csv"
    with oos_existing_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "productcode", "productname", "option_category",
                "values_oos_on_saranoni_but_live_on_mccabe",
            ],
        )
        w.writeheader()
        w.writerows(oos_existing_rows)
    print(f"Wrote {oos_existing_path} ({len(oos_existing_rows)} products with live-but-OOS values)")

    fully_oos_rows: list[dict[str, str]] = []
    if OOS_CSV.is_file():
        with OOS_CSV.open(newline="", encoding="utf-8") as f:
            fully_oos_rows = list(csv.DictReader(f))

    readme = OUT_DIR / "README.md"
    lines = [
        "# Saranoni variant/stock batch — 2026-07-16",
        "",
        "Generated from a live comparison of saranoni.com (Shopify `.js` product",
        "endpoint, including per-variant `available` stock flags) against the",
        "options currently rendered on each McCabe PDP.",
        "",
        "## 1. Options_Import.csv (single-step, safe / additive)",
        "",
        "Import via **Inventory → Import/Export → Options**. Columns:",
        "`id,optioncatid,optionsdesc,pricediff,applytoproductcodes` — the same",
        "format as `saranoni_options_import_current.csv`. The `applytoproductcodes`",
        "column assigns each new option value directly to the listed ProductCodes",
        "in this same import, so there is **no separate Products import step and",
        "nothing to merge by hand.** It only adds this new value to each listed",
        "product; it does not touch or remove any option that product already has.",
        "",
        "Values that already exist elsewhere in the catalog under the same Option",
        "Category with a $0 price diff reuse the existing ID (matches",
        "`saranoni_options_import_current.csv` / `Saranoni_Options_PriceDiff_Import.csv`);",
        f"brand-new values were minted starting at id {NEXT_NEW_ID_START}.",
        "**Before importing, re-export your current Options list from Volusion and",
        "confirm none of the minted IDs are already in use** (this repo only has",
        "prior export snapshots, not live read access to the full Volusion",
        "option-ID range).",
        "",
        "## 2. Existing_Options_Out_Of_Stock_On_Saranoni.csv",
        "",
        "Option values that are **already live and purchasable on McCabe today**",
        "but show `available: false` for every matching variant on saranoni.com.",
        "Recommended action: remove these specific values from the product's",
        "option selector (Options → find the option ID → Delete Assignment for",
        "that ProductCode), or set the product to backorder/hidden if the whole",
        "line is out.",
        "",
        "## 3. Fully out-of-stock products (saranoni_fully_out_of_stock_products.csv)",
        "",
        "Every variant is unavailable on saranoni.com for these product codes.",
        "Recommended action: set `HideProduct=Y` (or otherwise disable",
        "Add to Cart) until Saranoni restocks.",
        "",
    ]
    for r in fully_oos_rows:
        lines.append(f"- `{r['productcode']}` — {r['productname']} (hidden today: {r['hidden_on_volusion']})")
    readme.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {readme}")


if __name__ == "__main__":
    main()
