#!/usr/bin/env python3
"""Download Steve Silver upholstery (sofa/sectional) photos for Volusion PLP/PDP.

Primary (-1.jpg): sharp white-background / studio product shot (_WS / _WS1).
Alternate (-2.jpg): room scene (_LS / _RS / lifestyle).

Sources: stevesilver.com product galleries.
Outputs: vspfiles/photos/SS-*SOFA*-1.jpg, SS-*SECT*-1.jpg, -1T, -2, -2T
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
UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver upholstery photos)"}
MIN_BYTES = 15_000

SKIP_MARKERS = (
    "LOGO",
    "_DTL",
    "DTL",
    "INFO",
    "HARDWARE",
    "AMP1",
    "MOBILE.PNG",
    "INFOGRAPHIC",
)
ROOM_MARKERS = ("_LS", "_RS", "REVISED", "LRREG", "LIVING", "ROOM")
PIECE_MARKERS = ("_WS", "_VG1", "_VG2", "WHITE", "STUDIO")

UPHOLSTERY_PRODUCTS: dict[str, dict[str, str]] = {
    "SS-CONROE-PWR-CHAISE-SECT": {
        "page": "https://stevesilver.com/product/conroe-dual-power-reclining-sectional-with-chaise-cobblestone/",
        "sku": "CON80621T",
        "family": "CONROE",
    },
    "SS-CONROE-GRAY-PWR-SECT": {
        "page": "https://stevesilver.com/product/conroe-dual-power-6-piece-reclining-sectional-with-chaise-gray/",
        "sku": "CON80621G",
        "family": "CONROE",
    },
    "SS-GATLIN-PWR-SECT": {
        "page": "https://stevesilver.com/product/gatlin-dual-power-leather-6-piece-modular-reclining-sectional/",
        "sku": "GAT70696T",
        "family": "GATLIN",
    },
    "SS-DENVER-CHAR-PWR-SECT": {
        "page": "https://stevesilver.com/product/denver-dual-power-6-piece-sectional-charcoal/",
        "sku": "DN5691ACC",
        "family": "DENVER",
    },
    "SS-DENVER-BROWN-PWR-SECT": {
        "page": "https://stevesilver.com/product/denver-dual-power-6-piece-sectional/",
        "sku": "DN5691",
        "family": "DENVER",
    },
    "SS-LUNA-CHAR-PWR-SOFA": {
        "page": "https://stevesilver.com/product/luna-home-cinema-power-reclining-sofa-charcoal-vegan-leather/",
        "sku": "LUN800KS",
        "family": "LUNA",
    },
    "SS-LUNA-ICE-PWR-SOFA": {
        "page": "https://stevesilver.com/product/luna-home-cinema-power-sofa-ice-vegan-leather/",
        "sku": "LUN800GS",
        "family": "LUNA",
    },
    "SS-DANIEL-PWR-SOFA": {
        "page": "https://stevesilver.com/product/daniel-triple-power-home-theater-leather-reclining-sofa-with-drop-down-control-console-built-in-speakers-heat-and-massage/",
        "sku": "DAE800S",
        "family": "DANIEL",
    },
    "SS-ZENITH-PWR-CONSOLE-SOFA": {
        "page": "https://stevesilver.com/product/zenith-triple-power-home-theater-reclining-sofa-with-drop-down-control-console-built-in-speakers-vibration/",
        "sku": "ZTH800KS",
        "family": "ZENITH",
    },
    "SS-ALEX-STONE-PWR-SECT": {
        "page": "https://stevesilver.com/product/alexandria-leather-6-piece-power-reclining-set-stone/",
        "sku": "ALX70629",
        "family": "ALEX",
    },
    "SS-OLSEN-DOVE-PWR-SOFA": {
        "page": "https://stevesilver.com/product/olsen-3-piece-dual-power-zero-gravity-modular-reclining-sofa/",
        "sku": "OLN5355T",
        "family": "OLSEN",
    },
    "SS-KEILY-BROWN-86SOFA": {
        "page": "https://stevesilver.com/product/keily-manual-motion-recliner-sofa-w-dropdown-table/",
        "sku": "KE800S",
        "family": "KEILY",
    },
    "SS-NOAH-GRAY-SLEEPER-SOFA": {
        "page": "https://stevesilver.com/product/noah-flippable-convertible-storage-sleeper-chofa-gray/",
        "sku": "NOA800G",
        "family": "NOAH",
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
    if "_WS" in text:
        return False
    if any(marker in text for marker in ROOM_MARKERS):
        return True
    if "_LS" in text and not any(marker in text for marker in PIECE_MARKERS):
        return True
    return False


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
    prefix = re.sub(r"[^A-Z0-9].*", "", sku.upper())
    if len(prefix) >= 5 and prefix[:5] in text:
        return True
    return False


def matches_family(alt: str, url: str, family: str) -> bool:
    if not family:
        return True
    return family.upper() in blob(alt, url)


def room_score(alt: str, url: str, sku: str, family: str = "") -> int:
    text = blob(alt, url)
    score = 0
    if "_RS" in text or "REVISED" in text:
        score += 100
    if "_LS2" in text:
        score += 90
    if "_LS1" in text:
        score += 80
    if "_LS" in text:
        score += 70
    if "7PC" in text or "6PC" in text or "SECT" in text or "SOFA" in text:
        score += 20
    if matches_sku(alt, url, sku):
        score += 30
    if matches_family(alt, url, family):
        score += 40
    elif family:
        score -= 300
    if "_WS" in text:
        score -= 200
    return score


def piece_score(alt: str, url: str, sku: str, family: str = "") -> int:
    text = blob(alt, url)
    score = 0
    if re.search(r"_WS1(?:[^0-9]|$)", text):
        score += 120
    if "_WS1" in text:
        score += 100
    if "_WS" in text:
        score += 80
    if "_VG1" in text:
        score += 70
    if matches_sku(alt, url, sku):
        score += 30
    if matches_family(alt, url, family):
        score += 40
    elif family:
        score -= 300
    if "7PC" in text or "6PC" in text or "3PC" in text:
        score += 15
    if "_LS" in text or "_RS" in text:
        score -= 200
    if "_DTL" in text:
        score -= 100
    return score


def pick_piece_url(
    primary_images: list[tuple[str, str]],
    all_images: list[tuple[str, str]],
    sku: str,
    family: str = "",
) -> str:
    for source in (primary_images, all_images):
        candidates = [
            (piece_score(alt, url, sku, family), url)
            for alt, url in source
            if is_piece_shot(alt, url)
            and matches_family(alt, url, family)
            and (not sku or matches_sku(alt, url, sku))
        ]
        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates and candidates[0][0] > 0:
            return candidates[0][1]

    for source in (primary_images, all_images):
        candidates = [
            (piece_score(alt, url, sku, family), url)
            for alt, url in source
            if matches_family(alt, url, family)
            and not is_room_scene(alt, url)
            and not should_skip(alt, url)
        ]
        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates and candidates[0][0] > 0:
            return candidates[0][1]

    for source in (primary_images, all_images):
        for alt, url in source:
            if (
                matches_family(alt, url, family)
                and not is_room_scene(alt, url)
                and not should_skip(alt, url)
            ):
                return url

    return all_images[0][1] if all_images else ""


def pick_room_url(all_images: list[tuple[str, str]], sku: str, piece_url: str, family: str = "") -> str:
    candidates = [
        (room_score(alt, url, sku, family), url)
        for alt, url in all_images
        if url != piece_url and is_room_scene(alt, url) and matches_family(alt, url, family)
    ]
    candidates.sort(key=lambda x: x[0], reverse=True)
    if candidates and candidates[0][0] > 0:
        return candidates[0][1]

    for alt, url in all_images:
        if url != piece_url and is_room_scene(alt, url) and matches_family(alt, url, family):
            return url
    return ""


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
    family = config.get("family", "")

    print(f"=== {code} ===")
    print(f"  page: {page_url}")

    try:
        html = fetch_text(page_url)
    except urllib.error.HTTPError as exc:
        print(f"  ::error:: page HTTP {exc.code}")
        return False

    all_images = extract_gallery_images(html)
    if not all_images:
        print("  ::error:: no gallery images found")
        return False

    print(f"  gallery ({len(all_images)}):")
    for label, url in all_images[:8]:
        print(f"    - {label[:60]} -> {url.split('/')[-1]}")

    piece_url = pick_piece_url(all_images, all_images, sku, family)
    room_url = pick_room_url(all_images, sku, piece_url, family)
    print(f"  primary: {piece_url.split('/')[-1]}")
    print(f"  alt:     {room_url.split('/')[-1] if room_url else '(none)'}")

    if not piece_url:
        print("  ::error:: no product shot found")
        return False

    try:
        if force or not primary_path.is_file():
            save_jpeg(fetch_bytes(piece_url), primary_path)
        if room_url and (force or not alt_path.is_file()):
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

    products = UPHOLSTERY_PRODUCTS
    if args.code:
        products = {k: v for k, v in UPHOLSTERY_PRODUCTS.items() if k in args.code}

    ok = 0
    fail = 0
    for code, config in sorted(products.items()):
        if process_product(code, config, args.force):
            ok += 1
        else:
            fail += 1

    print(f"\nDone: {ok} ok, {fail} failed")
    print("Deploy: push vspfiles/photos/SS-*SOFA*.jpg SS-*SECT*.jpg (deploy-ss-bedroom-photos workflow)")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
