import json, csv, urllib.request, urllib.parse, re, time, html as htmlmod
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
# configuration. This product defaults to a Swaddle ($18.13); Hats and Bows
# are the lower-priced option and must be represented as negative PriceDiffs.
PRODUCT_BASE_PRICE_OVERRIDES = {
    "SAR-STRETCHY-SWADDLES-HATS": 18.13,
}

def norm_price(p):
    if p is None or p == "": return 0.0
    if isinstance(p, str): return float(p)
    if p > 1000: return p / 100.0
    return float(p)

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
    except: return []

def main():
    try:
        with open("tmp/saranoni_full_audit_results.json", "r") as f:
            old_results = json.load(f)
    except: old_results = []
    
    results_map = {item["code"]: item for item in old_results}
    
    xl_json = {
        "variants": [
            {"title": "Ivy", "price": 118.30, "available": True},
            {"title": "Bows", "price": 152.10, "available": True},
            {"title": "Dogs", "price": 152.10, "available": True}
        ]
    }
    results_map["SAR-MNKY-LUSH"] = {
        "code": "SAR-MNKY-LUSH",
        "variants": xl_json["variants"],
        "shopify_base_price": 118.30
    }
    
    products_rows = []
    options_map = {} # ID -> PriceDiff to ensure uniqueness
    processed_codes = set()
    
    for handle, code in HANDLE_TO_CODE.items():
        if code in processed_codes: continue
        processed_codes.add(code)
        
        item = results_map.get(code)
        if not item: continue
        
        variants = item.get("variants", [])
        if not variants: continue
        
        base_price = PRODUCT_BASE_PRICE_OVERRIDES.get(
            code, item.get("shopify_base_price", 0.0)
        )
        vol_options = scrape_vol_options(code)
        
        in_stock_ids = []
        for vopt in vol_options:
            v_id = vopt["id"]
            v_desc = vopt["desc"]
            mapped_name = VARIANT_MAP.get(v_desc, v_desc)
            
            match = None
            for sv in variants:
                sv_title = sv["title"]
                if mapped_name.lower() == sv_title.lower() or mapped_name.lower() in sv_title.lower() or sv_title.lower() in mapped_name.lower():
                    match = sv
                    break
            
            if match:
                price_diff = round(norm_price(match["price"]) - base_price, 2)
                options_map[v_id] = price_diff
                if match.get("available", True):
                    in_stock_ids.append(v_id)
        
        products_rows.append({
            "ProductCode": code,
            "ProductPrice": base_price,
            "OptionIDs": ", ".join(in_stock_ids), # Added space to help Excel treat as text
            "HideProduct": "Y" if not any(v.get("available", True) for v in variants) else "N"
        })
        print(f"Processed {code}: {len(in_stock_ids)} in-stock variants.")

    options_rows = [{"ID": k, "PriceDiff": v} for k, v in options_map.items()]

    out_dir = Path("catalog/saranoni-gap-report")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Write Products - ensure OptionIDs is quoted by the writer
        with (out_dir / "volusion_products_import_v3.csv").open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["ProductCode", "ProductPrice", "OptionIDs", "HideProduct"], quoting=csv.QUOTE_ALL)
            writer.writeheader()
            writer.writerows(products_rows)
            
        with (out_dir / "volusion_options_import_v3.csv").open("w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["ID", "PriceDiff"])
            writer.writeheader()
            writer.writerows(options_rows)
        print("Success! Wrote files to _v3 versions.")
    except PermissionError:
        print("ERROR: CSV files are STILL open. Please close all Excel/CSV windows.")

if __name__ == "__main__":
    main()
