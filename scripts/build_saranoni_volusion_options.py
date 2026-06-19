"""Build Volusion option import CSVs for Saranoni products missing Color/Size variants."""
from __future__ import annotations

import argparse
import csv
import html as htmlmod
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = Path(
    r"c:\Users\erink\Downloads\SARANONI_VOLUSION_DESCRIPTIONS_FEATURES_REVIEW.csv"
)
DEFAULT_OUT = Path(r"c:\Users\erink\Downloads")

COLOR_OPTION_ID = "23"
SIZE_OPTION_ID = "58"
MCCABE_BASE = "https://www.mccabestheaterandliving.com/ProductDetails.asp"
SARONI_PRODUCT_JSON = "https://saranoni.com/products/{handle}.json"

# Shopify handle -> McCabe Volusion ProductCode (merged from prior image scripts + collabs)
HANDLE_TO_CODE: dict[str, str] = {
    "ruched-minky-throw-blanket": "SAR-DBL-RCH-FX-FUR",
    "ruched-minky-extra-large-throw-blanket": "SAR-DBL-RCH-FX-FUR-XL-LG",
    "lush-throw-blankets": "SAR-LUSH",
    "lush-extra-large-blanket": "SAR-LUSH-XL-LG",
    "lush-toddler-blanket": "SAR-LUSH-TOD",
    "chunky-knit-large-throw": "SAR-CHNK-KNT-LG",
    "chenille-fringe-blankets": "SAR-CHNL-FRNG",
    "chenille-fringe-xl-throw-blankets": "SAR-CHNL-FRNG-XL-LG",
    "patterned-faux-fur-throw-blanket": "SAR-PTRN-FX-FUR",
    "patterned-faux-fur-extra-large-throw-blanket": "SAR-PTRN-FX-FUR-XL-LG",
    "minky-stretch-throw-blankets": "SAR-MNKY-STR",
    "minky-stretch-xl-throw-blankets": "SAR-MNKY-STR-XL-LG",
    "minky-lush-xl-blankets": "SAR-MNKY-LUSH-XL-LG",
    "minky-lush-toddler-blankets": "SAR-MNKY-LUSH-TOD",
    "stuffed-animal-loveys-copy": "SAR-MNKY-LUSH",
    "bamboo-rayon-muslin-extra-large-4-layer-quilt": "SAR-BMBU-RYN-MSLN-XL-LG-4",
    "plush-faux-fur-throw-blankets": "SAR-PLSH-FX-FUR",
    "plush-faux-fur-xl-throw-blankets": "SAR-PLSH-FX-FUR-XL-LG",
    "grand-faux-fur-throw-blankets-new": "SAR-GRAND-FX-FUR",
    "grand-faux-fur-xl-throw-blankets-new": "SAR-GRAND-FX-FUR-XL-LG",
    "grand-faux-fur-king-blanket": "SAR-GRAND-FX-FUR-KING",
    "grand-faux-fur-queen-blanket": "SAR-GRAND-FX-FUR-QUEEN",
    "grand-faux-fur-12x20-pillow-cover": "SAR-GRAND-FX-FUR-12X20",
    "ribbed-bamboni-throw-blanket": "SAR-RIBBED-BMB",
    "ribbed-bamboni-extra-large-blanket": "SAR-RIBBED-BMB-XL-LG",
    "ribbed-bamboni-king-blanket": "SAR-RIBBED-BMB-QUEEN-KING",
    "waffle-knit-throw-blankets-1": "SAR-WFL-KNT",
    "waffle-knit-throw-blankets": "SAR-WFL-KNT-XL-LG",
    "waffle-knit-king-blankets": "SAR-WFL-KNT-KING",
    "waffle-knit-queen-blankets": "SAR-WFL-KNT-QUEEN",
    "waffle-knit-twin-blankets": "SAR-WFL-KNT-TWIN",
    "cozy-bamboni-robe": "SAR-COZY-BMB-ROBES",
    "bamboni-sets": "SAR-BMB-SETS",
    "lush-mini-blanket": "SAR-LUSH-MINI",
    "lush-receiving-blanket": "SAR-LUSH-RCV",
    "wearable-blanket": "SAR-WEARABLE",
    "waffle-knit-mini-blankets": "SAR-WFL-KNT-MINI",
    "bamboni-hat": "SAR-BMB-HATS",
    "bamboni-socks": "SAR-BMB-SOCKS",
    "bamboni-toddler-blanket": "SAR-BMB-TOD",
    "bamboni-snuggler": "SAR-BMB-SNUGGLER",
    "snuggler": "SAR-SNUGGLER",
    "playmat": "SAR-MNKY-PLAY-MAT",
    "double-layer-bamboni-toddler-blanket": "SAR-DBL-LAYER-BMB-TOD",
    "dream-toddler-blanket": "SAR-DREAM-TOD",
    "faux-fur-throw-blankets": "SAR-FX-FUR",
    "faux-fur-xl-throw-blankets": "SAR-FX-FUR-XL-LG",
    "faux-fur-toddler-blankets": "SAR-FX-FUR-TOD",
    "faux-fur-twin-blankets": "SAR-FX-FUR-TWIN",
    "faux-fur-full-queen-blankets": "SAR-FX-FUR-FULL-QUEEN",
    "faux-fur-king-blankets": "SAR-FX-FUR-KING",
    "bamboo-rayon-muslin-4-layer-quilt": "SAR-BMBU-RYN-MSLN-4-LAYER",
    "bamboo-rayon-muslin-queen-king-4-layer-quilt": "SAR-BMBU-RYN-MSLN-QUEEN-KING",
    "cotton-muslin-4-layer-quilt": "SAR-COTTON-MSLN-4-LAYER",
    "bamboni-twin-blankets": "SAR-BMB-TWIN",
    "bamboni-twin-blanket": "SAR-BAMBONI-TWIN-BLANKETS",
    "grand-faux-fur-robe": "SAR-GRAND-FX-FUR-ROBES",
    # Licensed / collaboration
    "harry-potter-muslin-nursery": "SAR-HP-HP-MSLN-NRS",
    "harry-potter-icons-minky-lush": "SAR-HP-HP-ICONS-MNKY-LUSH",
    "batman-double-layer-bamboni": "SAR-BATMAN-DBL-LAYER-BMB",
    "batman-minky-lush": "SAR-BATMAN-MNKY-LUSH",
    "the-boy-who-lived-double-layer-bamboni": "SAR-BOY-WHO-LIVED-DBL-LAYER",
    "hogwarts-crest-double-layer-bamboni": "SAR-HOGWARTS-CREST-DBL-LAYER",
    "justice-league-muslin-lush": "SAR-JL-JL-MSLN-LUSH",
    "justice-league-snuggler": "SAR-JL-JL-SNUGGLER",
    "elf-snuggler": "SAR-ELF-SNUGGLER",
    "peter-rabbit-muslin-lush-blankets": "SAR-PTR-RBT-BMBU-RYN-MSLN",
    "peter-rabbit-bamboo-rayon-muslin-lush-mini-blankets": "SAR-PTR-RBT-BMBU-RYN-MSLN-02",
    "peter-rabbit-cotton-muslin-2-pack-swaddles": "SAR-PTR-RBT-BMBU-RYN-MSLN-2",
    "peter-rabbit-cotton-muslin-changing-covers": "SAR-PTR-RBT-COTTON-MSLN",
    "peter-rabbit-cotton-crib-sheets": "SAR-PTR-RBT-COTTON-MSLN-CRIB",
}

CODE_TO_HANDLE = {v: k for k, v in HANDLE_TO_CODE.items()}

# Manual overrides when user spreadsheet differs from live Saranoni pricediffs.
PRICE_DIFF_OVERRIDES: dict[str, dict[str, int]] = {
    "SAR-HP-HP-MSLN-NRS": {
        "Muslin/Lush Mini": 7,
        "Swaddle": 0,
        "Crib Sheet": 7,
        "Changing Cover": 17,
        "Muslin/Lush Quilt": 50,
    },
}


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def mccabe_options(product_code: str) -> dict[str, list[str]]:
    url = MCCABE_BASE + "?ProductCode=" + urllib.parse.quote(product_code)
    html_text = fetch_text(url)
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


def fetch_saranoni_product(handle: str) -> dict | None:
    url = SARONI_PRODUCT_JSON.format(handle=handle)
    try:
        data = json.loads(fetch_text(url))
    except Exception:
        return None
    return data.get("product")


def option_axis(product: dict) -> dict[str, list[str]]:
    """Map Volusion option category id -> ordered option values from Shopify."""
    options = product.get("options") or []
    variants = product.get("variants") or []
    if not options or not variants:
        return {}

    axis: dict[str, list[str]] = {}
    for opt in options:
        name = (opt.get("name") or "").strip()
        values = [v for v in (opt.get("values") or []) if v and v != "Default Title"]
        if not values:
            continue
        if name.lower() == "color":
            axis[COLOR_OPTION_ID] = values
        elif name.lower() == "size":
            axis[SIZE_OPTION_ID] = values
        elif len(options) == 1 and name.lower() == "title":
            # Single-variant products; nothing to import.
            continue
        else:
            # Unknown option name; treat first non-color as size when only one other axis.
            other = [o for o in options if (o.get("name") or "").lower() != "color"]
            if name == (other[0].get("name") if other else ""):
                axis[SIZE_OPTION_ID] = values
    return axis


def price_diffs(product: dict, axis: dict[str, list[str]], product_code: str) -> dict[str, dict[str, int]]:
    variants = product.get("variants") or []
    options = product.get("options") or []
    if not variants:
        return {k: {v: 0 for v in vals} for k, vals in axis.items()}

    opt_names = [(o.get("name") or "").lower() for o in options]
    color_idx = opt_names.index("color") if "color" in opt_names else None
    size_idx = opt_names.index("size") if "size" in opt_names else None
    if color_idx is None and size_idx is None and len(opt_names) == 2:
        color_idx, size_idx = 0, 1
    elif color_idx is None and size_idx is None and len(opt_names) == 1:
        size_idx = 0

    base = min(float(v["price"]) for v in variants)
    out: dict[str, dict[str, int]] = {k: {} for k in axis}

    for v in variants:
        price = float(v["price"])
        opts = [
            v.get("option1"),
            v.get("option2"),
            v.get("option3"),
        ]
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

    overrides = PRICE_DIFF_OVERRIDES.get(product_code, {})
    for label, diff in overrides.items():
        if SIZE_OPTION_ID in out and label in out[SIZE_OPTION_ID]:
            out[SIZE_OPTION_ID][label] = diff
        if COLOR_OPTION_ID in out and label in out[COLOR_OPTION_ID]:
            out[COLOR_OPTION_ID][label] = diff
    return out


def build_rows(
    axis: dict[str, list[str]],
    diffs: dict[str, dict[str, int]],
    missing: dict[str, bool],
) -> list[tuple[str, str, int]]:
    rows: list[tuple[str, str, int]] = []
    for option_id in (COLOR_OPTION_ID, SIZE_OPTION_ID):
        if not missing.get(option_id):
            continue
        for label in axis.get(option_id, []):
            rows.append((option_id, label, diffs.get(option_id, {}).get(label, 0)))
    return rows


def slugify_name(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name)
    s = re.sub(r"\s+", "_", s.strip())
    return s[:80] or "Options"


def load_catalog(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--all", action="store_true", help="Write CSV even if options exist")
    args = parser.parse_args()

    catalog = load_catalog(args.catalog)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    summary_path = args.out_dir / "Volusion_Saranoni_Options_Summary.csv"
    summary_rows: list[dict[str, str]] = []

    for row in catalog:
        code = row["productcode"].strip()
        name = row.get("productname", code).strip()
        handle = CODE_TO_HANDLE.get(code)
        if not handle:
            summary_rows.append(
                {
                    "productcode": code,
                    "productname": name,
                    "status": "no_handle_map",
                    "csv_file": "",
                    "missing_color": "",
                    "missing_size": "",
                }
            )
            continue

        time.sleep(args.delay)
        mccabe = mccabe_options(code)
        has_color = bool(mccabe.get(COLOR_OPTION_ID))
        has_size = bool(mccabe.get(SIZE_OPTION_ID))

        time.sleep(args.delay)
        product = fetch_saranoni_product(handle)
        if not product:
            summary_rows.append(
                {
                    "productcode": code,
                    "productname": name,
                    "status": "saranoni_fetch_failed",
                    "csv_file": "",
                    "missing_color": str(not has_color),
                    "missing_size": str(not has_size),
                }
            )
            continue

        axis = option_axis(product)
        if not axis:
            summary_rows.append(
                {
                    "productcode": code,
                    "productname": name,
                    "status": "no_saranoni_options",
                    "csv_file": "",
                    "missing_color": str(not has_color),
                    "missing_size": str(not has_size),
                }
            )
            continue

        missing = {
            COLOR_OPTION_ID: COLOR_OPTION_ID in axis and (args.all or not has_color),
            SIZE_OPTION_ID: SIZE_OPTION_ID in axis and (args.all or not has_size),
        }
        if not any(missing.values()):
            summary_rows.append(
                {
                    "productcode": code,
                    "productname": name,
                    "status": "ok_has_options",
                    "csv_file": "",
                    "missing_color": "False",
                    "missing_size": "False",
                }
            )
            continue

        diffs = price_diffs(product, axis, code)
        rows = build_rows(axis, diffs, missing)
        fname = f"Volusion_{slugify_name(name)}_Options.csv"
        out_path = args.out_dir / fname
        with out_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["optionid", "optionsdesc", "pricediff"])
            for option_id, label, diff in rows:
                w.writerow([option_id, label, diff])

        summary_rows.append(
            {
                "productcode": code,
                "productname": name,
                "status": "generated",
                "csv_file": fname,
                "missing_color": str(missing[COLOR_OPTION_ID]),
                "missing_size": str(missing[SIZE_OPTION_ID]),
            }
        )
        print(f"Wrote {fname} ({code})")

    with summary_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "productcode",
                "productname",
                "status",
                "csv_file",
                "missing_color",
                "missing_size",
            ],
        )
        w.writeheader()
        w.writerows(summary_rows)
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
