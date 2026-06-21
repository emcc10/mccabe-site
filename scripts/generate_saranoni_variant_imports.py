"""Generate Volusion Options + Products import CSVs for Saranoni SKUs missing variants."""
from __future__ import annotations

import argparse
import csv
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "catalog" / "saranoni-imports"

COLOR_CAT = "23"
SIZE_CAT = "58"

HANDLE_TO_CODE = {
    "cotton-muslin-4-layer-quilt": "SAR-COTTON-MSLN-4-LAYER",
    "wizarding-world-charm-minky-lush": "SAR-WIZARDIN-WORLD-CHARM",
}

# Pre-assign option IDs (empty Volusion slots / new size rows). Re-export Options after import to confirm.
PRODUCT_OPTION_IDS: dict[str, dict[str, str]] = {
    "SAR-COTTON-MSLN-4-LAYER": {
        "Simple Buds": "1159",
        "Pine": "1160",
        "Olive Branch": "1161",
        "Floral Fields": "1162",
    },
    "SAR-WIZARDIN-WORLD-CHARM": {
        "Mini": "1202",
        "Receiving": "1203",
        "Toddler": "1204",
        "XL": "1205",
    },
}


def fetch_product(handle: str) -> dict:
    url = f"https://saranoni.com/products/{handle}.json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=60).read())
    return data["product"]


def variant_axis(product: dict) -> tuple[str, list[dict]]:
    options = product.get("options") or []
    variants = product.get("variants") or []
    if not variants:
        raise ValueError("no variants")

    opt_names = [(o.get("name") or "").lower() for o in options]
    axis_idx = None
    cat = COLOR_CAT
    if "color" in opt_names:
        axis_idx = opt_names.index("color")
        cat = COLOR_CAT
    elif "size" in opt_names:
        axis_idx = opt_names.index("size")
        cat = SIZE_CAT
    elif len(options) == 1:
        axis_idx = 0
        name = opt_names[0]
        cat = COLOR_CAT if name == "color" else SIZE_CAT
    else:
        raise ValueError(f"unsupported options: {[o.get('name') for o in options]}")

    base = min(float(v["price"]) for v in variants)
    rows: list[dict] = []
    seen: set[str] = set()
    for v in variants:
        label = (v.get("option1") if axis_idx == 0 else v.get("option2")) or ""
        if axis_idx == 1:
            label = v.get("option2") or ""
        if axis_idx == 0:
            label = v.get("option1") or ""
        if not label or label in seen:
            continue
        seen.add(label)
        diff = int(round(float(v["price"]) - base))
        img = ""
        if v.get("image_id"):
            for i in product.get("images") or []:
                if i.get("id") == v["image_id"]:
                    img = i.get("src") or ""
                    break
        rows.append({"label": label, "pricediff": diff, "price": v["price"], "image": img})
    return cat, rows


def write_product_imports(code: str, handle: str, cat: str, rows: list[dict]) -> Path:
    out_dir = OUT_ROOT / code
    out_dir.mkdir(parents=True, exist_ok=True)
    id_map = PRODUCT_OPTION_IDS.get(code, {})
    missing_ids = [r["label"] for r in rows if r["label"] not in id_map]
    if missing_ids:
        raise ValueError(f"{code}: missing option id map for: {missing_ids}")

    opt_path = out_dir / "Options_Import.csv"
    with opt_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "optioncatid", "optionsdesc", "pricediff", "applytoproductcodes"])
        for r in rows:
            oid = id_map[r["label"]]
            w.writerow([oid, cat, r["label"], r["pricediff"], code])

    prod_path = out_dir / "Products_OptionIDs_Import.csv"
    option_ids = ",".join(id_map[r["label"]] for r in rows)
    with prod_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["ProductCode", "OptionIDs", "EnableOptions_InventoryControl"])
        w.writerow([code, option_ids, "Y"])

    img_path = out_dir / "variant_images.csv"
    with img_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "ProductCode",
                "VariantLabel",
                "OptionID",
                "ThumbFile",
                "SmallFile",
                "SaranoniImageURL",
                "SaranoniPrice",
            ]
        )
        for r in rows:
            oid = id_map[r["label"]]
            w.writerow(
                [
                    code,
                    r["label"],
                    oid,
                    f"{code}-{oid}-T.jpg",
                    f"{code}-{oid}-S.jpg",
                    r["image"],
                    r["price"],
                ]
            )

    readme = out_dir / "README.md"
    axis_name = "color" if cat == COLOR_CAT else "size"
    readme.write_text(
        f"# {code} — missing {axis_name} variants\n\n"
        f"Saranoni handle: `{handle}`\n\n"
        "## Volusion import steps\n\n"
        "1. Set the product **base price** to the lowest variant price "
        f"(${min(float(r['price']) for r in rows):.2f} on Saranoni).\n"
        "2. **Import** `Options_Import.csv` (Inventory → Import/Export → Options). "
        "Uses `applytoproductcodes` to link options to this product.\n"
        "3. **Import** `Products_OptionIDs_Import.csv` (Products import).\n"
        "4. Upload swatch/hero images from `variant_images.csv` to "
        f"`/v/vspfiles/photos/` as `ThumbFile` / `SmallFile`.\n"
        "5. Re-export Options to confirm IDs, then verify the PDP shows the selector.\n\n"
        "## Variants\n\n"
        + "\n".join(
            f"- **{r['label']}** — option ID `{id_map[r['label']]}`, "
            f"pricediff `{r['pricediff']}`, Saranoni ${float(r['price']):.2f}"
            for r in rows
        )
        + "\n",
        encoding="utf-8",
    )
    return out_dir


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "handles",
        nargs="*",
        default=list(HANDLE_TO_CODE.keys()),
        help="Shopify product handles",
    )
    args = parser.parse_args()

    for handle in args.handles:
        code = HANDLE_TO_CODE.get(handle)
        if not code:
            raise SystemExit(f"no product code map for handle: {handle}")
        product = fetch_product(handle)
        cat, rows = variant_axis(product)
        out = write_product_imports(code, handle, cat, rows)
        print(f"Wrote {out} ({len(rows)} {('color' if cat == COLOR_CAT else 'size')} options)")


if __name__ == "__main__":
    main()
