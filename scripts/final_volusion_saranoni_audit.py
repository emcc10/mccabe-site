import json, csv, math, urllib.error, urllib.request, urllib.parse, re, time, html as htmlmod
from pathlib import Path

# This script uses the browser to fetch data since Saranoni blocks automated requests.
# However, for this turn, I will use the data I already fetched via browser and 
# provide a script that can be run if more data is needed.

# Shopify handle -> McCabe Volusion ProductCode
HANDLE_TO_CODE = {
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
    "minky-lush-xl-blankets": "SAR-MNKY-LUSH", # Use XL as proxy for Throw if Throw is gone
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
    "bamboni-twin-blankets": "SAR-BAMBONI-TWIN-BLANKETS",
    "baby-bamboni-lite-sets": "SAR-BABY-BMB-LITE-SETS",
    "bamboo-rayon-muslin-pillowcase-set": "SAR-BMBU-RYN-MSLN-PILLOWCA",
    "faux-fur-pillowcase": "SAR-FX-FUR-PILLOWCA",
    "pleated-dust-ruffle": "SAR-PLEATED-DUST-RUFFLE",
    "satin-back-toddler-blanket": "SAR-SATIN-BACK-TOD",
    "satin-border-toddler-blanket": "SAR-SATIN-BORDER-TOD",
    "stretchy-swaddle": "SAR-STRETCHY-SWADDLES-HATS",
    "superman-double-layer-bamboni-copy": "SAR-SUPERMAN-DBL-LAYER-BMB",
    "the-very-hungry-caterpillar-minky-stretch-luxe-blankets": "SAR-VERY-HGRY-CAT-MNKY-STR",
    "waffle-knit-toddler-blankets": "SAR-WFL-KNT-TOD",
    "wizarding-world-charm-minky-lush": "SAR-WIZARDIN-WORLD-CHARM",
    "wonder-woman-double-layer-bamboni": "SAR-WONDER-WOMAN-DBL-LAYER",
    "harry-potter-muslin-nursery": "SAR-HP-HP-MSLN-NRS",
    "harry-potter-icons-minky-lush": "SAR-HP-HP-ICONS-MNKY-LUSH",
    "batman-double-layer-bamboni": "SAR-BATMAN-DBL-LAYER-BMB",
    "the-boy-who-lived-double-layer-bamboni": "SAR-BOY-WHO-LIVED-DBL-LAYER",
    "hogwarts-crest-double-layer-bamboni": "SAR-HOGWARTS-CREST-DBL-LAYER",
    "justice-league-muslin-lush": "SAR-JL-JL-MSLN-LUSH",
    "justice-league-snuggler": "SAR-JL-JL-SNUGGLER",
    "elf-snuggler": "SAR-ELF-SNUGGLER",
    "peter-rabbit-cotton-crib-sheets": "SAR-PTR-RBT-COTTON-MSLN-CRIB",
    "stuffed-animal-rockers": "SAR-STUFFED-ANML-ROCKERS",
    "stuffed-animals": "SAR-STUFFED-ANIMALS",
    "stuffed-animal-loveys": "SAR-STUFFED-ANML-LVYS"
}

# Variant mapping overrides (Volusion Name -> Shopify Name)
VARIANT_MAP = {
    "Jasmine": "Bows",
    "Ivy": "Ivy",
    "Lilly": "Dogs", # Assumption for SAR-MNKY-LUSH
    "Tori Halford": "Tori Halford",
    "Muslin/Lush Mini": "Mini",
    "Swaddle": "Swaddle",
    "Crib Sheet": "Crib Sheet",
    "Changing Cover": "Changing Cover",
    "Muslin/Lush Quilt": "Quilt"
}

# A Shopify product's minimum variant price is not always its default product
# configuration. This product defaults to a Swaddle ($18.13).
PRODUCT_BASE_PRICE_OVERRIDES = {
    "SAR-STRETCHY-SWADDLES-HATS": 18.13,
}

def norm_price(p):
    if p is None or p == "": return 0.0
    if isinstance(p, str): return float(p)
    if p > 1000: return p / 100.0
    return float(p)

def regular_import_price(p):
    """Keep regular advertised prices whole-dollar, rounding a fractional price up."""
    return math.ceil(norm_price(p))


def scrape_vol_options(code):
    url = f"https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode={code}"
    ua = {"User-Agent": "Mozilla/5.0"}
    try:
        req = urllib.request.Request(url, headers=ua)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", "replace")
            matches = re.findall(r'<option[^>]*value=\"(\d+)\"[^>]*>(.*?)</option>', html, re.I | re.S)
            options = []
            for val, desc in matches:
                desc = htmlmod.unescape(re.sub(r"<[^>]+>", "", desc)).strip()
                if val != "0" and desc.lower() not in ["select one", "choose color", "select style"]:
                    options.append({"id": val, "desc": desc})
            return options
    except Exception:
        return []


def clean_label(value):
    return re.sub(r"\s+", " ", re.sub(r"\[(?:Additional|Subtract)[^\]]*\]", "", value or "", flags=re.I)).strip()


def label_key(value):
    return re.sub(r"[^a-z0-9]+", "", clean_label(value).lower())


def variant_is_sale(variant):
    compare = norm_price(variant.get("compare_at_price"))
    price = norm_price(variant.get("price"))
    return compare > 0 and price > 0 and price < compare


def variant_regular_price(variant):
    compare = norm_price(variant.get("compare_at_price"))
    return compare if compare > 0 else norm_price(variant.get("price"))


def variant_display_price(variant):
    """McCabe displays the supplier's regular price outside of promotions."""
    return regular_import_price(variant_regular_price(variant))


def fetch_json(url, retries=4):
    """Fetch Shopify product JSON slowly enough to avoid their transient 503 limit."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (McCabe catalog sync)"})
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.loads(response.read().decode("utf-8", "replace"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError):
            if attempt == retries - 1:
                return None
            time.sleep(2 ** attempt)
    return None


def find_variant(variants, option_label):
    """Match a live Volusion option label to one supplier variant without guessing."""
    wanted = label_key(VARIANT_MAP.get(clean_label(option_label), clean_label(option_label)))
    if not wanted:
        return None
    best = None
    best_score = 0
    for variant in variants:
        labels = [
            variant.get("option1") or "",
            variant.get("option2") or "",
            variant.get("option3") or "",
            variant.get("title") or "",
        ]
        keys = [label_key(label) for label in labels if label]
        score = 0
        if wanted in keys:
            score = 100
        elif any(wanted in key or key in wanted for key in keys if key):
            score = 50
        if score > best_score:
            best, best_score = variant, score
    return best if best_score else None


def supplier_catalog(audit_results):
    """Refresh the supplier cache; retain the last verified payload if Shopify throttles."""
    cache_path = Path("tmp/saranoni_live_supplier_catalog.json")
    try:
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cached = {}

    handles = {
        item.get("code"): item.get("handle")
        for item in audit_results
        if item.get("code") and item.get("handle")
    }
    # The working option-builder map covers records that did not make it into an
    # earlier audit's handle field.  Keep every active McCabe SAR record in the
    # import rather than silently dropping those products.
    try:
        from build_saranoni_volusion_options import CODE_TO_HANDLE as mapped_handles
        for code, handle in mapped_handles.items():
            handles.setdefault(code, handle)
    except ImportError:
        pass
    # The old audit intentionally proxies this retired handle to the current XL record.
    handles["SAR-MNKY-LUSH"] = "minky-lush-xl-blankets"
    out = {}
    for index, (code, handle) in enumerate(sorted(handles.items()), 1):
        cached_item = cached.get(code) or {}
        if cached_item.get("product") and time.time() - float(cached_item.get("fetched_at") or 0) < 3600:
            out[code] = {**cached_item, "verified": True}
            print(f"[{index}/{len(handles)}] using fresh cache {code}")
            continue
        payload = fetch_json("https://saranoni.com/products/" + urllib.parse.quote(handle) + ".json")
        product = payload.get("product") if payload else None
        if product:
            out[code] = {
                "handle": handle,
                "product": product,
                "fetched_at": time.time(),
                "verified": True,
            }
            print(f"[{index}/{len(handles)}] refreshed {code}")
        elif code in cached:
            out[code] = cached[code]
            print(f"[{index}/{len(handles)}] using cached {code}")
        else:
            audit_item = next((item for item in audit_results if item.get("code") == code), None)
            if audit_item and audit_item.get("variants"):
                out[code] = {
                    "handle": handle,
                    "product": {"variants": audit_item["variants"]},
                    "fetched_at": 0,
                    "verified": False,
                }
                print(f"[{index}/{len(handles)}] using last audit {code}")
            else:
                print(f"[{index}/{len(handles)}] unavailable {code}")
        time.sleep(0.6)
    cache_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    return out

def main():
    try:
        with open("tmp/saranoni_full_audit_results.json", "r") as f:
            old_results = json.load(f)
    except: old_results = []
    
    source = supplier_catalog(old_results)
    products_rows = []
    option_diffs = {}
    option_context = {}
    regular_price_data = {}

    for code, source_item in sorted(source.items()):
        product = source_item.get("product") or {}
        variants = product.get("variants") or []
        if not variants:
            continue
        available = [variant for variant in variants if variant.get("available", True)]
        default_candidates = [variant for variant in available if not variant_is_sale(variant)] or available
        if not default_candidates:
            default_candidates = variants
        source_base_price = PRODUCT_BASE_PRICE_OVERRIDES.get(
            code, min(variant_regular_price(variant) for variant in default_candidates)
        )
        base_price = regular_import_price(source_base_price)
        vol_options = scrape_vol_options(code)
        in_stock_ids = []
        matched_by_id = {}
        for vopt in vol_options:
            v_id = vopt["id"]
            match = find_variant(variants, vopt["desc"])
            if match:
                price_diff = variant_display_price(match) - base_price
                option_diffs.setdefault(v_id, set()).add(price_diff)
                option_context.setdefault(v_id, []).append(code)
                matched_by_id[v_id] = {
                    "regular": regular_import_price(variant_regular_price(match)),
                }
                if match.get("available", True):
                    in_stock_ids.append(v_id)
            elif not source_item.get("verified"):
                # An unavailable supplier record cannot prove that this existing
                # option was discontinued, so preserve it pending a source match.
                in_stock_ids.append(v_id)

        products_rows.append({
            "ProductCode": code,
            "ProductPrice": base_price,
            # Explicitly clear any prior supplier sale value in Volusion.
            "SalePrice": "0",
            "OptionIDs": ", ".join(in_stock_ids), # Added space to help Excel treat as text
            "HideProduct": "Y" if not available else "N"
        })
        regular_price_data[code] = {"regular": base_price, "variants": matched_by_id}
        print(f"Processed {code}: {len(in_stock_ids)} in-stock variants.")

    # Option IDs are global in Volusion.  Only import an ID when every product
    # using it has the same differential.  A conflicting global update would
    # corrupt otherwise-correct products, so those are emitted for review instead.
    options_rows = [
        {"ID": option_id, "PriceDiff": next(iter(diffs))}
        for option_id, diffs in sorted(option_diffs.items(), key=lambda item: int(item[0]))
        if len(diffs) == 1
    ]
    conflicts = [
        {
            "ID": option_id,
            "PriceDiffs": ", ".join(str(value) for value in sorted(diffs)),
            "ProductCodes": ", ".join(sorted(set(option_context[option_id]))),
        }
        for option_id, diffs in sorted(option_diffs.items(), key=lambda item: int(item[0]))
        if len(diffs) > 1
    ]

    out_dir = Path("catalog/saranoni-gap-report")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Write Products - ensure OptionIDs is quoted by the writer
        with (out_dir / "volusion_products_regular_inventory_import.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["ProductCode", "ProductPrice", "SalePrice", "OptionIDs", "HideProduct"], quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(products_rows)
            
        with (out_dir / "volusion_options_regular_pricediff_import.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["ID", "PriceDiff"])
            writer.writeheader()
            writer.writerows(options_rows)
        with (out_dir / "volusion_options_regular_pricediff_conflicts.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["ID", "PriceDiffs", "ProductCodes"])
            writer.writeheader()
            writer.writerows(conflicts)
        (Path("vspfiles/js") / "mc-saranoni-sale-data.js").write_text(
            "/* Generated from current Saranoni supplier data. */\nwindow.MC_SARANONI_VARIANT_PRICING = " +
            json.dumps(regular_price_data, separators=(",", ":")) + ";\n",
            encoding="utf-8"
        )
        print("Success! Wrote regular-price CSVs, conflict report, and PDP regular-price data.")
    except PermissionError:
        print("ERROR: CSV files are STILL open. Please close all Excel/CSV windows.")

if __name__ == "__main__":
    main()
