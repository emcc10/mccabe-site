import csv
import json
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
handles = {
    "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer-quilt",
    "SAR-COTTON-MSLN-4-LAYER": "cotton-muslin-4-layer-quilt",
}

export = Path(r"c:\Users\erink\Downloads\Options_BCERWTHV9F.csv")
with export.open(encoding="utf-8-sig", newline="") as f:
    erows = [
        {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        for r in csv.DictReader(f)
    ]

for code, handle in handles.items():
    url = f"https://saranoni.com/products/{handle}.json"
    req = urllib.request.Request(url, headers=UA)
    try:
        p = json.loads(urllib.request.urlopen(req, timeout=30).read().decode())["product"]
    except Exception as e:
        print(code, handle, "FAIL", e)
        continue
    prices = [float(v["price"]) for v in p["variants"]]
    base = min(prices)
    print("===", code, handle, "base", base)
    for label in ("Amelia", "Jack", "Simple Buds", "Pine"):
        for v in p["variants"]:
            opts = " ".join(
                filter(None, [v.get("option1"), v.get("option2"), v.get("title")])
            )
            if label.lower() in opts.lower():
                price = float(v["price"])
                print(f"  {label}: price={price} pricediff={round(price-base,2)}")
                break

print()
print("Live options for those labels:")
for r in erows:
    d = (r.get("optionsdesc") or "")
    if d in {"Amelia", "Jack", "Simple Buds", "Pine"}:
        print(r["id"], d, r["pricediff"], r.get("applytoproductcodes", "")[:60])
