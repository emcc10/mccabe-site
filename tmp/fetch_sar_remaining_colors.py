"""Fetch missing Saranoni per-color images using Shopify, option-ID reuse, and fallbacks."""
from __future__ import annotations

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

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "sar-color-downloads"
AUDIT = ROOT / "tmp" / "sar-color-audit.json"

SWATCH_MAX = 320
MAIN_MAX = 1946
JPEG_QUALITY = 93

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
    "stuffed-animal-loveys-copy": "SAR-MNKY-LUSH",
    "minky-lush-toddler-blankets": "SAR-MNKY-LUSH-TOD",
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
}

# Extra handles scanned only for global color -> image lookup (not primary product map).
COLOR_SOURCE_HANDLES = sorted(
    set(HANDLE_TO_CODE)
    | {
        "lush-throw-blankets",
        "lush-extra-large-blanket",
        "lush-toddler-blanket",
        "bamboni-toddler-blanket",
        "bamboni-extra-large-blanket",
        "bamboni-receiving-blanket",
        "bamboni-mini-blanket",
        "patterned-faux-fur-extra-large-throw-blanket",
        "patterned-faux-fur-throw-blanket",
        "minky-stretch-throw-blankets",
        "waffle-knit-throw-blankets-1",
        "grand-faux-fur-throw-blankets-new",
        "grand-faux-fur-king-blanket",
        "snuggler",
        "bamboni-snuggler",
        "cozy-bamboni-robe",
        "minky-lush-xl-blankets",
        "playmat",
        "double-layer-bamboni-toddler-blanket",
    }
)

# Hard-coded when Shopify/McCabe naming diverges or products are discontinued.
MANUAL_IMAGE_URLS: dict[tuple[str, str], str] = {
    (
        "SAR-MNKY-LUSH",
        "1087",
    ): "https://cdn.shopify.com/s/files/1/2047/7533/files/minkylush-mini-blankets-253273.jpg?v=1724161590",
    (
        "SAR-MNKY-LUSH",
        "1088",
    ): "https://cdn.shopify.com/s/files/1/2047/7533/files/minkylush-mini-blankets-752425.jpg?v=1724161590",
    (
        "SAR-MNKY-LUSH-XL-LG",
        "1087",
    ): "https://cdn.shopify.com/s/files/1/2047/7533/files/IvyXL.png?v=1741874244",
}

CODE_TO_HANDLE: dict[str, str] = {}
for handle, code in HANDLE_TO_CODE.items():
    CODE_TO_HANDLE.setdefault(code, handle)

COLOR_ALIASES: dict[str, str] = {
    "cameo": "buff",
    "golden": "copper",
    "oatmeal": "dove",
    "sunkissed": "sun-kissed",
    "allspice": "cameo",
    "nightfalldoublelayer": "nightfall double layer",
    "pansydoublelayer": "pansy double layer",
    "cashmere": "cream",
    "gray": "charcoal",
    "grey": "charcoal",
    "graymarble": "graymink",
    "tanmarble": "fawn",
    "lilly": "lily",
}

# Products where Shopify color is in option2 (size in option1).
OPTION2_COLOR_HANDLES = {"snuggler"}

# Products where McCabe color labels do not match Shopify; map label -> Shopify option value.
LABEL_SHOPIFY_OVERRIDES: dict[str, dict[str, str]] = {
    "SAR-BMB-SNUGGLER": {"Cashmere": "Cream", "Charcoal": "Gray"},
    "SAR-COZY-BMB-ROBES": {"Cashmere": "Cream", "Gray": "Gray"},
}


def norm_color(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", label.strip().lower())


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", "replace")


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


def write_pair(data: bytes, code: str, oid: str) -> tuple[str, str]:
    t_dest = DEST / f"{code}-{oid}-T.jpg"
    s_dest = DEST / f"{code}-{oid}-S.jpg"
    raw = TMP / f"{code}-{oid}-raw"
    raw.write_bytes(data)
    save_main(data, t_dest)
    save_swatch(t_dest, s_dest)
    return t_dest.name, s_dest.name


def copy_pair_from_option_id(code: str, oid: str, index: dict[str, Path]) -> bool:
    src = index.get(oid)
    if not src or not src.exists():
        return False
    s_src = src.with_name(src.name.replace("-T.jpg", "-S.jpg"))
    t_dest = DEST / f"{code}-{oid}-T.jpg"
    s_dest = DEST / f"{code}-{oid}-S.jpg"
    shutil.copy2(src, t_dest)
    if s_src.exists():
        shutil.copy2(s_src, s_dest)
    else:
        save_swatch(t_dest, s_dest)
    return True


def build_option_id_index() -> dict[str, Path]:
    index: dict[str, Path] = {}
    for path in DEST.glob("SAR-*-*-T.jpg"):
        m = re.match(r"^SAR-.+-(\d+)-T\.jpg$", path.name, re.I)
        if not m:
            continue
        oid = m.group(1)
        index.setdefault(oid, path)
    return index


def upscale_url(src: str) -> str:
    if not src:
        return src
    if "width=" in src:
        return re.sub(r"width=\d+", f"width={MAIN_MAX}", src)
    sep = "&" if "?" in src else "?"
    return f"{src}{sep}width={MAIN_MAX}"


def shopify_product(handle: str, cache: dict[str, dict]) -> dict | None:
    if handle in cache:
        return cache[handle]
    url = f"https://saranoni.com/products/{handle}.json"
    try:
        product = json.loads(fetch_text(url))["product"]
    except Exception:
        cache[handle] = None  # type: ignore[assignment]
        return None
    cache[handle] = product
    return product


def image_by_id(product: dict, image_id: int | None) -> str | None:
    if not image_id:
        return None
    for img in product.get("images") or []:
        if img.get("id") == image_id:
            return upscale_url(img.get("src") or "")
    return None


def variant_image_url(product: dict, variant: dict) -> str | None:
    url = image_by_id(product, variant.get("image_id"))
    if url:
        return url
    images = product.get("images") or []
    if images:
        return upscale_url(images[0].get("src") or "")
    return None


def variant_color_values(variant: dict, handle: str) -> list[str]:
    opts = []
    if handle in OPTION2_COLOR_HANDLES:
        if variant.get("option2"):
            opts.append(str(variant["option2"]))
    else:
        if variant.get("option1"):
            opts.append(str(variant["option1"]))
        if variant.get("option2"):
            opts.append(str(variant["option2"]))
    return opts


def match_variant(
    label: str, variants: list[dict], handle: str, code: str
) -> dict | None:
    overrides = LABEL_SHOPIFY_OVERRIDES.get(code, {})
    target = overrides.get(label, label)
    key = norm_color(target)
    alias = norm_color(COLOR_ALIASES.get(norm_color(label), target))

    scored: list[tuple[int, dict]] = []
    for v in variants:
        for val in variant_color_values(v, handle):
            vn = norm_color(val)
            score = 0
            if vn == key:
                score = 100
            elif vn == alias:
                score = 90
            elif key in vn or vn in key:
                score = 70
            elif alias in vn or vn in alias:
                score = 60
            if score:
                if handle in OPTION2_COLOR_HANDLES and str(v.get("option1") or "") == "Adult":
                    score += 5
                scored.append((score, v))
    if not scored:
        return None
    scored.sort(key=lambda item: item[0], reverse=True)
    return scored[0][1]


def build_global_color_index(cache: dict[str, dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for handle in COLOR_SOURCE_HANDLES:
        product = shopify_product(handle, cache)
        if not product:
            continue
        for variant in product.get("variants") or []:
            url = variant_image_url(product, variant)
            if not url:
                continue
            for val in variant_color_values(variant, handle):
                out.setdefault(norm_color(val), url)
                alias = COLOR_ALIASES.get(norm_color(val))
                if alias:
                    out.setdefault(norm_color(alias), url)
        for img in product.get("images") or []:
            src = upscale_url(img.get("src") or "")
            alt = str(img.get("alt") or "")
            if not src:
                continue
            for token in re.split(r"[^A-Za-z0-9]+", alt):
                if len(token) >= 3:
                    out.setdefault(norm_color(token), src)
    return out


def load_audit_missing() -> list[dict]:
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    work = []
    for row in audit:
        colors = row.get("colors") or []
        if len(colors) <= 1:
            continue
        missing = [c for c in colors if not (c.get("hasS") and c.get("hasT"))]
        if missing:
            work.append(
                {
                    "code": row["code"],
                    "name": row.get("name", ""),
                    "missing": missing,
                }
            )
    return work


def needs_files(code: str, oid: str) -> bool:
    t = DEST / f"{code}-{oid}-T.jpg"
    s = DEST / f"{code}-{oid}-S.jpg"
    return not (t.exists() and s.exists())


def main() -> int:
    DEST.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    work = load_audit_missing()
    option_index = build_option_id_index()
    cache: dict[str, dict] = {}
    color_index = build_global_color_index(cache)
    report = []
    missing = []
    written = 0

    print(f"Products with missing colors: {len(work)}")
    for row in work:
        code = row["code"]
        handle = CODE_TO_HANDLE.get(code, "")
        product = shopify_product(handle, cache) if handle else None
        variants = (product or {}).get("variants") or []
        print(f"\n{code} — {len(row['missing'])} missing")
        for color in row["missing"]:
            oid = color["optionId"]
            label = color["label"]
            if not needs_files(code, oid):
                print(f"  skip existing {label} ({oid})")
                continue

            manual = MANUAL_IMAGE_URLS.get((code, oid))
            if manual:
                print(f"  manual {label} ({oid})")
                data = fetch(manual)
                t_name, s_name = write_pair(data, code, oid)
                written += 2
                option_index.setdefault(oid, DEST / f"{code}-{oid}-T.jpg")
                report.append(
                    {
                        "code": code,
                        "optionId": oid,
                        "label": label,
                        "source": "manual-url",
                        "imageUrl": manual,
                        "tFile": t_name,
                        "sFile": s_name,
                    }
                )
                continue

            if copy_pair_from_option_id(code, oid, option_index):
                print(f"  copied by optionId {label} ({oid})")
                written += 2
                option_index.setdefault(oid, DEST / f"{code}-{oid}-T.jpg")
                report.append(
                    {"code": code, "optionId": oid, "label": label, "source": "optionId-reuse"}
                )
                continue

            img_url = None
            source = ""
            if product and variants:
                variant = match_variant(label, variants, handle, code)
                if variant:
                    img_url = variant_image_url(product, variant)
                    if img_url:
                        source = f"shopify:{handle}"

            if not img_url:
                lookup = norm_color(label)
                alias = norm_color(COLOR_ALIASES.get(lookup, label))
                img_url = color_index.get(lookup) or color_index.get(alias)
                if img_url:
                    source = "global-color-index"

            if not img_url:
                missing.append(f"{code} {label} ({oid})")
                print(f"  MISSING {label} ({oid})")
                continue

            print(f"  fetch {label} ({oid}) via {source}")
            data = fetch(img_url)
            t_name, s_name = write_pair(data, code, oid)
            written += 2
            option_index.setdefault(oid, DEST / f"{code}-{oid}-T.jpg")
            report.append(
                {
                    "code": code,
                    "optionId": oid,
                    "label": label,
                    "source": source,
                    "imageUrl": img_url,
                    "tFile": t_name,
                    "sFile": s_name,
                }
            )
            time.sleep(0.08)

    out = ROOT / "tmp" / "sar-color-remaining-manifest.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {written} files ({len(report)} colors)")
    print(f"Manifest: {out}")
    if missing:
        print(f"\nStill missing ({len(missing)}):")
        for item in missing:
            print(f"  - {item}")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
