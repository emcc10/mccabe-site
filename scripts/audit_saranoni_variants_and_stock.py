"""Audit Saranoni (SAR-*) products: compare live Saranoni Shopify data (variants,
option values, per-variant stock) against what is currently live on the McCabe
Volusion PDP, to find (a) missing Color/Size option values and (b) Saranoni-side
out-of-stock combinations that should not be purchasable on McCabe.

Read-only against McCabe (scrapes the live PDP <select> options) and Saranoni
(scrapes https://saranoni.com/products/{handle}.js). Writes report CSVs only;
does not touch any site file or template.

Usage:
    py scripts/audit_saranoni_variants_and_stock.py
"""
from __future__ import annotations

import csv
import html as htmlmod
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_CSV = Path(
    r"C:\Users\erink\Downloads\Saranoni_Complete_Volusion_Image_Recovery\current_saranoni_products.csv"
)
OUT_DIR = ROOT / "tmp" / "saranoni-variant-stock-audit"

COLOR_OPTION_ID = "23"
SIZE_OPTION_ID = "58"
MCCABE_BASE = "https://www.mccabestheaterandliving.com/ProductDetails.asp"
SARONI_PRODUCT_JS = "https://saranoni.com/products/{handle}.js"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
)


def fetch_text(url: str, tries: int = 3) -> str:
    last_err: Exception | None = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.5 * (i + 1))
    raise last_err  # type: ignore[misc]


def mccabe_options(product_code: str) -> dict[str, list[str]]:
    url = MCCABE_BASE + "?ProductCode=" + urllib.parse.quote(product_code)
    try:
        html_text = fetch_text(url)
    except Exception:
        return {}
    out: dict[str, list[str]] = {}
    for option_id in (COLOR_OPTION_ID, SIZE_OPTION_ID):
        m = re.search(
            rf'<SELECT[^>]*name="SELECT___{re.escape(product_code)}___{option_id}"[^>]*>(.*?)</SELECT>',
            html_text,
            re.I | re.S,
        )
        if not m:
            continue
        vals: list[str] = []
        for om in re.finditer(
            r'<OPTION[^>]*value="([^"]*)"[^>]*>(.*?)</OPTION>', m.group(1), re.I | re.S
        ):
            text = htmlmod.unescape(re.sub(r"<[^>]+>", "", om.group(2)))
            text = re.sub(r"\s+", " ", text).strip()
            if not text or re.match(r"^(please|choose|select|--)", text, re.I):
                continue
            vals.append(text)
        if vals:
            out[option_id] = vals
    return out


def fetch_saranoni_js(handle: str) -> dict | None:
    url = SARONI_PRODUCT_JS.format(handle=handle)
    try:
        return json.loads(fetch_text(url))
    except Exception:
        return None


def axis_from_options(product: dict) -> dict[str, list[str]]:
    axis: dict[str, list[str]] = {}
    for opt in product.get("options") or []:
        name = (opt.get("name") or "").strip().lower()
        values = [v for v in (opt.get("values") or []) if v]
        if not values:
            continue
        if name == "color":
            axis[COLOR_OPTION_ID] = values
        elif name == "size":
            axis[SIZE_OPTION_ID] = values
    return axis


def value_availability(product: dict, axis: dict[str, list[str]]) -> dict[str, dict[str, bool]]:
    """value_availability[option_id][value] = True if ANY variant with that value is available."""
    options = product.get("options") or []
    opt_names = [(o.get("name") or "").lower() for o in options]
    color_idx = opt_names.index("color") if "color" in opt_names else None
    size_idx = opt_names.index("size") if "size" in opt_names else None

    out: dict[str, dict[str, bool]] = {k: {v: False for v in vals} for k, vals in axis.items()}
    for v in product.get("variants") or []:
        available = bool(v.get("available"))
        opts = [v.get("option1"), v.get("option2"), v.get("option3")]
        if color_idx is not None and COLOR_OPTION_ID in out:
            label = opts[color_idx]
            if label in out[COLOR_OPTION_ID]:
                out[COLOR_OPTION_ID][label] = out[COLOR_OPTION_ID][label] or available
        if size_idx is not None and SIZE_OPTION_ID in out:
            label = opts[size_idx]
            if label in out[SIZE_OPTION_ID]:
                out[SIZE_OPTION_ID][label] = out[SIZE_OPTION_ID][label] or available
    return out


def price_diffs(product: dict, axis: dict[str, list[str]]) -> dict[str, dict[str, int]]:
    variants = product.get("variants") or []
    options = product.get("options") or []
    if not variants:
        return {k: {v: 0 for v in vals} for k, vals in axis.items()}
    opt_names = [(o.get("name") or "").lower() for o in options]
    color_idx = opt_names.index("color") if "color" in opt_names else None
    size_idx = opt_names.index("size") if "size" in opt_names else None

    base = min(float(v["price"]) for v in variants)
    out: dict[str, dict[str, int]] = {k: {} for k in axis}
    for v in variants:
        price = float(v["price"])
        opts = [v.get("option1"), v.get("option2"), v.get("option3")]
        if color_idx is not None and COLOR_OPTION_ID in axis:
            label = opts[color_idx]
            if label in axis[COLOR_OPTION_ID]:
                cur = out[COLOR_OPTION_ID].get(label, 10**9)
                out[COLOR_OPTION_ID][label] = min(cur, int(round(price - base)))
        if size_idx is not None and SIZE_OPTION_ID in axis:
            label = opts[size_idx]
            if label in axis[SIZE_OPTION_ID]:
                cur = out[SIZE_OPTION_ID].get(label, 10**9)
                out[SIZE_OPTION_ID][label] = min(cur, int(round(price - base)))
    for cat, vals in axis.items():
        for label in vals:
            out[cat].setdefault(label, 0)
    return out


def load_catalog() -> list[dict[str, str]]:
    with CATALOG_CSV.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = load_catalog()

    handle_cache: dict[str, dict | None] = {}
    audit_rows: list[dict[str, str]] = []
    fully_oos_products: list[dict[str, str]] = []
    missing_option_rows: list[dict[str, str]] = []
    fetch_failures: list[str] = []

    for i, row in enumerate(catalog):
        code = row["ProductCode"].strip()
        name = row.get("ProductName", code).strip()
        handle = row.get("Handle", "").strip()
        hidden = (row.get("HideProduct") or "").strip().upper() == "Y"
        if not handle:
            audit_rows.append({
                "productcode": code, "productname": name, "handle": "",
                "hidden_on_volusion": str(hidden), "status": "no_handle",
            })
            continue

        if handle not in handle_cache:
            time.sleep(0.4)
            try:
                handle_cache[handle] = fetch_saranoni_js(handle)
            except Exception:
                handle_cache[handle] = None
                fetch_failures.append(f"{code} ({handle})")
        product = handle_cache[handle]

        if not product:
            audit_rows.append({
                "productcode": code, "productname": name, "handle": handle,
                "hidden_on_volusion": str(hidden), "status": "saranoni_fetch_failed",
            })
            continue

        axis = axis_from_options(product)
        if not axis:
            audit_rows.append({
                "productcode": code, "productname": name, "handle": handle,
                "hidden_on_volusion": str(hidden), "status": "no_variant_options_on_saranoni",
                "saranoni_available": str(bool(product.get("available"))),
            })
            continue

        time.sleep(0.3)
        mccabe = mccabe_options(code)
        avail = value_availability(product, axis)
        diffs = price_diffs(product, axis)

        product_fully_oos = not bool(product.get("available"))

        for option_id, cat_name in ((COLOR_OPTION_ID, "Color"), (SIZE_OPTION_ID, "Size")):
            if option_id not in axis:
                continue
            saranoni_values = axis[option_id]
            mccabe_values = set(mccabe.get(option_id, []))
            missing = [v for v in saranoni_values if v not in mccabe_values]
            oos_values = [v for v in saranoni_values if not avail[option_id].get(v, False)]
            in_stock_missing = [v for v in missing if v not in oos_values]

            audit_rows.append({
                "productcode": code,
                "productname": name,
                "handle": handle,
                "hidden_on_volusion": str(hidden),
                "status": "ok",
                "option_category": cat_name,
                "saranoni_values": "|".join(saranoni_values),
                "mccabe_values": "|".join(sorted(mccabe_values)),
                "missing_on_mccabe": "|".join(missing),
                "out_of_stock_on_saranoni": "|".join(oos_values),
                "safe_to_add_missing_in_stock": "|".join(in_stock_missing),
                "saranoni_available": str(bool(product.get("available"))),
            })

            for label in in_stock_missing:
                missing_option_rows.append({
                    "productcode": code,
                    "productname": name,
                    "optioncatid": option_id,
                    "optionsdesc": label,
                    "pricediff": str(diffs.get(option_id, {}).get(label, 0)),
                })

        if product_fully_oos:
            fully_oos_products.append({
                "productcode": code, "productname": name, "handle": handle,
                "hidden_on_volusion": str(hidden),
                "reason": "All variants unavailable on saranoni.com",
            })

        if (i + 1) % 10 == 0:
            print(f"...{i + 1}/{len(catalog)} processed")

    audit_path = OUT_DIR / "saranoni_variant_stock_audit.csv"
    fieldnames = [
        "productcode", "productname", "handle", "hidden_on_volusion", "status",
        "option_category", "saranoni_values", "mccabe_values", "missing_on_mccabe",
        "out_of_stock_on_saranoni", "safe_to_add_missing_in_stock", "saranoni_available",
    ]
    with audit_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in audit_rows:
            w.writerow({k: r.get(k, "") for k in fieldnames})
    print(f"Wrote {audit_path} ({len(audit_rows)} rows)")

    missing_path = OUT_DIR / "saranoni_missing_options_to_add.csv"
    with missing_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, fieldnames=["productcode", "productname", "optioncatid", "optionsdesc", "pricediff"]
        )
        w.writeheader()
        w.writerows(missing_option_rows)
    print(f"Wrote {missing_path} ({len(missing_option_rows)} rows)")

    oos_path = OUT_DIR / "saranoni_fully_out_of_stock_products.csv"
    with oos_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f, fieldnames=["productcode", "productname", "handle", "hidden_on_volusion", "reason"]
        )
        w.writeheader()
        w.writerows(fully_oos_products)
    print(f"Wrote {oos_path} ({len(fully_oos_products)} rows)")

    if fetch_failures:
        print("Saranoni fetch failed for:", ", ".join(fetch_failures))


if __name__ == "__main__":
    main()
