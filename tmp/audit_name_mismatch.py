#!/usr/bin/env python3
"""Audit SKU prefix vs productname mismatches in enriched export."""
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys_path = ROOT / "scripts" / "enrich_volusion_export_db3g94dk88.py"
# import SKU_COLLECTION from enrich script
import importlib.util

spec = importlib.util.spec_from_file_location("enrich", sys_path)
enrich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrich)

CSV_PATH = Path(r"c:\Users\erink\Downloads\SAVED_EXPORT_DB3G94DK88_enriched.csv")

rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))

mismatches = []
for row in rows:
    code = row["productcode"]
    if code in enrich.NAME_OVERRIDES or code in enrich.PRODUCTS:
        continue
    sku = enrich.internal_sku(code)
    if not sku:
        continue
    collection = enrich.collection_from_internal_sku(sku)
    if not collection:
        continue
    name = row.get("productname", "")
    if not enrich.name_has_collection(name, collection) or enrich.is_generic_productname(name):
        mismatches.append((code, sku, collection, name))

print(f"mismatches: {len(mismatches)}")
for item in mismatches:
    print(f"  {item[0]}  sku={item[1]}  expect={item[2]}  name={item[3]}")
