import csv
from collections import Counter
from pathlib import Path

p = Path(r"c:\Users\erink\Downloads\saranoni_missing_variants_options_import.csv")
raw = p.read_bytes()
print("BOM", raw[:3])
print("size", len(raw))
print("crlf", b"\r\n" in raw, "lf_only", b"\n" in raw and b"\r\n" not in raw)
text = raw.decode("utf-8-sig")
lines = text.splitlines()
print("lines", len(lines))
print("header", repr(lines[0]))
print("last line", repr(lines[-1]))

with p.open(newline="", encoding="utf-8-sig") as f:
    r = csv.DictReader(f)
    print("fieldnames", r.fieldnames)
    rows = list(r)
print("rowcount", len(rows))

issues = []
for i, row in enumerate(rows, 2):
    for k, v in row.items():
        if v is None or str(v).strip() == "":
            issues.append((i, "empty", k, dict(row)))
    try:
        float(row.get("pricediff", ""))
    except Exception:
        issues.append((i, "bad pricediff", row.get("pricediff"), dict(row)))
    try:
        int(row.get("optioncatid", ""))
    except Exception:
        issues.append((i, "bad optioncatid", row.get("optioncatid"), dict(row)))

keys = [(row["applytoproductcodes"], row["optioncatid"], row["optionsdesc"]) for row in rows]
dups = [(k, n) for k, n in Counter(keys).items() if n > 1]
print("dups", len(dups), dups[:10])
print("issues", len(issues), issues[:20])
prods = sorted(set(r["applytoproductcodes"] for r in rows))
print("products", len(prods))
for prod in prods:
    print(" ", prod)
print("cats", sorted(set(r["optioncatid"] for r in rows)))
nonzero = [
    (r["applytoproductcodes"], r["optionsdesc"], r["pricediff"])
    for r in rows
    if float(r["pricediff"]) != 0
]
print("nonzero pricediff count", len(nonzero))
decimals = [r for r in rows if "." in r["pricediff"]]
print("decimal pricediffs", [(r["applytoproductcodes"], r["optionsdesc"], r["pricediff"]) for r in decimals])
# hyphens / special
for r in rows:
    d = r["optionsdesc"]
    if any(ch in d for ch in '",\t') or "  " in d:
        print("special", r["applytoproductcodes"], repr(d))
