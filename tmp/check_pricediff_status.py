import csv
from pathlib import Path

export = Path(r"c:\Users\erink\Downloads\Options_BCERWTHV9F.csv")
imp = Path(r"c:\Users\erink\Downloads\Asaranoni_missing_variants_options_import.csv")
wrong = Path(
    r"C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\saranoni_wrong_pricediff_fix_options_import.csv"
)
cents = Path(
    r"C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\catalog\saranoni-gap-report\saranoni_pricediff_cents_bug_fix_options_import.csv"
)

with export.open(encoding="utf-8-sig", newline="") as f:
    erows = [
        {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        for r in csv.DictReader(f)
    ]
e_by = {int(r["id"]): r for r in erows if r.get("id", "").isdigit()}

with imp.open(encoding="utf-8-sig", newline="") as f:
    irows = [
        {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        for r in csv.DictReader(f)
    ]

print("=== Nonzero pricediffs from missing-variants import (live) ===")
for r in irows:
    if float(r["pricediff"] or 0) != 0:
        live = e_by.get(int(r["id"]), {})
        print(
            r["id"],
            r["applytoproductcodes"],
            r["optionsdesc"],
            "import=",
            r["pricediff"],
            "live=",
            live.get("pricediff"),
        )

print()
print("=== Known pricediff FIX sheets vs live export ===")
for p in [wrong, cents]:
    with p.open(encoding="utf-8-sig", newline="") as f:
        rows = [
            {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
            for r in csv.DictReader(f)
        ]
    print("--", p.name)
    fixed = not_fixed = missing = 0
    for r in rows:
        if not r.get("id", "").isdigit():
            continue
        oid = int(r["id"])
        e = e_by.get(oid)
        want = r.get("pricediff")
        have = e.get("pricediff") if e else None
        if e is None:
            missing += 1
            status = "MISSING"
        elif abs(float(have or 0) - float(want or 0)) < 0.001:
            fixed += 1
            status = "OK"
        else:
            not_fixed += 1
            status = "NOT FIXED"
        if status != "OK":
            print(
                f"  {status} id={oid} {r.get('optionsdesc')!r} want={want} live={have} "
                f"was={r.get('live_wrong_pricediff') or r.get('was_likely_cents_bug')} "
                f"apply={r.get('applytoproductcodes', '')[:50]}"
            )
    print(f"  summary OK={fixed} NOT_FIXED={not_fixed} MISSING={missing}")

# Also flag SAR options with suspiciously large pricediffs in export
print()
print("=== SAR options in export with |pricediff| >= 50 ===")
for r in erows:
    apply = r.get("applytoproductcodes") or ""
    if "SAR-" not in apply:
        continue
    try:
        pd = float(r.get("pricediff") or 0)
    except ValueError:
        continue
    if abs(pd) >= 50:
        print(r["id"], r["optionsdesc"], pd, apply[:80])
