#!/usr/bin/env python3
"""Download Steve Silver bedroom dresser photos for Volusion PLP/PDP.

Primary (-1.jpg): single piece product shot (WS / VG1 / dresser hero).
Alternate (-2.jpg): full bedroom room scene (RS / LS / set shot).

Sources: stevesilver.com product galleries (and optional set pages for room scenes).
Outputs: vspfiles/photos/SS-*DR*-1.jpg, -2.jpg, -1T.jpg, -2T.jpg
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
UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver dresser photos)"}
MIN_BYTES = 15_000

SKIP_MARKERS = ("LOGO", "_DTL", "DTL", "INFO", "HARDWARE", "AMP1", "MOBILE.PNG")
ROOM_MARKERS = (
    "_RS",
    "REVISED",
    "BRREG",
    "K4PC",
    "K5PC",
    "KS4PC",
    "-K4PC",
    "-K5PC",
    "BEDROOM",
)
PIECE_MARKERS = ("_WS", "_VG1", "_VG2", "DRESSER", "900DR", "DRB", "DRS")

SKU_ALIASES: dict[str, tuple[str, ...]] = {
    "BC950DRB": ("BC950MRB", "BC950DRB", "DRB"),
    "MON900DRST": ("MON900DRS", "MON900DRST"),
}

DRESSER_PRODUCTS: dict[str, dict[str, str]] = {
    "SS-BC900DR": {
        "page": "https://stevesilver.com/product/bear-creek-dresser/",
        "sku": "BC900DR",
        "room_page": "https://stevesilver.com/product/bear-creek-4-piece-king-setk-bed-ns-dresser-mir/",
    },
    "SS-BC950DRB": {
        "page": "https://stevesilver.com/product/bear-creek-dresser-brown-2/",
        "sku": "BC950DRB",
        "room_page": "https://stevesilver.com/product/bear-creek-brown-4-piece-king-set/",
    },
    "SS-CAS900DR": {
        "page": "https://stevesilver.com/product/cassie-illuminating-glam-58-dresser-shimmering-pearl-finish/",
        "sku": "CAS900DR",
        "room_page": "https://stevesilver.com/product/cassie-illuminating-4-piece-glam-king-set/",
    },
    "SS-MON900DRST": {
        "page": "https://stevesilver.com/product/montana-dresser-sand/",
        "sku": "MON900DRST",
        "room_page": "https://stevesilver.com/product/montana-4-piece-king-set-sand/",
    },
    "SS-RV900DR": {
        "page": "https://stevesilver.com/product/riverdale-dresser/",
        "sku": "RV900DR",
        "room_page": "https://stevesilver.com/product/riverdale-4-piece-king-storage-bedroom-set/",
    },
    "SS-SIG900DR": {
        "page": "https://stevesilver.com/product/sigmund-6-drawer-dresser/",
        "sku": "SIG900DR",
        "room_page": "https://stevesilver.com/product/sigmund-3-piece-king-bedroom-set/",
    },
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
            alt = url.rsplit("/", 1)[-1]
            if should_skip(alt, url):
                continue
            out.append((alt, url))

    if not out:
        og = re.search(r'property="og:image"\s+content="([^"]+)"', html, re.I)
        if og:
            out.append(("og", og.group(1)))

    return out


def blob(alt: str, url: str) -> str:
    return (alt + " " + url).upper()


def should_skip(alt: str, url: str) -> bool:
    text = blob(alt, url)
    return any(marker in text for marker in SKIP_MARKERS)


def is_room_scene(alt: str, url: str) -> bool:
    text = blob(alt, url)
    if "_LS" in text and any(x in text for x in ROOM_MARKERS):
        return True
    if "_LS" in text and not any(x in text for x in PIECE_MARKERS):
        return True
    return any(marker in text for marker in ROOM_MARKERS)


def is_piece_shot(alt: str, url: str) -> bool:
    text = blob(alt, url)
    if should_skip(alt, url) or is_room_scene(alt, url):
        return False
    return any(marker in text for marker in PIECE_MARKERS)


def matches_sku(alt: str, url: str, sku: str) -> bool:
    if not sku:
        return True
    text = blob(alt, url)
    if sku.upper() in text:
        return True
    for alias in SKU_ALIASES.get(sku, ()):
        if alias.upper() in text:
            return True
    return False


def room_score(alt: str, url: str, sku: str) -> int:
    text = blob(alt, url)
    score = 0
    if "_RS" in text or "REVISED" in text:
        score += 100
    if any(x in text for x in ("K4PC", "K5PC", "KS4PC", "-K4PC", "-K5PC")):
        score += 80
    if "BRREG" in text:
        score += 70
    if "_LS" in text:
        score += 50
    if matches_sku(alt, url, sku):
        score += 20
    return score


def piece_score(alt: str, url: str, sku: str) -> int:
    text = blob(alt, url)
    score = 0
    if "_WS" in text:
        score += 100
    if "_VG1" in text:
        score += 90
    if "_VG2" in text:
        score += 70
    if "DRESSER" in text and "BRREG" not in text:
        score += 60
    if matches_sku(alt, url, sku):
        score += 30
    if "DRMR" in text and sku.upper().endswith("DR"):
        score -= 40
    if "DRMR" in text and "_WS" in text:
        score += 10
    if "_LS" in text or "_RS" in text:
        score -= 100
    return score


def classify_images(images: list[tuple[str, str]], sku: str) -> tuple[str, str]:
    piece_url = ""
    room_url = ""

    piece_candidates = [
        (piece_score(alt, url, sku), alt, url)
        for alt, url in images
        if (not sku or matches_sku(alt, url, sku))
        and (is_piece_shot(alt, url) or not is_room_scene(alt, url))
    ]
    piece_candidates.sort(key=lambda x: x[0], reverse=True)
    if piece_candidates and piece_candidates[0][0] > 0:
        piece_url = piece_candidates[0][2]

    room_candidates = [
        (room_score(alt, url, sku), alt, url)
        for alt, url in images
        if is_room_scene(alt, url)
    ]
    room_candidates.sort(key=lambda x: x[0], reverse=True)
    if room_candidates and room_candidates[0][0] > 0:
        room_url = room_candidates[0][2]

    if not piece_url and images:
        for alt, url in images:
            if (not sku or matches_sku(alt, url, sku)) and not is_room_scene(alt, url) and not should_skip(alt, url):
                piece_url = url
                break
    if not piece_url and images:
        for alt, url in images:
            if not is_room_scene(alt, url) and not should_skip(alt, url):
                piece_url = url
                break
    if not piece_url and images:
        piece_url = images[0][1]

    if not room_url and len(images) > 1:
        for alt, url in images:
            if url != piece_url and is_room_scene(alt, url):
                room_url = url
                break

    return piece_url, room_url


def pick_piece_url(primary_images: list[tuple[str, str]], all_images: list[tuple[str, str]], sku: str) -> str:
    for source in (primary_images, all_images):
        candidates = [
            (piece_score(alt, url, sku), url)
            for alt, url in source
            if is_piece_shot(alt, url) and (not sku or matches_sku(alt, url, sku))
        ]
        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates and candidates[0][0] > 0:
            return candidates[0][1]

    for source in (primary_images, all_images):
        candidates = [
            (piece_score(alt, url, sku), url)
            for alt, url in source
            if is_piece_shot(alt, url)
        ]
        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates and candidates[0][0] > 0:
            return candidates[0][1]

    for source in (primary_images, all_images):
        for alt, url in source:
            if not is_room_scene(alt, url) and not should_skip(alt, url):
                return url

    return all_images[0][1] if all_images else ""


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
        sys.path.insert(0, str(ROOT / "scripts"))
        from generate_volusion_photo_thumbnails import generate_for_code  # noqa: PLC0415
    for line in generate_for_code(code, slots=(1, 2)):
        print(f"  thumb {line}")


def process_product(code: str, config: dict[str, str], force: bool) -> bool:
    primary_path = PHOTOS / f"{code}-1.jpg"
    alt_path = PHOTOS / f"{code}-2.jpg"

    if primary_path.is_file() and alt_path.is_file() and not force:
        print(f"skip {code} (exists)")
        return True

    page_url = config["page"]
    sku = config.get("sku", "")
    room_page = config.get("room_page", "")

    print(f"=== {code} ===")
    print(f"  page: {page_url}")
    if room_page:
        print(f"  room page: {room_page}")

    try:
        html = fetch_text(page_url)
    except urllib.error.HTTPError as exc:
        print(f"  ::error:: page HTTP {exc.code}")
        return False

    primary_images = extract_gallery_images(html)
    all_images = list(primary_images)
    if room_page:
        try:
            room_html = fetch_text(room_page)
            all_images = all_images + extract_gallery_images(room_html)
        except urllib.error.HTTPError as exc:
            print(f"  ::warning:: room page HTTP {exc.code}")

    if not all_images:
        print("  ::error:: no gallery images found")
        return False

    print(f"  gallery ({len(all_images)}):")
    for label, url in all_images[:8]:
        print(f"    - {label[:60]} -> {url.split('/')[-1]}")

    piece_url = pick_piece_url(primary_images, all_images, sku)
    _, room_url = classify_images(all_images, sku)
    print(f"  primary: {piece_url.split('/')[-1]}")
    print(f"  alt:     {room_url.split('/')[-1]}")

    if not room_url:
        print("  ::error:: no room-scene image found")
        return False

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

    products = DRESSER_PRODUCTS
    if args.code:
        products = {k: v for k, v in DRESSER_PRODUCTS.items() if k in args.code}

    ok = 0
    fail = 0
    for code, config in sorted(products.items()):
        if process_product(code, config, args.force):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} ok, {fail} failed")
    print("Deploy: push vspfiles/photos/SS-*DR*.jpg (deploy-plp-photos or full deploy)")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
