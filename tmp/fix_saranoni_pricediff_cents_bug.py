import csv
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "catalog" / "saranoni-gap-report"
OUT.mkdir(parents=True, exist_ok=True)

HANDLE_TO_CODE = {
    "wearable-blanket": "SAR-WEARABLE",
    "lush-throw-blankets": "SAR-LUSH",
    "lush-mini-blanket": "SAR-LUSH-MINI",
    "lush-extra-large-blanket": "SAR-LUSH-XL-LG",
    "cozy-bamboni-robe": "SAR-COZY-BMB-ROBES",
    "snuggler": "SAR-SNUGGLER",
    "grand-faux-fur-throw-blankets-new": "SAR-GRAND-FX-FUR",
    "stretchy-swaddle": "SAR-STRETCHY-SWADDLES-HATS",
    "harry-potter-icons-minky-lush": "SAR-HP-HP-ICONS-MNKY-LUSH",
    "justice-league-snuggler": "SAR-JL-JL-SNUGGLER",
    "waffle-knit-robes": "SAR-WFL-KNT-ROBES",
    "minky-stretch-luxe-robes": "SAR-MNKY-STR-LUXE-ROBES",
    "grand-faux-fur-robes": "SAR-GRAND-FX-FUR-ROBES",
}

# Live McCabe option IDs observed for wearable size axis
WEARABLE_SIZE_IDS = {
    "Small Minky": "1411",
    "Medium Minky": "1412",
    "Small Faux Fur": "1413",
    "Medium Faux Fur": "1414",
}
WEARABLE_COLOR_IDS = {
    "Feather": "1049",
    "Cream": "1154",
    "Hazel": "1155",
}


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def shopify_dollars(cents_or_dollars: float) -> float:
    """Shopify product JSON prices are integer cents."""
    v = float(cents_or_dollars)
    # Heuristic: values >= 100 are almost certainly cents for these blankets.
    if v >= 100:
        return round(v / 100.0, 2)
    return round(v, 2)


def axis_pricediffs(product: dict) -> dict[str, dict[str, float]]:
    """Return {axis_name: {label: pricediff_dollars}} using compare_at when present else price."""
    options = product.get("options") or []
    variants = product.get("variants") or []
    if not variants:
        return {}

    def money(v: dict) -> float:
        compare = v.get("compare_at_price")
        if compare not in (None, "", 0, "0"):
            return shopify_dollars(compare)
        return shopify_dollars(v["price"])

    base = min(money(v) for v in variants)
    out: dict[str, dict[str, float]] = {}
    for oi, opt in enumerate(options):
        name = (opt.get("name") or f"option{oi+1}").strip()
        key = f"option{oi+1}"
        diffs: dict[str, float] = {}
        for v in variants:
            label = (v.get(key) or "").strip()
            if not label:
                continue
            diff = round(money(v) - base, 2)
            if label not in diffs or diff < diffs[label]:
                diffs[label] = diff
        out[name] = diffs
    return {"__base__": {"__base__": base}, **out}


def main() -> None:
    # Wearable-focused fix first + known bad IDs from live audit
    wearable = fetch_json("https://saranoni.com/products/wearable-blanket.json")["product"]
    diffs = axis_pricediffs(wearable)
    base = diffs["__base__"]["__base__"]
    size_name = next(k for k in diffs if k.lower() == "size")
    color_name = next(k for k in diffs if k.lower() == "color")
    size_diffs = diffs[size_name]
    color_diffs = diffs[color_name]

    print("Wearable base (retail)", base)
    print("Size diffs", size_diffs)
    print("Color diffs", color_diffs)

    # Options import: fix the four size options' pricediffs
    options_rows = []
    for label, oid in WEARABLE_SIZE_IDS.items():
        pd = size_diffs.get(label, 0.0)
        # Volusion pricediff as number; keep 2 decimals when needed
        pd_str = ("%g" % pd) if float(pd) == int(pd) else f"{pd:.2f}"
        options_rows.append(
            {
                "id": oid,
                "optioncatid": "58",
                "optionsdesc": label,
                "pricediff": pd_str,
                "applytoproductcodes": "SAR-WEARABLE",
            }
        )
    for label, oid in WEARABLE_COLOR_IDS.items():
        pd = color_diffs.get(label, 0.0)
        pd_str = ("%g" % pd) if float(pd) == int(pd) else f"{pd:.2f}"
        options_rows.append(
            {
                "id": oid,
                "optioncatid": "23",
                "optionsdesc": label,
                "pricediff": pd_str,
                "applytoproductcodes": "SAR-WEARABLE" if oid != "1049" else "",
            }
        )

    # Products import: attach size + color option IDs in sensible order
    # Size first (Small Minky, Medium Minky, Small Faux, Medium Faux), then colors
    size_order = ["Small Minky", "Medium Minky", "Small Faux Fur", "Medium Faux Fur"]
    color_order = ["Feather", "Cream", "Hazel"]
    option_ids = [WEARABLE_SIZE_IDS[l] for l in size_order] + [
        WEARABLE_COLOR_IDS[l] for l in color_order
    ]
    products_rows = [
        {
            "productcode": "SAR-WEARABLE",
            "optionids": ",".join(option_ids),
            "EnableOptions_InventoryControl": "Y",
        }
    ]

    # Variant images for COLORS (swatches) — size options usually don't have unique color images
    # Map each color to a representative image from Shopify
    images = wearable.get("images") or []
    color_to_url: dict[str, str] = {}
    for v in wearable.get("variants") or []:
        color = (v.get("option2") or "").strip()
        if not color or color in color_to_url:
            continue
        img_id = v.get("image_id")
        url = ""
        if img_id:
            for im in images:
                if im.get("id") == img_id:
                    url = im.get("src") or ""
                    break
        if not url:
            # fallback: first image whose alt/src mentions color
            for im in images:
                blob = f"{im.get('alt','')} {im.get('src','')}".lower()
                if color.lower() in blob:
                    url = im.get("src") or ""
                    break
        if url:
            color_to_url[color] = url.split("?")[0]

    # Also try matching by scanning all images if still missing
    if len(color_to_url) < len(color_order):
        for im in images:
            src = (im.get("src") or "").split("?")[0]
            alt = (im.get("alt") or "").lower()
            for color in color_order:
                if color in color_to_url:
                    continue
                if color.lower() in alt or color.lower().replace(" ", "") in src.lower():
                    color_to_url[color] = src

    img_rows = []
    for color in color_order:
        oid = WEARABLE_COLOR_IDS[color]
        url = color_to_url.get(color, "")
        img_rows.append(
            {
                "ProductCode": "SAR-WEARABLE",
                "VariantLabel": color,
                "OptionID": oid,
                "ThumbFile": f"SAR-WEARABLE-{oid}-T.jpg",
                "SmallFile": f"SAR-WEARABLE-{oid}-S.jpg",
                "SaranoniImageURL": url,
                "SaranoniPrice": f"{base:.2f}",
                "Notes": "Color swatch/main image for wearable",
            }
        )

    # Broader bad-pricediff audit against known live offenders
    bad_cases = [
        ("SAR-WEARABLE", "wearable-blanket", WEARABLE_SIZE_IDS),
        ("SAR-COZY-BMB-ROBES", "cozy-bamboni-robe", {"Tori Halford": "1341"}),
        ("SAR-SNUGGLER", "snuggler", {"Teen": "1349"}),
        ("SAR-GRAND-FX-FUR", "grand-faux-fur-throw-blankets-new", {"Snow Fox": "1352"}),
        ("SAR-STRETCHY-SWADDLES-HATS", "stretchy-swaddle", {"Swaddle": "1408"}),
        ("SAR-JL-JL-SNUGGLER", "justice-league-snuggler", {"Teen": "1349", "Adult": "1350"}),
    ]

    audit_rows = []
    for code, handle, id_map in bad_cases:
        try:
            prod = fetch_json(f"https://saranoni.com/products/{handle}.json")["product"]
            time.sleep(0.4)
        except Exception as e:
            audit_rows.append(
                {
                    "ProductCode": code,
                    "Handle": handle,
                    "OptionLabel": "",
                    "OptionID": "",
                    "CurrentSuspectPriceDiff": "",
                    "CorrectPriceDiffDollars": "",
                    "BaseRetail": "",
                    "Error": str(e),
                }
            )
            continue
        d = axis_pricediffs(prod)
        base_r = d["__base__"]["__base__"]
        # flatten all axis diffs
        flat = {}
        for axis, vals in d.items():
            if axis == "__base__":
                continue
            for label, pd in vals.items():
                flat[label] = pd
        for label, oid in id_map.items():
            correct = flat.get(label)
            if correct is None:
                # try case-insensitive
                for k, v in flat.items():
                    if k.lower() == label.lower():
                        correct = v
                        break
            audit_rows.append(
                {
                    "ProductCode": code,
                    "Handle": handle,
                    "OptionLabel": label,
                    "OptionID": oid,
                    "CurrentSuspectPriceDiff": "",
                    "CorrectPriceDiffDollars": "" if correct is None else f"{correct:.2f}",
                    "BaseRetail": f"{base_r:.2f}",
                    "Error": "" if correct is not None else "label not found on Saranoni",
                }
            )

    def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for row in rows:
                w.writerow({k: row.get(k, "") for k in fieldnames})

    opt_path = OUT / "saranoni_wearable_pricediff_fix_options_import.csv"
    # Only emit size rows with apply codes for the fix import; Feather is shared — don't overwrite apply list with blank
    fix_options = [r for r in options_rows if r["id"] in WEARABLE_SIZE_IDS.values()]
    # Also include color rows that are wearable-only (Cream/Hazel) with pricediff 0
    fix_options += [r for r in options_rows if r["id"] in {"1154", "1155"}]
    write_csv(
        opt_path,
        fix_options,
        ["id", "optioncatid", "optionsdesc", "pricediff", "applytoproductcodes"],
    )

    prod_path = OUT / "saranoni_wearable_products_optionids_import.csv"
    write_csv(
        prod_path,
        products_rows,
        ["productcode", "optionids", "EnableOptions_InventoryControl"],
    )
    # Excel-safe TSV (optionids as text)
    tsv_path = OUT / "saranoni_wearable_products_optionids_import_excel_safe.tsv"
    with tsv_path.open("w", encoding="utf-8", newline="") as f:
        f.write("productcode\toptionids\tEnableOptions_InventoryControl\n")
        for r in products_rows:
            f.write(f"{r['productcode']}\t=\"{r['optionids']}\"\t{r['EnableOptions_InventoryControl']}\n")

    img_path = OUT / "saranoni_wearable_variant_images.csv"
    write_csv(
        img_path,
        img_rows,
        [
            "ProductCode",
            "VariantLabel",
            "OptionID",
            "ThumbFile",
            "SmallFile",
            "SaranoniImageURL",
            "SaranoniPrice",
            "Notes",
        ],
    )

    audit_path = OUT / "saranoni_bad_pricediff_audit.csv"
    write_csv(
        audit_path,
        audit_rows,
        [
            "ProductCode",
            "Handle",
            "OptionLabel",
            "OptionID",
            "CurrentSuspectPriceDiff",
            "CorrectPriceDiffDollars",
            "BaseRetail",
            "Error",
        ],
    )

    # Broader options pricediff fix from audit (all known bad IDs)
    broader = []
    live_wrong = {
        "1412": ("Medium Minky", "58", "SAR-WEARABLE"),
        "1414": ("Medium Faux Fur", "58", "SAR-WEARABLE"),
        "1411": ("Small Minky", "58", "SAR-WEARABLE"),
        "1413": ("Small Faux Fur", "58", "SAR-WEARABLE"),
    }
    for row in audit_rows:
        oid = row["OptionID"]
        if not oid or row["CorrectPriceDiffDollars"] == "":
            continue
        # Infer optioncatid: size-ish vs color
        label = row["OptionLabel"]
        cat = "58"
        if label in {"Tori Halford", "Snow Fox", "Feather", "Cream", "Hazel"}:
            cat = "23"
        pd = float(row["CorrectPriceDiffDollars"])
        pd_str = ("%g" % pd) if float(pd) == int(pd) else f"{pd:.2f}"
        broader.append(
            {
                "id": oid,
                "optioncatid": cat,
                "optionsdesc": label,
                "pricediff": pd_str,
                "applytoproductcodes": row["ProductCode"],
                "was_likely_cents_bug": "Y",
            }
        )
    # Ensure wearable mediums are included even if audit path differed
    for oid, (label, cat, code) in live_wrong.items():
        if any(r["id"] == oid for r in broader):
            continue
        pd = size_diffs.get(label, 0.0)
        pd_str = ("%g" % pd) if float(pd) == int(pd) else f"{pd:.2f}"
        broader.append(
            {
                "id": oid,
                "optioncatid": cat,
                "optionsdesc": label,
                "pricediff": pd_str,
                "applytoproductcodes": code,
                "was_likely_cents_bug": "Y",
            }
        )

    broader_path = OUT / "saranoni_pricediff_cents_bug_fix_options_import.csv"
    write_csv(
        broader_path,
        broader,
        [
            "id",
            "optioncatid",
            "optionsdesc",
            "pricediff",
            "applytoproductcodes",
            "was_likely_cents_bug",
        ],
    )

    print("Wrote:")
    for p in [opt_path, prod_path, tsv_path, img_path, audit_path, broader_path]:
        print(" ", p)


if __name__ == "__main__":
    main()
