import csv
import re
from pathlib import Path

path = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\steve-silver-active\SAVED_EXPORT_DB3G94DK88_enriched.csv")
rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
for row in rows:
    name = row.get("productname", "")
    cat = row.get("productcategory", "")
    if cat == "217" or re.search(r"\b(server|sideboard|buffet)\b", name, re.I):
        print(f"{row['productcode']}\t{row.get('productprice','')}\t{name}")
