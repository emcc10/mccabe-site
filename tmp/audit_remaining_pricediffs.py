"""Compare live Options export pricediffs vs Saranoni Shopify prices."""
import csv
import json
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"C:\Users\erink\OneDrive\Documents\GitHub\mccabe-site")
export = Path(r"c:\Users\erink\Downloads\Options_BCERWTHV9F.csv")

# product code -> saranoni handle (extend as needed)
HANDLES = {
    "SAR-STRETCHY-SWADDLES-HATS": "stretchy-swaddle",
    "SAR-FX-FUR-PILLOWCA": "faux-fur-pillowcase",
    "SAR-SUPERMAN-DBL-LAYER-BMB": "superman-double-layer-bamboni",
    "SAR-WONDER-WOMAN-DBL-LAYER": "wonder-woman-double-layer-bamboni",
    "SAR-BATMAN-DBL-LAYER-BMB": "batman-double-layer-bamboni",
    "SAR-BOY-WHO-LIVED-DBL-LAYER": "the-boy-who-lived-double-layer-bamboni",
    "SAR-HOGWARTS-CREST-DBL-LAYER": "hogwarts-crest-double-layer-bamboni",
    "SAR-VERY-HGRY-CAT-MNKY-STR": "very-hungry-caterpillar-minky-stretch",
    "SAR-SNUGGLER": "snuggler",
    "SAR-BMBU-RYN-MSLN-4-LAYER": "bamboo-rayon-muslin-4-layer",
    "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer",
    "SAR-COTTON-MSLN-4-LAYER": "cotton-muslin-4-layer",
    "SAR-WEARABLE": "wearable-blanket",
    "SAR-HP-HP-MSLN-NRS": "harry-potter-muslin-nursery",
    "SAR-JL-JL-MSLN-LUSH": "justice-league-muslin-lush",
}

UA = {"User-Agent": "Mozilla/5.0 (compatible; McCabeAudit/1.0)"}


def fetch_product(handle: str) -> dict | None:
    url = f"https://saranoni.com/products/{handle}.json"
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode()).get("product")
        except Exception as e:
            print("fetch fail", handle, e, "try", i + 1)
            time.sleep(1.5 * (i + 1))
    return None


def money(v) -> float:
    # Shopify .json prices are dollar strings
    return float(v)


with export.open(encoding="utf-8-sig", newline="") as f:
    erows = [
        {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        for r in csv.DictReader(f)
    ]

# Focus: SAR options with nonzero pricediff, plus known cents-bug IDs
focus_ids = {1337, 1338, 1339, 1340, 1408, 1494, 1496, 1497}
focus_codes = set(HANDLES)
rows = []
for r in erows:
    apply = r.get("applytoproductcodes") or ""
    if "SAR-" not in apply:
        continue
    oid = int(r["id"])
    try:
        pd = float(r.get("pricediff") or 0)
    except ValueError:
        continue
    codes = [c.strip() for c in apply.split(",") if c.strip().startswith("SAR-")]
    if oid in focus_ids or pd != 0 or any(c in focus_codes for c in codes):
        for code in codes:
            rows.append(
                {
                    "id": oid,
                    "code": code,
                    "desc": r.get("optionsdesc") or "",
                    "cat": r.get("optioncatid") or "",
                    "live_pd": pd,
                }
            )

# Fetch needed handles
needed = sorted({HANDLES[c] for c in {r["code"] for r in rows} if c in HANDLES})
products = {}
for h in needed:
    p = fetch_product(h)
    products[h] = p
    print("got", h, "variants" if p else "NONE", len(p["variants"]) if p else 0)
    time.sleep(0.4)

print()
print("id,code,desc,live_pd,saranoni_variant,saranoni_price,base_guess,correct_pd,status")
problems = []
for r in sorted(rows, key=lambda x: (x["code"], x["id"])):
    handle = HANDLES.get(r["code"])
    if not handle or not products.get(handle):
        continue
    p = products[handle]
    variants = p["variants"]
    # base = min compare_at or price
    prices = []
    for v in variants:
        price = money(v["price"])
        cap = v.get("compare_at_price")
        prices.append(money(cap) if cap else price)
    base = min(prices) if prices else None
    # match label loosely
    label = r["desc"].strip().lower()
    match = None
    for v in variants:
        titles = " / ".join(
            filter(
                None,
                [v.get("option1"), v.get("option2"), v.get("option3"), v.get("title")],
            )
        ).lower()
        if label and label in titles:
            match = v
            break
        # also exact option match
        for opt in (v.get("option1"), v.get("option2"), v.get("option3")):
            if opt and opt.strip().lower() == label:
                match = v
                break
        if match:
            break
    if not match:
        # only print if nonzero or focus
        if r["live_pd"] != 0 or r["id"] in focus_ids:
            print(
                f"{r['id']},{r['code']},{r['desc']},{r['live_pd']},NO_MATCH,,,,"
            )
        continue
    sp = money(match.get("compare_at_price") or match["price"])
    # also retail price
    retail = money(match["price"])
    correct = round(sp - base, 2)
    correct_retail = round(retail - min(money(v["price"]) for v in variants), 2)
    live = r["live_pd"]
    ok = abs(live - correct) < 0.02 or abs(live - correct_retail) < 0.02
    status = "OK" if ok else "WRONG"
    if r["live_pd"] != 0 or r["id"] in focus_ids or not ok:
        print(
            f"{r['id']},{r['code']},{r['desc']},{live},{match['title']},{sp}/{retail},{base},{correct}/{correct_retail},{status}"
        )
    if not ok and (live != 0 or r["id"] in focus_ids):
        problems.append(
            {
                **r,
                "saranoni_title": match["title"],
                "saranoni_compare": sp,
                "saranoni_price": retail,
                "base": base,
                "correct_compare": correct,
                "correct_retail": correct_retail,
            }
        )

print()
print("PROBLEM COUNT", len(problems))
for p in problems:
    print(
        p["id"],
        p["code"],
        p["desc"],
        "live",
        p["live_pd"],
        "should_be~",
        p["correct_compare"],
        "or_retail",
        p["correct_retail"],
        "|",
        p["saranoni_title"],
        p["saranoni_compare"],
        "base",
        p["base"],
    )
