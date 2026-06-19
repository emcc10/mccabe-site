#!/usr/bin/env python3
import csv
import importlib.util
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
    "enrich", ROOT / "scripts" / "enrich_volusion_export_db3g94dk88.py"
)
enrich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrich)

CSV_PATH = Path(r"c:\Users\erink\Downloads\SAVED_EXPORT_DB3G94DK88_enriched.csv")
rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))

pending = []
for row in rows:
    code = row["productcode"]
    if code in enrich.PRODUCTS or code in enrich.NAME_OVERRIDES:
        continue
    sku = enrich.internal_sku(code)
    if not sku:
        continue
    collection = enrich.collection_from_internal_sku(sku)
    if enrich.needs_vendor_copy(row, sku, collection):
        pending.append((code, sku, collection, row.get("productname", "")))

print(f"needs vendor copy: {len(pending)}")
for item in pending:
    print(f"  {item[0]}  {item[2]}  {item[3]}")
