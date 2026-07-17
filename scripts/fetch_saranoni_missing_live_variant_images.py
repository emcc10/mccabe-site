#!/usr/bin/env python3
"""Download missing Saranoni variant OptionID images (T/S) from Shopify.

Reads labeled missing rows from tmp/altview-inventory/saranoni_missing_variant_images_labeled.csv
and writes vspfiles/photos/{ProductCode}-{OptionID}-T.jpg / -S.jpg.

Does not touch JS/CSS/HTML.
"""
from __future__ import annotations

import csv
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
LABELED = ROOT / "tmp" / "altview-inventory" / "saranoni_missing_variant_images_labeled.csv"
REPORT = ROOT / "tmp" / "altview-inventory" / "saranoni_missing_variant_images_download_report.csv"

sys.path.insert(0, str(ROOT / "scripts"))
from fetch_saranoni_steve_silver_altviews import CODE_TO_HANDLE, HANDLE_ALIASES  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (McCabe missing variant images)"}
MIN_WIDTH = 650
MAIN_MAX = 1946
SWATCH = 320
JPEG_Q = 93
SLEEP = 0.4

# Extra handles for products not in the shared map / renamed on Shopify
CODE_TO_HANDLE.update(
    {
        "SAR-HEIRLOOM-COTTON-KNT-SETS": "heirloom-cotton-knit-sets",
        "SAR-SUPERMAN-MNKY-LUSH": "superman-minky-lush",
        "SAR-BATMAN-MNKY-LUSH": "batman-minky-lush",
        "SAR-HP-HP-MSLN-NRS": "harry-potter-muslin-nursery",
        "SAR-JL-JL-MSLN-LUSH": "justice-league-muslin-lush",
        "SAR-COZY-BMB-ROBES": "cozy-bamboni-robe",
        "SAR-MNKY-STR-LUXE-ROBES": "minky-stretch-luxe-robes",
        "SAR-WFL-KNT-ROBES": "waffle-knit-robes",
        "SAR-SNUGGLER": "snuggler",
        "SAR-WEARABLE": "wearable-blanket",
        "SAR-DBL-RCH-FX-FUR": "ruched-minky-throw-blanket",
        "SAR-DBL-RCH-FX-FUR-XL-LG": "ruched-minky-extra-large-throw-blanket",
        "SAR-GRAND-FX-FUR": "grand-faux-fur-throw-blankets-new",
        "SAR-GRAND-FX-FUR-XL-LG": "grand-faux-fur-xl-throw-blankets-new",
        "SAR-PTRN-FX-FUR-XL-LG": "patterned-faux-fur-extra-large-throw-blanket",
        "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer-quilt",
        "SAR-COTTON-MSLN-4-LAYER": "cotton-muslin-4-layer-quilt",
        "SAR-PLSH-FX-FUR-XL-LG": "plush-faux-fur-throw-blankets",
    }
)


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url).decode("utf-8", "replace"))


def clean_label(text: str) -> str:
    t = re.sub(r"\[(?:Additional|Subtract)[^\]]*\]", "", text or "", flags=re.I)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def shopify_url(src: str, width: int = 2000) -> str:
    return f"{src.split('?')[0]}?width={width}"


def save_pair(buf: bytes, t_path: Path, s_path: Path) -> tuple[int, int]:
    im = Image.open(io.BytesIO(buf)).convert("RGB")
    w, h = im.size
    if w < MIN_WIDTH:
        raise ValueError(f"width {w} < {MIN_WIDTH}")
    im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
    w, h = im.size
    if w < MIN_WIDTH:
        raise ValueError(f"after resize width {w} < {MIN_WIDTH}")
    t_path.parent.mkdir(parents=True, exist_ok=True)
    im.save(t_path, format="JPEG", quality=JPEG_Q, optimize=True)
    sw = im.copy()
    sw.thumbnail((SWATCH, SWATCH), Image.Resampling.LANCZOS)
    # cover-ish center crop to square
    sw2 = Image.open(t_path).convert("RGB")
    side = min(sw2.size)
    left = (sw2.width - side) // 2
    top = (sw2.height - side) // 2
    crop = sw2.crop((left, top, left + side, top + side)).resize(
        (SWATCH, SWATCH), Image.Resampling.LANCZOS
    )
    crop.save(s_path, format="JPEG", quality=88, optimize=True)
    return w, h


def resolve_product(code: str) -> tuple[str, dict] | None:
    handle = CODE_TO_HANDLE.get(code)
    if not handle:
        return None
    candidates = [handle]
    alias = HANDLE_ALIASES.get(handle)
    if alias:
        candidates.append(alias)
    # Try both directions for known renames
    for h in list(candidates):
        for other, mapped in HANDLE_ALIASES.items():
            if mapped == h and other not in candidates:
                candidates.append(other)
    for h in candidates:
        try:
            data = fetch_json(f"https://saranoni.com/products/{urllib.request.quote(h)}.json")
            if data.get("product"):
                return h, data["product"]
        except Exception:
            continue
    return None


def variant_image_src(product: dict, label: str) -> tuple[str, str] | None:
    """Return (src, matched_variant_title) for best Shopify variant image."""
    want = norm(label)
    if not want:
        return None
    images = {im["id"]: im for im in (product.get("images") or []) if im.get("id")}
    variants = product.get("variants") or []

    def score(v: dict) -> int:
        opts = [v.get("option1") or "", v.get("option2") or "", v.get("option3") or "", v.get("title") or ""]
        norms = [norm(o) for o in opts]
        title_n = norm(v.get("title") or "")
        s = 0
        if want in norms:
            s += 100
        if any(want == n or want in n or n in want for n in norms if n):
            s += 60
        if want and want in title_n:
            s += 40
        # token overlap
        for n in norms:
            if not n:
                continue
            if want.startswith(n) or n.startswith(want):
                s += 20
        return s

    ranked = sorted(((score(v), v) for v in variants), key=lambda x: x[0], reverse=True)
    if not ranked or ranked[0][0] <= 0:
        return None
    best = ranked[0][1]
    img = images.get(best.get("image_id"))
    if img and img.get("src"):
        return img["src"], best.get("title") or ""
    # fallback: first image
    if product.get("images"):
        return product["images"][0]["src"], best.get("title") or ""
    return None


def main() -> int:
    if not LABELED.exists():
        print(f"Missing {LABELED}")
        return 1
    rows = list(csv.DictReader(LABELED.open(encoding="utf-8-sig")))
    report: list[dict] = []
    product_cache: dict[str, tuple[str, dict] | None] = {}

    for i, row in enumerate(rows, 1):
        code = row["ProductCode"].strip()
        oid = row["OptionID"].strip()
        label = clean_label(row.get("OptionText") or "")
        t_path = PHOTOS / f"{code}-{oid}-T.jpg"
        s_path = PHOTOS / f"{code}-{oid}-S.jpg"
        print(f"[{i}/{len(rows)}] {code} {oid} {label}")

        if t_path.exists() and s_path.exists():
            report.append(
                {
                    "ProductCode": code,
                    "OptionID": oid,
                    "OptionText": label,
                    "Status": "ALREADY",
                    "ThumbFile": t_path.name,
                    "SmallFile": s_path.name,
                    "SourceURL": "",
                    "MatchedVariant": "",
                    "Note": "",
                }
            )
            print("  ALREADY")
            continue

        if code not in product_cache:
            product_cache[code] = resolve_product(code)
            time.sleep(SLEEP)
        resolved = product_cache[code]
        if not resolved:
            report.append(
                {
                    "ProductCode": code,
                    "OptionID": oid,
                    "OptionText": label,
                    "Status": "NO_HANDLE",
                    "ThumbFile": "",
                    "SmallFile": "",
                    "SourceURL": "",
                    "MatchedVariant": "",
                    "Note": "Shopify handle not found",
                }
            )
            print("  NO_HANDLE")
            continue

        handle, product = resolved
        hit = variant_image_src(product, label)
        if not hit:
            report.append(
                {
                    "ProductCode": code,
                    "OptionID": oid,
                    "OptionText": label,
                    "Status": "NO_MATCH",
                    "ThumbFile": "",
                    "SmallFile": "",
                    "SourceURL": f"https://saranoni.com/products/{handle}",
                    "MatchedVariant": "",
                    "Note": "no Shopify variant matched label",
                }
            )
            print("  NO_MATCH")
            continue

        src, matched = hit
        try:
            buf = fetch_bytes(shopify_url(src))
            w, h = save_pair(buf, t_path, s_path)
            report.append(
                {
                    "ProductCode": code,
                    "OptionID": oid,
                    "OptionText": label,
                    "Status": "OK",
                    "ThumbFile": t_path.name,
                    "SmallFile": s_path.name,
                    "SourceURL": src,
                    "MatchedVariant": matched,
                    "Note": f"{w}x{h}",
                }
            )
            print(f"  OK {t_path.name} <- {matched}")
        except Exception as e:
            report.append(
                {
                    "ProductCode": code,
                    "OptionID": oid,
                    "OptionText": label,
                    "Status": "FAIL",
                    "ThumbFile": "",
                    "SmallFile": "",
                    "SourceURL": src,
                    "MatchedVariant": matched,
                    "Note": str(e)[:200],
                }
            )
            print(f"  FAIL {e}")
        time.sleep(0.15)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    with REPORT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "ProductCode",
                "OptionID",
                "OptionText",
                "Status",
                "ThumbFile",
                "SmallFile",
                "SourceURL",
                "MatchedVariant",
                "Note",
            ],
        )
        w.writeheader()
        w.writerows(report)

    from collections import Counter

    c = Counter(r["Status"] for r in report)
    print("\nStatus counts:", dict(c))
    print("Report:", REPORT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
