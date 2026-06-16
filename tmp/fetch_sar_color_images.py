"""Download Saranoni per-color images for McCabe Volusion SAR-* products."""
from __future__ import annotations

import csv
import html as htmlmod
import io
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site")
DEST = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "sar-color-downloads"
SARONI_HTML = Path(
    r"c:\Users\erink\OneDrive\Documents\saraoni\Adult Extra Large Luxury Blankets by Saranoni – Saranoni Wholesale.htm"
)
MCCABE_SEARCH = ROOT / "tmp" / "search-sar.html"

SWATCH_MAX = 320
MAIN_MAX = 1946
JPEG_QUALITY = 93

# Saranoni Shopify handle -> McCabe Volusion ProductCode
HANDLE_TO_CODE: dict[str, str] = {
    "ruched-minky-throw-blanket": "SAR-DBL-RCH-FX-FUR",
    "ruched-minky-extra-large-throw-blanket": "SAR-DBL-RCH-FX-FUR-XL-LG",
    "lush-throw-blankets": "SAR-LUSH",
    "lush-extra-large-blanket": "SAR-LUSH-XL-LG",
    "chunky-knit-large-throw": "SAR-CHNK-KNT-LG",
    "chenille-fringe-blankets": "SAR-CHNL-FRNG",
    "chenille-fringe-xl-throw-blankets": "SAR-CHNL-FRNG-XL-LG",
    "patterned-faux-fur-throw-blanket": "SAR-PTRN-FX-FUR",
    "patterned-faux-fur-extra-large-throw-blanket": "SAR-PTRN-FX-FUR-XL-LG",
    "minky-stretch-throw-blankets": "SAR-MNKY-STR",
    "minky-stretch-xl-throw-blankets": "SAR-MNKY-STR-XL-LG",
    "minky-lush-xl-blankets": "SAR-MNKY-LUSH-XL-LG",
    "minky-lush-toddler-blankets": "SAR-MNKY-LUSH",
    "bamboo-rayon-muslin-extra-large-4-layer-quilt": "SAR-BMBU-RYN-MSLN-XL-LG-4",
    "plush-faux-fur-throw-blankets": "SAR-PLSH-FX-FUR",
    "plush-faux-fur-xl-throw-blankets": "SAR-PLSH-FX-FUR-XL-LG",
    "grand-faux-fur-throw-blankets-new": "SAR-GRAND-FX-FUR",
    "grand-faux-fur-xl-throw-blankets-new": "SAR-GRAND-FX-FUR-XL-LG",
    "ribbed-bamboni-throw-blanket": "SAR-RIBBED-BMB",
    "ribbed-bamboni-extra-large-blanket": "SAR-RIBBED-BMB-XL-LG",
    "waffle-knit-throw-blankets-1": "SAR-WFL-KNT",
    "waffle-knit-throw-blankets": "SAR-WFL-KNT-XL-LG",
    "cozy-bamboni-robe": "SAR-COZY-BMB-ROBES",
    "bamboni-sets": "SAR-BMB-SETS",
    "lush-mini-blanket": "SAR-LUSH-MINI",
    "lush-receiving-blanket": "SAR-LUSH-RCV",
    "wearable-blanket": "SAR-WEARABLE",
    "waffle-knit-mini-blankets": "SAR-WFL-KNT-MINI",
}

# McCabe Volusion color label -> Saranoni Shopify Color option (when names differ)
COLOR_ALIASES: dict[str, str] = {
    "cameo": "buff",
    "golden": "copper",
    "oatmeal": "dove",
    "oxford": "oxford",
    "sunkissed": "sun-kissed",
    "surf": "surf",
    "allspice": "cameo",
    "nightfalldoublelayer": "nightfall",
    "pansydoublelayer": "pansy",
}


def norm_color(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", label.strip().lower())


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", "replace")


def load_handles_from_html() -> list[str]:
    return sorted(set(HANDLE_TO_CODE.keys()))


def mccabe_product_url(code: str) -> str:
    return (
        "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode="
        + urllib.parse.quote(code)
    )


def parse_mccabe_colors(html: str, product_code: str) -> list[dict]:
    m = re.search(
        rf'<SELECT[^>]*name="SELECT___{re.escape(product_code)}___23"[^>]*>(.*?)</SELECT>',
        html,
        re.I | re.S,
    )
    if not m:
        return []
    out = []
    for om in re.finditer(
        r'<OPTION[^>]*value="([^"]*)"[^>]*>(.*?)</OPTION>', m.group(1), re.I | re.S
    ):
        val = om.group(1).strip()
        text = htmlmod.unescape(re.sub(r"<[^>]+>", "", om.group(2)))
        text = re.sub(r"\s+", " ", text).strip()
        if not val or not text or re.match(r"^(please|choose|select|--)", text, re.I):
            continue
        out.append({"optionId": val, "label": text})
    return out


def shopify_product(handle: str) -> dict:
    url = f"https://saranoni.com/products/{handle}.json"
    return json.loads(fetch_text(url))["product"]


def variant_image_url(product: dict, variant: dict) -> str | None:
    image_id = variant.get("image_id")
    if not image_id:
        return None
    for img in product.get("images") or []:
        if img.get("id") == image_id:
            src = img.get("src") or ""
            if not src:
                return None
            if "width=" in src:
                return re.sub(r"width=\d+", f"width={MAIN_MAX}", src)
            sep = "&" if "?" in src else "?"
            return f"{src}{sep}width={MAIN_MAX}"
    return None


def save_main(data: bytes, dest: Path) -> None:
    if Image is None:
        dest.write_bytes(data)
        return
    with Image.open(io.BytesIO(data)) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)


def save_swatch(main_path: Path, dest: Path) -> None:
    if Image is None:
        shutil.copy2(main_path, dest)
        return
    with Image.open(main_path) as im:
        im = im.convert("RGB") if im.mode not in ("RGB", "L") else im
        im.thumbnail((SWATCH_MAX, SWATCH_MAX), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=88, optimize=True)


def match_variant(colors: list[dict], variants: list[dict]) -> list[tuple[dict, dict | None]]:
    by_norm = {norm_color(v.get("option1") or ""): v for v in variants}
    pairs = []
    for c in colors:
        key = norm_color(c["label"])
        alias = COLOR_ALIASES.get(key, key)
        variant = by_norm.get(norm_color(alias)) or by_norm.get(key)
        if not variant:
            for v in variants:
                vn = norm_color(v.get("option1") or "")
                if vn == key or vn == norm_color(alias) or key in vn or vn in key:
                    variant = v
                    break
        pairs.append((c, variant))
    return pairs


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    handles = load_handles_from_html()
    report = []
    written = 0
    missing = []

    for hi, handle in enumerate(handles):
        code = HANDLE_TO_CODE.get(handle)
        if not code:
            missing.append(f"{handle}: no Volusion code mapping")
            continue
        pdp_url = mccabe_product_url(code)
        try:
            pdp_html = fetch_text(pdp_url)
        except Exception as e:
            missing.append(f"{code}: PDP fetch failed: {e}")
            continue
        if f'value="{code}"' not in pdp_html and "ProductCode" not in pdp_html:
            missing.append(f"{code}: PDP not found")
            continue
        colors = parse_mccabe_colors(pdp_html, code)
        if len(colors) <= 1:
            continue
        try:
            product = shopify_product(handle)
        except Exception as e:
            missing.append(f"{code}: Shopify fetch failed for {handle}: {e}")
            continue
        variants = product.get("variants") or []
        pairs = match_variant(colors, variants)
        print(f"\n{code} ({handle}) — {len(colors)} colors")
        for color, variant in pairs:
            oid = color["optionId"]
            label = color["label"]
            t_dest = DEST / f"{code}-{oid}-T.jpg"
            s_dest = DEST / f"{code}-{oid}-S.jpg"
            if not variant:
                missing.append(f"{code} {label}: no Shopify variant")
                print(f"  MISSING variant: {label}")
                continue
            img_url = variant_image_url(product, variant)
            if not img_url:
                missing.append(f"{code} {label}: no variant image")
                print(f"  MISSING image: {label}")
                continue
            raw = TMP / f"{code}-{oid}-raw"
            print(f"  {label} ({oid})")
            data = fetch(img_url)
            raw.write_bytes(data)
            save_main(data, t_dest)
            save_swatch(t_dest, s_dest)
            written += 2
            report.append(
                {
                    "code": code,
                    "handle": handle,
                    "optionId": oid,
                    "label": label,
                    "shopifyColor": variant.get("option1"),
                    "imageUrl": img_url,
                    "tFile": t_dest.name,
                    "sFile": s_dest.name,
                }
            )
        if hi % 5 == 4:
            time.sleep(0.3)

    manifest = ROOT / "tmp" / "sar-color-images-manifest.json"
    manifest.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {written} files ({len(report)} colors)")
    print(f"Manifest: {manifest}")
    if missing:
        print(f"\nIssues ({len(missing)}):")
        for item in missing[:40]:
            print(f"  - {item}")
        if len(missing) > 40:
            print(f"  ... and {len(missing) - 40} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
