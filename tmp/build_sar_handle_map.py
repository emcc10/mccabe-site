"""Build Saranoni handle -> McCabe Volusion code map from manifest CSVs."""
from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(r"c:\Users\erink\OneDrive\Documents\saraoni")
maps: dict[str, str] = {}

for csv_path in ROOT.glob("**/manifest.csv"):
    with csv_path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = (
                row.get("VolusionProductCode")
                or row.get("ProductCode")
                or ""
            ).strip()
            if not code.startswith("SAR-"):
                continue
            for key in ("SourcePage", "SourceURL", "SourceImageURL"):
                url = (row.get(key) or "").strip()
                if not url:
                    continue
                for m in re.finditer(r"/products/([a-z0-9-]+)", url, re.I):
                    maps[m.group(1).lower()] = code

# batch 01 uses saranoni.com/products/ handles
extra = {
    "ruched-minky-throw-blanket": "SAR-DBL-RCH-FX-FUR",
    "ruched-minky-extra-large-throw-blanket": "SAR-DBL-RCH-FX-FUR-XL-LG",
    "lush-throw-blankets": "SAR-LUSH",
    "lush-extra-large-blanket": "SAR-LUSH-XL-LG",
    "lush-xl-blankets": "SAR-LUSH-XL-LG",
    "chunky-knit-large-throw": "SAR-CHNK-KNT-LG",
    "chenille-fringe-blankets": "SAR-CHNL-FRNG",
    "chenille-fringe-xl-throw-blankets": "SAR-CHNL-FRNG-XL-LG",
    "patterned-faux-fur-throw-blanket": "SAR-PTRN-FX-FUR",
    "patterned-faux-fur-extra-large-throw-blanket": "SAR-PTRN-FX-FUR-XL-LG",
    "minky-stretch-throw-blankets": "SAR-MNKY-STR",
    "minky-stretch-xl-throw-blankets": "SAR-MNKY-STR-XL-LG",
    "minky-lush-throw-blankets": "SAR-MNKY-LUSH",
    "minky-lush-extra-large-throw-blankets": "SAR-MNKY-LUSH-XL-LG",
    "marble-faux-fur-minky-throw-blanket": "SAR-MARBLE-FX-FUR-MNKY",
    "marble-faux-fur-minky-extra-large-throw-blanket": "SAR-MARBLE-FX-FUR-MNKY-XL-LG",
    "bamboo-rayon-muslin-extra-large-4-layer-quilt": "SAR-BMBU-RYN-MSLN-XL-LG-4",
    "plush-faux-fur-throw-blankets": "SAR-PLSH-FX-FUR",
    "plush-faux-fur-xl-throw-blankets": "SAR-PLSH-FX-FUR-XL-LG",
    "grand-faux-fur-throw-blanket": "SAR-GRAND-FX-FUR",
    "grand-faux-fur-extra-large-throw-blanket": "SAR-GRAND-FX-FUR-XL-LG",
    "ribbed-bamboni-throw-blanket": "SAR-RIBBED-BMB",
    "ribbed-bamboni-extra-large-throw-blanket": "SAR-RIBBED-BMB-XL-LG",
    "waffle-knit-throw-blankets": "SAR-WFL-KNT",
    "waffle-knit-xl-throw-blankets": "SAR-WFL-KNT-XL-LG",
    "snuggler": "SAR-BMB-SNUGGLER",
    "cozy-bamboni-robes": "SAR-COZY-BMB-ROBES",
    "bamboni-sets": "SAR-BMB-SETS",
    "faux-fur-throw-blankets": "SAR-FX-FUR",
    "faux-fur-xl-throw-blankets": "SAR-FX-FUR-XL-LG",
}
maps.update({k: v for k, v in extra.items() if k not in maps or maps[k] == v})

for h in sorted(maps):
    print(f"{h}\t{maps[h]}")
print("COUNT", len(maps))
