#!/usr/bin/env python3
"""Download Steve Silver Highland Park (HP900) bedroom photos for Volusion PLP/PDP.

Primary (-1.jpg): single piece product shot (WS1 / piece hero).
Alternate (-2.jpg): full bedroom room scene (RS1 / set shot).

Sources: stevesilver.com product galleries.
Outputs: vspfiles/photos/SS-HP900*-1.jpg and SS-HP900*-2.jpg
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bedroom photos)"}
MIN_BYTES = 15_000

# Shared bedroom room scenes when mirror pages lack a set shot (2019/10 path — 2023/05 URLs 404)
ROOM_SHOTS = {
    "white": "https://stevesilver.com/wp-content/uploads/2019/10/HighlandPark_HP900HBW_HP900KFBW_HP900CTW_HP900NSWHP900DRW_HP900MRW_HP900VDW_HP900VMW_RS1_Revised.jpg",
    "driftwood": "https://stevesilver.com/wp-content/uploads/2019/10/Highland_Park_HP900KHBD_HP900KFBD_HP900SRD_HP900NSD_HP900CTD__HP900MRD_HP900DRD_RS1-1.jpg",
}

FINISH_BY_CODE = {
    "SS-HP900NSW": "white",
    "SS-HP900CTWT": "white",
    "SS-HP900MRW": "white",
    "SS-HP900NSD": "driftwood",
    "SS-HP900CTDT": "driftwood",
    "SS-HP900MRD": "driftwood",
}

# Volusion product code -> Steve Silver product page slug
BEDROOM_PRODUCTS: dict[str, str] = {
    "SS-HP900NSW": "https://stevesilver.com/product/highland-park-nightstand-cathedral-white/",
    "SS-HP900NSD": "https://stevesilver.com/product/highland-park-nightstand-waed-driftwood/",
    "SS-HP900CTWT": "https://stevesilver.com/product/highland-park-chest-cathedral-white/",
    "SS-HP900CTDT": "https://stevesilver.com/product/highland-park-chest-waeddriftwood/",
    "SS-HP900MRW": "https://stevesilver.com/product/highland-park-mirror-cathedral-white/",
    "SS-HP900MRD": "https://stevesilver.com/product/highland-park-mirror-waed-driftwood/",
}


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if len(data) < MIN_BYTES:
        raise ValueError(f"too small ({len(data)} bytes): {url}")
    return data


def extract_gallery_images(html: str) -> list[tuple[str, str]]:
    """Return [(alt_label, full_url), ...] in gallery order."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    # WooCommerce gallery: data-large_image, data-src, src in product gallery
    for pat in (
        r'data-large_image="([^"]+)"',
        r'data-src="(https://[^"]+\.(?:jpg|jpeg|png|webp))"',
        r'src="(https://stevesilver\.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
    ):
        for m in re.finditer(pat, html, re.I):
            url = m.group(1).replace("\\/", "/")
            if url in seen:
                continue
            seen.add(url)
            alt = ""
            alt_m = re.search(
                r'(?:data-large_image|data-src|src)="' + re.escape(m.group(1)) + r'"[^>]*alt="([^"]*)"',
                html,
                re.I,
            )
            if not alt_m:
                alt_m = re.search(
                    r'alt="([^"]*)"[^>]*(?:data-large_image|data-src|src)="' + re.escape(m.group(1)) + r'"',
                    html,
                    re.I,
                )
            if alt_m:
                alt = alt_m.group(1)
            if not alt:
                alt = url.rsplit("/", 1)[-1]
            if "logo" in (alt + url).lower():
                continue
            if re.search(r"-700x545|-500x389|-150x", url, re.I):
                continue
            out.append((alt, url))

    # Fallback: og:image
    if not out:
        og = re.search(r'property="og:image"\s+content="([^"]+)"', html, re.I)
        if og:
            out.append(("og", og.group(1)))

    return out


def classify_images(images: list[tuple[str, str]]) -> tuple[str, str]:
    """Pick piece-alone (primary) and room-scene (alt) URLs."""
    piece_url = ""
    room_url = ""

    for alt, url in images:
        blob = (alt + " " + url).upper()
        if not room_url and ("_RS" in blob or "REVISED" in blob or "ROOM" in blob or "SET" in blob):
            if any(x in blob for x in ("HP900HB", "HP900KF", "HP900DR", "HP900NS", "HP900CT", "HP900MR", "HP900VD")):
                room_url = url
                continue
        if not piece_url and ("_WS" in blob or "_DTL" not in blob):
            if any(x in blob for x in ("HP900NS", "HP900CT", "HP900MR", "NSW", "NSD", "CTW", "CTT", "MRW", "MRD")):
                if "_RS" not in blob and "REVISED" not in blob:
                    piece_url = url

    # First image = piece, second wide set shot = room
    if not piece_url and images:
        for alt, url in images:
            if "_RS" not in (alt + url).upper() and "REVISED" not in (alt + url).upper():
                piece_url = url
                break
    if not room_url and len(images) > 1:
        for alt, url in images:
            if "_RS" in (alt + url).upper() or "REVISED" in (alt + url).upper():
                room_url = url
                break
    if not room_url and len(images) > 1:
        room_url = images[1][1]

    if not piece_url and images:
        piece_url = images[0][1]

    return piece_url, room_url


def to_jpeg(data: bytes) -> bytes:
    try:
        from PIL import Image  # noqa: PLC0415
    except ImportError:
        return data
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


def save_jpeg(data: bytes, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    jpeg = to_jpeg(data)
    dest.write_bytes(jpeg)
    print(f"  wrote {dest.name} ({len(jpeg)} bytes)")


def generate_thumbnails(code: str) -> None:
    try:
        from generate_volusion_photo_thumbnails import generate_for_code  # noqa: PLC0415
    except ImportError:
        import sys

        sys.path.insert(0, str(ROOT / "scripts"))
        from generate_volusion_photo_thumbnails import generate_for_code  # noqa: PLC0415
    for line in generate_for_code(code, slots=(1, 2)):
        print(f"  thumb {line}")


def process_product(code: str, page_url: str, force: bool) -> bool:
    primary_path = PHOTOS / f"{code}-1.jpg"
    alt_path = PHOTOS / f"{code}-2.jpg"

    if primary_path.is_file() and alt_path.is_file() and not force:
        print(f"skip {code} (exists)")
        return True

    print(f"=== {code} ===")
    print(f"  page: {page_url}")
    try:
        html = fetch_text(page_url)
    except urllib.error.HTTPError as exc:
        print(f"  ::error:: page HTTP {exc.code}")
        return False

    images = extract_gallery_images(html)
    if not images:
        print("  ::error:: no gallery images found")
        return False

    print(f"  gallery ({len(images)}):")
    for label, url in images[:6]:
        print(f"    - {label[:60]} -> {url.split('/')[-1]}")

    piece_url, room_url = classify_images(images)
    finish = FINISH_BY_CODE.get(code, "")
    if not room_url or "logo" in room_url.lower():
        if finish in ROOM_SHOTS:
            room_url = ROOM_SHOTS[finish]
    print(f"  primary: {piece_url.split('/')[-1]}")
    print(f"  alt:     {room_url.split('/')[-1]}")

    try:
        if force or not primary_path.is_file():
            save_jpeg(fetch_bytes(piece_url), primary_path)
        if force or not alt_path.is_file():
            save_jpeg(fetch_bytes(room_url), alt_path)
    except Exception as exc:  # noqa: BLE001
        print(f"  ::error:: download failed: {exc}")
        return False
    generate_thumbnails(code)
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    parser.add_argument("--code", action="append", help="Only process these Volusion codes")
    args = parser.parse_args()

    products = BEDROOM_PRODUCTS
    if args.code:
        products = {k: v for k, v in BEDROOM_PRODUCTS.items() if k in args.code}

    ok = 0
    fail = 0
    for code, url in sorted(products.items()):
        if process_product(code, url, args.force):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} ok, {fail} failed")
    print("Deploy: push vspfiles/photos/SS-HP900*.jpg (deploy-plp-photos or full deploy)")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
