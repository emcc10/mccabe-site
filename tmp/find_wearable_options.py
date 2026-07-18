import csv
from pathlib import Path

files = [
    Path(r"C:\Users\erink\Downloads\Options_KM67CWBFZ9.csv"),
    Path(r"C:\Users\erink\Downloads\Options_ZUXH58E8NH.csv"),
    Path(r"C:\Users\erink\Downloads\Options_ZC5NMTEKDY.csv"),
    Path(r"C:\Users\erink\Downloads\Options_8Y7RWWZ9EF(3).csv"),
    Path(r"C:\Users\erink\Downloads\saranoni_options_import_current.csv"),
    Path(r"C:\Users\erink\Downloads\Copy of saranoni_volusion_variant_options_IMPORT_v3_MISSING_ONLY_SAFE.csv"),
    Path(r"C:\Users\erink\Downloads\Saranoni_Product_Specific_Options_Import.csv"),
    Path(r"C:\Users\erink\Downloads\Saranoni_Options_PriceDiff_Import.csv"),
]

targets = {"1411", "1412", "1413", "1414"}

for p in files:
    if not p.exists():
        print("missing", p.name)
        continue
    with p.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    print("==", p.name, "cols=", list(rows[0].keys()) if rows else None, "n=", len(rows))
    for row in rows:
        d = {(k or "").lower().strip(): (v or "").strip() for k, v in row.items()}
        oid = d.get("id") or d.get("optionid") or ""
        desc = d.get("optionsdesc") or d.get("optiondesc") or d.get("desc") or ""
        diff = d.get("pricediff") or d.get("optionpricediff") or ""
        apply = d.get("applytoproductcodes") or ""
        desc_l = desc.lower()
        interesting = (
            oid in targets
            or "medium faux" in desc_l
            or "medium minky" in desc_l
            or "small faux" in desc_l
            or "small minky" in desc_l
            or ("wearable" in apply.lower())
        )
        if not interesting:
            try:
                dv = float(str(diff).replace("$", "").replace(",", "") or 0)
            except ValueError:
                dv = 0
            interesting = dv >= 100 and "sar-" in apply.lower()
        if interesting:
            print(f"  id={oid} desc={desc!r} pricediff={diff} apply={apply[:80]}")
