#!/usr/bin/env python3
"""Download true alt-view images as {CODE}-altviewN.jpg for Saranoni + Steve Silver.

Naming matches Mahjong PDP probing (`*-altview1.jpg` … `altview12.jpg`).
Does NOT write or overwrite -1 / -2T (main/thumb).

Saranoni: Shopify product.images that are not a variant's primary image_id.
Steve Silver: gallery images beyond the piece/studio hero, preferring room scenes.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
OUT_REPORT = ROOT / "tmp" / "altview-inventory" / "altview_download_report.csv"
SAR_INVENTORY = ROOT / "tmp" / "altview-inventory" / "saranoni_alt_inventory.csv"
SS_INVENTORY = ROOT / "tmp" / "altview-inventory" / "steve_silver_alt_inventory.csv"

UA = {"User-Agent": "Mozilla/5.0 (McCabe altview fetch)"}
MIN_WIDTH = 650
MAIN_MAX = 2000
MAX_ALTVIEWS = 8
JPEG_QUALITY = 92
SLEEP_S = 0.45

# Prefer handles from the working variant-image downloader; fall back to build map.
sys.path.insert(0, str(ROOT / "scripts"))
from build_saranoni_volusion_options import CODE_TO_HANDLE as BUILD_CODE_TO_HANDLE  # noqa: E402

CODE_TO_HANDLE = dict(BUILD_CODE_TO_HANDLE)
CODE_TO_HANDLE.update(
    {
        "SAR-DBL-RCH-FX-FUR": "ruched-minky-throw-blanket",
        "SAR-DBL-RCH-FX-FUR-XL-LG": "ruched-minky-extra-large-throw-blanket",
        "SAR-LUSH": "lush-throw-blankets",
        "SAR-LUSH-XL-LG": "lush-extra-large-blanket",
        "SAR-LUSH-TOD": "lush-toddler-blanket",
        "SAR-LUSH-MINI": "lush-mini-blanket",
        "SAR-LUSH-RCV": "lush-receiving-blanket",
        "SAR-MNKY-LUSH": "minky-lush-throw-blankets",
        "SAR-MNKY-LUSH-XL-LG": "minky-lush-xl-blankets",
        "SAR-MNKY-LUSH-TOD": "minky-lush-toddler-blankets",
        "SAR-MNKY-STR": "minky-stretch-throw-blankets",
        "SAR-MNKY-STR-XL-LG": "minky-stretch-xl-throw-blankets",
        "SAR-MNKY-STR-LUXE-ROBES": "minky-stretch-luxe-robes",
        "SAR-MNKY-PLAY-MAT": "playmat",
        "SAR-MARBLE-FX-FUR-MNKY-XL-LG": "marble-faux-fur-minky-extra-large-throw-blanket",
        "SAR-WEARABLE": "wearable-blanket",
        "SAR-SNUGGLER": "snuggler",
        "SAR-BMB-SNUGGLER": "bamboni-snuggler",
        "SAR-BMB-SETS": "bamboni-sets",
        "SAR-BMB-HATS": "bamboni-hat",
        "SAR-BMB-SOCKS": "bamboni-socks",
        "SAR-BMB-TOD": "bamboni-toddler-blanket",
        "SAR-BMB-TWIN": "bamboni-twin-blankets",
        "SAR-COZY-BMB-ROBES": "cozy-bamboni-robe",
        "SAR-WFL-KNT-ROBES": "waffle-knit-robes",
        "SAR-WFL-KNT": "waffle-knit-throw-blankets-1",
        "SAR-WFL-KNT-XL-LG": "waffle-knit-throw-blankets",
        "SAR-WFL-KNT-KING": "waffle-knit-king-blankets",
        "SAR-WFL-KNT-QUEEN": "waffle-knit-queen-blankets",
        "SAR-WFL-KNT-TWIN": "waffle-knit-twin-blankets",
        "SAR-WFL-KNT-TOD": "waffle-knit-toddler-blankets",
        "SAR-FX-FUR-XL-LG": "faux-fur-xl-throw-blankets",
        "SAR-PLSH-FX-FUR-XL-LG": "plush-faux-fur-throw-blankets",
        "SAR-PLSH-FX-FUR": "plush-faux-fur-throw-blankets",
        "SAR-PTRN-FX-FUR-XL-LG": "patterned-faux-fur-extra-large-throw-blanket",
        "SAR-CHNL-FRNG-XL-LG": "chenille-fringe-xl-throw-blankets",
        "SAR-FX-FUR-XL-LG": "faux-fur-xl-throw-blankets",
        "SAR-MARBLE-FX-FUR-MNKY-XL-LG": "marble-faux-fur-minky-extra-large-throw-blanket",
        "SAR-FX-FUR": "faux-fur-throw-blankets",
        "SAR-FX-FUR-TOD": "faux-fur-toddler-blankets",
        "SAR-CHNL-FRNG": "chenille-fringe-blankets",
        "SAR-DBL-LAYER-BMB-TOD": "double-layer-bamboni-toddler-blanket",
        "SAR-SATIN-BACK-TOD": "satin-back-toddler-blanket",
        "SAR-CHNK-KNT-LG": "chunky-knit-large-throw",
        "SAR-CHNL-FRNG-XL-LG": "chenille-fringe-xl-throw-blankets",
        "SAR-BMBU-RYN-MSLN-XL-LG-4": "bamboo-rayon-muslin-extra-large-4-layer-quilt",
        "SAR-BMBU-RYN-MSLN-QUEEN-KING": "bamboo-rayon-muslin-queen-king-4-layer-quilt",
        "SAR-BMBU-RYN-MSLN-PILLOWCA": "bamboo-rayon-muslin-pillowcase-set",
        "SAR-COTTON-MSLN-4-LAYER": "cotton-muslin-4-layer-quilt",
        "SAR-GRAND-FX-FUR": "grand-faux-fur-throw-blankets-new",
        "SAR-GRAND-FX-FUR-XL-LG": "grand-faux-fur-xl-throw-blankets-new",
        "SAR-GRAND-FX-FUR-KING": "grand-faux-fur-king-blanket",
        "SAR-GRAND-FX-FUR-QUEEN": "grand-faux-fur-queen-blanket",
        "SAR-GRAND-FX-FUR-12X20": "grand-faux-fur-12x20-pillow-cover",
        "SAR-GRAND-FX-FUR-2-PACK-EURO": "grand-faux-fur-2-pack-euro-pillow-covers",
        "SAR-RIBBED-BMB": "ribbed-bamboni-throw-blanket",
        "SAR-RIBBED-BMB-XL-LG": "ribbed-bamboni-extra-large-blanket",
        "SAR-RIBBED-BMB-QUEEN-KING": "ribbed-bamboni-king-blanket",
        "SAR-HP-HP-MSLN-NRS": "harry-potter-muslin-nursery",
        "SAR-HP-HP-ICONS-MNKY-LUSH": "harry-potter-icons-minky-lush",
        "SAR-BATMAN-MNKY-LUSH": "batman-minky-lush",
        "SAR-BATMAN-DBL-LAYER-BMB": "batman-double-layer-bamboni",
        "SAR-JL-JL-MSLN-LUSH": "justice-league-muslin-lush",
        "SAR-WIZARDIN-WORLD-CHARM": "wizarding-world-charm-minky-lush",
    }
)

HANDLE_ALIASES = {
    "grand-faux-fur-throw-blankets": "grand-faux-fur-throw-blankets-new",
    "minky-lush-throw-blankets": "minky-lush-xl-blankets",
}

SKIP_SS = (
    "LOGO",
    "_DTL",
    "DTL",
    "INFO",
    "HARDWARE",
    "AMP1",
    "MOBILE.PNG",
    "INFOGRAPHIC",
)
ROOM_SS = ("_LS", "_RS", "REVISED", "LRREG", "LIVING", "ROOM", "BRREG", "BEDROOM")


def fetch_bytes(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def fetch_json(url: str) -> dict:
    return json.loads(fetch_bytes(url, timeout=45).decode("utf-8", "replace"))


def fetch_text(url: str) -> str:
    return fetch_bytes(url, timeout=45).decode("utf-8", "replace")


def shopify_width_url(src: str, width: int = 2000) -> str:
    base = src.split("?")[0]
    return f"{base}?width={width}"


def save_jpeg(buf: bytes, dest: Path) -> tuple[int, int, str]:
    im = Image.open(io.BytesIO(buf))
    im = im.convert("RGB")
    w, h = im.size
    if w < MIN_WIDTH:
        raise ValueError(f"width {w} < {MIN_WIDTH}")
    if max(w, h) > MAIN_MAX:
        im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        w, h = im.size
        if w < MIN_WIDTH:
            raise ValueError(f"after resize width {w} < {MIN_WIDTH}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    digest = hashlib.md5(dest.read_bytes()).hexdigest()
    return w, h, digest


def resolve_saranoni_product(code: str) -> tuple[str, dict] | None:
    handle = CODE_TO_HANDLE.get(code)
    if not handle:
        return None
    candidates = [handle]
    alias = HANDLE_ALIASES.get(handle)
    if alias and alias not in candidates:
        candidates.append(alias)
    # Also try the reverse alias target as primary for minky-lush
    if handle == "minky-lush-throw-blankets":
        candidates = ["minky-lush-throw-blankets", "minky-lush-xl-blankets"]
    for h in candidates:
        try:
            data = fetch_json(f"https://saranoni.com/products/{urllib.request.quote(h)}.json")
            product = data.get("product")
            if product:
                return h, product
        except Exception:
            continue
    return None


def saranoni_gallery_srcs(product: dict) -> list[str]:
    images = product.get("images") or []
    variant_ids = {v.get("image_id") for v in (product.get("variants") or []) if v.get("image_id")}
    # Prefer non-variant-primary images (angles / lifestyle / extras).
    gallery = [im for im in images if im.get("id") not in variant_ids and im.get("src")]
    # If almost everything is variant-tied, fall back to images after the first.
    if len(gallery) < 2 and len(images) > 1:
        gallery = [im for im in images[1:] if im.get("src")]
    # Prefer /products/ lifestyle composites first, then rest in Shopify order.
    def rank(im: dict) -> tuple[int, int]:
        src = im.get("src") or ""
        lifestyle = 0 if "/products/" in src else 1
        return lifestyle, int(im.get("position") or 999)

    gallery_sorted = sorted(gallery, key=rank)
    out: list[str] = []
    seen: set[str] = set()
    for im in gallery_sorted:
        src = (im.get("src") or "").split("?")[0]
        if not src or src in seen:
            continue
        seen.add(src)
        out.append(im["src"])
    return out


def extract_ss_gallery(html: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for pat in (
        r'data-large_image="([^"]+)"',
        r'data-src="(https://[^"]+\.(?:jpg|jpeg|png|webp))"',
        r'src="(https://stevesilver\.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
        r'(https://stevesilver\.com/wp-content/uploads/[^"\s]+\.(?:jpg|jpeg|png|webp))',
    ):
        for m in re.finditer(pat, html, re.I):
            url = m.group(1).replace("\\/", "/")
            if url in seen:
                continue
            seen.add(url)
            if re.search(r"-\d+x\d+\.", url, re.I):
                continue
            name = url.rsplit("/", 1)[-1]
            blob = (name + " " + url).upper()
            if any(x in blob for x in SKIP_SS):
                continue
            out.append((name, url))
    return out


def ss_is_room(name: str, url: str) -> bool:
    text = (name + " " + url).upper()
    if "_WS" in text:
        return False
    return any(m in text for m in ROOM_SS)


def collect_ss_page_map() -> dict[str, str]:
    """Parse fetch_* scripts + bed catalog for SS code -> product page."""
    pages: dict[str, str] = {}
    scripts_dir = ROOT / "scripts"
    for path in list(scripts_dir.glob("fetch_steve_silver_*.py")) + [
        scripts_dir / "build_steve_silver_bed_catalog.py"
    ]:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        # "SS-CODE": { ... "page": "https://..." }
        for m in re.finditer(
            r'"(SS-[A-Z0-9-]+)"\s*:\s*\{[^}]*?"page"\s*:\s*"(https://stevesilver\.com/product/[^"]+)"',
            text,
            re.S,
        ):
            pages[m.group(1)] = m.group(2)
        # PAGE_URLS = { "SS-CODE": "https://..." }
        for m in re.finditer(
            r'"(SS-[A-Z0-9-]+)"\s*:\s*"(https://stevesilver\.com/product/[^"]+)"',
            text,
        ):
            pages[m.group(1)] = m.group(2)
        # BED_PRODUCTS list entries: "volusion_code": "SS-...", "page": "https://..."
        for m in re.finditer(
            r'"volusion_code"\s*:\s*"(SS-[A-Z0-9-]+)"\s*,(?:[^}]*?)"page"\s*:\s*"(https://stevesilver\.com/product/[^"]+)"',
            text,
            re.S,
        ):
            pages[m.group(1)] = m.group(2)

    bed_csv = ROOT / "catalog" / "steve-silver-beds" / "steve_silver_beds.csv"
    if bed_csv.exists():
        with bed_csv.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                code = (row.get("volusion_code") or row.get("ProductCode") or "").strip()
                page = (row.get("page") or row.get("Page") or "").strip()
                if code.startswith("SS-") and page.startswith("http"):
                    pages[code] = page
    return pages


def saranoni_codes() -> list[str]:
    codes: set[str] = set()
    if SAR_INVENTORY.exists():
        with SAR_INVENTORY.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                c = (row.get("ProductCode") or "").strip()
                if c.startswith("SAR-"):
                    codes.add(c)
    for c in CODE_TO_HANDLE:
        if c.startswith("SAR-"):
            codes.add(c)
    # Prefer inventory order, then remaining mapped codes
    ordered: list[str] = []
    if SAR_INVENTORY.exists():
        with SAR_INVENTORY.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                c = (row.get("ProductCode") or "").strip()
                if c in codes and c not in ordered:
                    ordered.append(c)
    for c in sorted(codes):
        if c not in ordered:
            ordered.append(c)
    return ordered


def steve_silver_codes(page_map: dict[str, str]) -> list[str]:
    codes: set[str] = set()
    for p in PHOTOS.glob("SS-*-1.jpg"):
        codes.add(p.name[: -len("-1.jpg")])
    for c in page_map:
        codes.add(c)
    if SS_INVENTORY.exists():
        with SS_INVENTORY.open(newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                c = (row.get("ProductCode") or "").strip()
                if c.startswith("SS-") and (
                    row.get("Has1") == "True" or (PHOTOS / f"{c}-1.jpg").exists()
                ):
                    codes.add(c)
    return sorted(codes)


def existing_main_hashes(code: str) -> set[str]:
    """Skip altviews that duplicate main/thumb (-1 / -2T), not alternate views."""
    out: set[str] = set()
    for suf in ("-1.jpg", "-1T.jpg", "-2T.jpg", ".jpg"):
        p = PHOTOS / f"{code}{suf}" if suf != ".jpg" else PHOTOS / f"{code}.jpg"
        if not p.exists():
            continue
        try:
            im = Image.open(p).convert("RGB")
            im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            out.add(hashlib.md5(buf.getvalue()).hexdigest())
            out.add(hashlib.md5(p.read_bytes()).hexdigest())
        except Exception:
            continue
    return out


def write_altviews(code: str, urls: list[str], source: str, rows: list[dict]) -> int:
    saved = 0
    seen_hash: set[str] = existing_main_hashes(code)
    for url in urls:
        if saved >= MAX_ALTVIEWS:
            break
        try:
            fetch_url = shopify_width_url(url) if "shopify.com" in url else url
            buf = fetch_bytes(fetch_url)
            dest = PHOTOS / f"{code}-altview{saved + 1}.jpg"
            w, h, digest = save_jpeg(buf, dest)
            if digest in seen_hash:
                dest.unlink(missing_ok=True)
                rows.append(
                    {
                        "Brand": source,
                        "ProductCode": code,
                        "Status": "SKIP_DUP",
                        "AltIndex": "",
                        "Width": w,
                        "Height": h,
                        "Bytes": "",
                        "Path": "",
                        "SourceURL": url,
                        "Note": "duplicate of main/thumb or prior altview",
                    }
                )
                continue
            seen_hash.add(digest)
            saved += 1
            rows.append(
                {
                    "Brand": source,
                    "ProductCode": code,
                    "Status": "OK",
                    "AltIndex": str(saved),
                    "Width": w,
                    "Height": h,
                    "Bytes": dest.stat().st_size,
                    "Path": str(dest),
                    "SourceURL": url,
                    "Note": "",
                }
            )
            print(f"  OK {dest.name} {w}x{h}")
        except Exception as e:
            rows.append(
                {
                    "Brand": source,
                    "ProductCode": code,
                    "Status": "FAIL",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": url,
                    "Note": str(e)[:200],
                }
            )
            print(f"  FAIL {url[:80]}… {e}")
        time.sleep(0.05)
    return saved


def fetch_saranoni(rows: list[dict]) -> None:
    codes = saranoni_codes()
    print(f"\n=== Saranoni: {len(codes)} products ===")
    for i, code in enumerate(codes, 1):
        print(f"[{i}/{len(codes)}] {code}")
        resolved = resolve_saranoni_product(code)
        time.sleep(SLEEP_S)
        if not resolved:
            rows.append(
                {
                    "Brand": "SAR",
                    "ProductCode": code,
                    "Status": "NO_HANDLE",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": "",
                    "Note": "no working Shopify handle",
                }
            )
            print("  NO_HANDLE")
            continue
        handle, product = resolved
        srcs = saranoni_gallery_srcs(product)
        if not srcs:
            rows.append(
                {
                    "Brand": "SAR",
                    "ProductCode": code,
                    "Status": "NO_GALLERY",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": f"https://saranoni.com/products/{handle}",
                    "Note": "no non-variant gallery images",
                }
            )
            print("  NO_GALLERY")
            continue
        saved = write_altviews(code, srcs, "SAR", rows)
        if saved == 0:
            rows.append(
                {
                    "Brand": "SAR",
                    "ProductCode": code,
                    "Status": "NONE_SAVED",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": f"https://saranoni.com/products/{handle}",
                    "Note": f"{len(srcs)} candidates failed min-width/dedupe",
                }
            )


def fetch_steve_silver(rows: list[dict]) -> None:
    page_map = collect_ss_page_map()
    codes = steve_silver_codes(page_map)
    print(f"\n=== Steve Silver: {len(codes)} products ({len(page_map)} pages mapped) ===")
    for i, code in enumerate(codes, 1):
        print(f"[{i}/{len(codes)}] {code}")
        page = page_map.get(code)
        if not page:
            # If we already have a room -2.jpg, promote a copy to altview1
            room = PHOTOS / f"{code}-2.jpg"
            if room.exists():
                try:
                    dest = PHOTOS / f"{code}-altview1.jpg"
                    w, h, _ = save_jpeg(room.read_bytes(), dest)
                    rows.append(
                        {
                            "Brand": "SS",
                            "ProductCode": code,
                            "Status": "OK",
                            "AltIndex": "1",
                            "Width": w,
                            "Height": h,
                            "Bytes": dest.stat().st_size,
                            "Path": str(dest),
                            "SourceURL": str(room),
                            "Note": "copied from existing -2.jpg (no page URL)",
                        }
                    )
                    print(f"  OK {dest.name} from existing -2.jpg")
                except Exception as e:
                    rows.append(
                        {
                            "Brand": "SS",
                            "ProductCode": code,
                            "Status": "FAIL",
                            "AltIndex": "",
                            "Width": "",
                            "Height": "",
                            "Bytes": "",
                            "Path": "",
                            "SourceURL": str(room),
                            "Note": str(e)[:200],
                        }
                    )
            else:
                rows.append(
                    {
                        "Brand": "SS",
                        "ProductCode": code,
                        "Status": "NO_PAGE",
                        "AltIndex": "",
                        "Width": "",
                        "Height": "",
                        "Bytes": "",
                        "Path": "",
                        "SourceURL": "",
                        "Note": "no stevesilver.com page mapping",
                    }
                )
                print("  NO_PAGE")
            continue

        try:
            html = fetch_text(page)
            time.sleep(SLEEP_S)
        except Exception as e:
            rows.append(
                {
                    "Brand": "SS",
                    "ProductCode": code,
                    "Status": "PAGE_FAIL",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": page,
                    "Note": str(e)[:200],
                }
            )
            print(f"  PAGE_FAIL {e}")
            continue

        gallery = extract_ss_gallery(html)
        # Prefer room/lifestyle first, then other non-studio extras
        rooms = [(n, u) for n, u in gallery if ss_is_room(n, u)]
        others = [(n, u) for n, u in gallery if not ss_is_room(n, u)]
        # Drop pure white-studio WS1 if we already have -1 from it — keep extra angles
        ordered = rooms + others
        urls = [u for _, u in ordered]
        if not urls:
            rows.append(
                {
                    "Brand": "SS",
                    "ProductCode": code,
                    "Status": "NO_GALLERY",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": page,
                    "Note": "no gallery urls parsed",
                }
            )
            print("  NO_GALLERY")
            continue
        saved = write_altviews(code, urls, "SS", rows)
        if saved == 0:
            rows.append(
                {
                    "Brand": "SS",
                    "ProductCode": code,
                    "Status": "NONE_SAVED",
                    "AltIndex": "",
                    "Width": "",
                    "Height": "",
                    "Bytes": "",
                    "Path": "",
                    "SourceURL": page,
                    "Note": f"{len(urls)} candidates failed",
                }
            )


def update_inventory_flags() -> None:
    if SAR_INVENTORY.exists():
        rows = list(csv.DictReader(SAR_INVENTORY.open(encoding="utf-8-sig")))
        fieldnames = list(rows[0].keys()) if rows else ["ProductCode", "Has1", "Has2", "Has2T", "HasAltview1"]
        if "HasAltview1" not in fieldnames:
            fieldnames.append("HasAltview1")
        for row in rows:
            code = row.get("ProductCode", "")
            row["HasAltview1"] = "True" if (PHOTOS / f"{code}-altview1.jpg").exists() else "False"
        with SAR_INVENTORY.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)

    if SS_INVENTORY.exists():
        rows = list(csv.DictReader(SS_INVENTORY.open(encoding="utf-8-sig")))
        fieldnames = list(rows[0].keys()) if rows else []
        if "HasAltview1" not in fieldnames:
            fieldnames.append("HasAltview1")
        for row in rows:
            code = row.get("ProductCode", "")
            row["HasAltview1"] = "True" if (PHOTOS / f"{code}-altview1.jpg").exists() else "False"
        with SS_INVENTORY.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)


def main() -> int:
    only: set[str] | None = None
    if len(sys.argv) > 1 and sys.argv[1] == "--only":
        only = {c.strip().upper() for c in sys.argv[2:] if c.strip()}

    PHOTOS.mkdir(parents=True, exist_ok=True)
    OUT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []

    # Optional filter via temporary monkeypatch of code list helpers
    if only:
        _sar = saranoni_codes
        _ss = steve_silver_codes
        globals()["saranoni_codes"] = lambda: [c for c in _sar() if c in only]
        globals()["steve_silver_codes"] = lambda page_map: [c for c in _ss(page_map) if c in only]

    fetch_saranoni(rows)
    fetch_steve_silver(rows)
    update_inventory_flags()

    fieldnames = [
        "Brand",
        "ProductCode",
        "Status",
        "AltIndex",
        "Width",
        "Height",
        "Bytes",
        "Path",
        "SourceURL",
        "Note",
    ]
    if only and OUT_REPORT.exists():
        with OUT_REPORT.open("a", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=fieldnames).writerows(rows)
    else:
        with OUT_REPORT.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)

    ok = sum(1 for r in rows if r["Status"] == "OK")
    print(f"\nDone. OK rows={ok}")
    print(f"SAR altview files: {len(list(PHOTOS.glob('SAR-*-altview*.jpg')))}")
    print(f"SS altview files: {len(list(PHOTOS.glob('SS-*-altview*.jpg')))}")
    print(f"Report: {OUT_REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
