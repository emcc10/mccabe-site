#!/usr/bin/env python3
"""
Download missing Volusion PLP stock photos into vspfiles/photos/.

Uses Palliser dealer/catalog product photography (studio shots), not spec-sheet PDFs.

Usage:
  py -3 scripts/fetch_missing_palliser_stock_photos.py
  py -3 scripts/fetch_missing_palliser_stock_photos.py --force
"""
from __future__ import annotations

import argparse
import io
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe Palliser stock photos)"}
SOS = "https://images.sofasandsectionals.com/images/photos"
MIN_BYTES = 20_000
MIN_W, MIN_H = 450, 350

# Volusion filename -> official Palliser studio/catalog photo URL
STOCK_SOURCES: dict[str, str] = {
    # Windsor 77176
    "77176-A4-1.jpg": f"{SOS}/256181.original.jpg",
    "77176-AE-1.jpg": f"{SOS}/256182.original.jpg",
    "77176-AS-1.jpg": f"{SOS}/256183.original.jpg",
    # Madison track arm 77651
    "77651-01-1.jpg": f"{SOS}/214972.original.jpg",
    "77651-A1-1.jpg": f"{SOS}/214973.original.jpg",
    "77651-D1-1.jpg": f"{SOS}/214974.original.jpg",
    # Madison roll arm 77656
    "77656-01-1.jpg": f"{SOS}/263173.original.png",
    "77656-A1-1.jpg": f"{SOS}/263174.original.png",
    "77656-D1-1.jpg": f"{SOS}/215164.original.jpg",
    # Madison modern english 77658
    "77658-01-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/1b23ca5a7ef940b790c17116ec2fbbd1.jpg"
    ),
    "77658-A1-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/1b23ca5a7ef940b790c17116ec2fbbd1.jpg"
    ),
    "77658-D1-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/1b23ca5a7ef940b790c17116ec2fbbd1.jpg"
    ),
    # Charli 77743
    "77743-01-1.jpg": f"{SOS}/263272.original.jpg",
    "77743-A1-1.jpg": f"{SOS}/263273.original.jpg",
    "77743-D1-1.jpg": f"{SOS}/263274.original.jpg",
    # Laguna 77752
    "77752-01-1.jpg": f"{SOS}/263372.original.jpg",
    "77752-A1-1.jpg": f"{SOS}/263373.original.jpg",
    "77752-D1-1.jpg": f"{SOS}/263374.original.jpg",
    # Pyper apartment 77768-91 (70" apartment sofa)
    "77768-91-1.jpg": (
        "https://www.alinefurniture.ca/wp-content/uploads/2025/11/"
        "PALLISER-PYPERTON-SOFA-RESERVE-LONDON-FOG.jpg"
    ),
    # Denali 43003
    "43003-38-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/f5c591a3e91242808969e874dbc9d5a2.jpg"
    ),
    "43003-33-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/f5c591a3e91242808969e874dbc9d5a2.jpg"
    ),
    # Kinsley 77111-G3
    "77111-G3-1.jpg": f"{SOS}/243752.original.jpg",
    # Pinecrest 42306
    "42306-31-1.jpg": f"{SOS}/88658.original.jpg",
    "42306-32-1.jpg": f"{SOS}/88658.original.jpg",
    "42306-33-1.jpg": f"{SOS}/88659.original.jpg",
    "42306-34-1.jpg": f"{SOS}/88660.original.jpg",
    "42306-35-1.jpg": f"{SOS}/88661.original.jpg",
    # Regent 41094
    "41094-32-1.jpg": f"{SOS}/88429.original.jpg",
    "41094-33-1.jpg": f"{SOS}/88433.original.jpg",
    "41094-35-1.jpg": f"{SOS}/88432.original.jpg",
    "41094-39-1.jpg": f"{SOS}/264579.original.png",
    # Thea 77119
    "77119-J2-1.jpg": f"{SITE}/v/vspfiles/photos/77119-N2-2T.jpg",
    "77119-M2-1.jpg": (
        "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/"
        "assets/fa3bca52c55245cbacdcb6ebe7b1f431.jpg"
    ),
    # Theo 42002
    "42002-32-1.jpg": f"{SOS}/245773.original.jpg",
    "42002-33-1.jpg": f"{SOS}/245774.original.jpg",
    "42002-34-1.jpg": f"{SOS}/245775.original.jpg",
    "42002-35-1.jpg": f"{SOS}/245776.original.jpg",
    "42002-39-1.jpg": f"{SOS}/245777.original.jpg",
    # Tundra 41043
    "41043-35-1.jpg": f"{SOS}/264465.original.png",
    "41043-39-1.jpg": f"{SOS}/264471.original.png",
    # ZG5 41089-42
    "41089-42-1.jpg": (
        "https://dowfurniture.com/cdn/shop/products/"
        "Palliser_2022-10-21T20_12_04.850936_gjilcrurxc_1200x1194.jpg"
    ),
}

LIVE_FALLBACK: dict[str, list[str]] = {}


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def to_jpeg(data: bytes) -> bytes:
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90, optimize=True)
    return out.getvalue()


def validate_jpeg(data: bytes) -> tuple[int, int]:
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    w, h = img.size
    if len(data) < MIN_BYTES:
        raise ValueError(f"too small ({len(data)} bytes)")
    if w < MIN_W or h < MIN_H:
        raise ValueError(f"dimensions too small ({w}x{h})")
    # Spec-sheet QR codes extracted from PDFs are square ~800x800; reject obvious squares.
    ratio = w / h
    if 0.97 <= ratio <= 1.03 and w < 900:
        raise ValueError(f"suspicious square image ({w}x{h}) — likely QR/spec art")
    return w, h


def download_live(name: str) -> bytes:
    data = fetch_bytes(f"{SITE}/v/vspfiles/photos/{name}")
    if len(data) < 5000 or data[:3] == b"GIF":
        raise ValueError(f"bad live asset {name}")
    return data


def save_stock(url: str, dest: Path) -> None:
    raw = fetch_bytes(url)
    jpeg = to_jpeg(raw)
    w, h = validate_jpeg(jpeg)
    dest.write_bytes(jpeg)
    print(f"  -> {dest.name} ({w}x{h}, {len(jpeg)} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    PHOTOS.mkdir(parents=True, exist_ok=True)
    targets = sorted(STOCK_SOURCES)
    ok = 0
    fail: list[str] = []

    for target in targets:
        dest = PHOTOS / target
        if dest.is_file() and not args.force:
            try:
                validate_jpeg(dest.read_bytes())
                print(f"skip {target}")
                ok += 1
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"replace bad {target}: {exc}")

        saved = False
        url = STOCK_SOURCES[target]
        try:
            print(f"fetch {target} from {url}")
            save_stock(url, dest)
            ok += 1
            saved = True
        except Exception as exc:  # noqa: BLE001
            print(f"  source failed: {exc}")

        if saved:
            continue

        for src in LIVE_FALLBACK.get(target, []):
            try:
                raw = download_live(src)
                jpeg = to_jpeg(raw)
                validate_jpeg(jpeg)
                dest.write_bytes(jpeg)
                print(f"  live fallback {src} -> {target}")
                ok += 1
                saved = True
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  live {src}: {exc}")

        if not saved:
            fail.append(target)

    print(f"\nDone: {ok}/{len(targets)} ok")
    if fail:
        print("Failed:", ", ".join(fail))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
