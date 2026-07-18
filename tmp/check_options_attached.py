import csv
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

imp = Path(r"c:\Users\erink\Downloads\Asaranoni_missing_variants_options_import.csv")
with imp.open(encoding="utf-8-sig", newline="") as f:
    irows = [
        {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        for r in csv.DictReader(f)
    ]

by_prod = defaultdict(list)
for r in irows:
    by_prod[r["applytoproductcodes"]].append(r["id"])

codes = [
    "SAR-LUSH",
    "SAR-SNUGGLER",
    "SAR-HOGWARTS-CREST-DBL-LAYER",
    "SAR-BMB-SETS",
    "SAR-STUFFED-ANIMALS",
]
for code in codes:
    url = f"https://www.mccabestheaterandliving.com/product-p/{code.lower()}.htm"
    try:
        html = urllib.request.urlopen(url, timeout=25).read().decode("utf-8", "replace")
    except Exception as e:
        print(code, "FETCH FAIL", e)
        continue
    oids = set(re.findall(r'<option[^>]+value=["\'](\d+)["\']', html, re.I))
    expected = set(by_prod.get(code, []))
    print("===", code, "===")
    print(" expected", sorted(expected, key=int))
    print(" html option values count", len(oids))
    print(" matched", sorted(expected & oids, key=int))
    print(" missing", sorted(expected - oids, key=int))
