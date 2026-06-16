"""Download TMH accessory images from Shopify and write Volusion photo names."""
from __future__ import annotations

import json
import re
import shutil
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site")
DEST = ROOT / "vspfiles" / "photos"
JSON_PATH = ROOT / "tmp" / "accessories-products.json"
THUMB_MAX = 220

# Shopify title (normalized) -> Volusion ProductCode (verified on mccabestheaterandliving.com)
TITLE_TO_CODE: dict[str, str] = {
    "rattan tile box": "TMH-ACC-RATTAN-TILE-BOX",
    "purple & tan raffia mahjong bag": "TMH-ACC-PURP-TAN-RAFFIA",
    "white & tan raffia mahjong bag": "TMH-ACC-WHT-TAN-RAFFIA",
    "canvas carry-all tote, pink": "TMH-ACC-CARRYALL-PINK",
    "canvas carry-all tote, red": "TMH-ACC-CARRYALL-RED",
    "canvas zipper rectangular tile bag": "TMH-ACC-ZIP-RECT-TILE-BAG",
    "canvas zipper square tile bag": "TMH-ACC-ZIP-SQ-TILE-BAG",
}


def norm_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().lower())


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def save_main(src: Path, main_dest: Path) -> None:
    if Image is None:
        shutil.copy2(src, main_dest)
        return
    with Image.open(src) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(main_dest, "JPEG", quality=92, optimize=True)


def make_thumb(main_dest: Path, thumb_dest: Path) -> None:
    if Image is None:
        shutil.copy2(main_dest, thumb_dest)
        return
    with Image.open(main_dest) as im:
        im = im.convert("RGB") if im.mode not in ("RGB", "L") else im
        im.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)
        im.save(thumb_dest, "JPEG", quality=85, optimize=True)


def main() -> int:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    tmp = ROOT / "tmp" / "acc-downloads"
    tmp.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)

    written = []
    missing = []
    for product in data.get("products", []):
        title = norm_title(product.get("title", ""))
        code = TITLE_TO_CODE.get(title)
        images = product.get("images") or []
        if not code:
            missing.append(product.get("title", "?"))
            continue
        if not images:
            missing.append(f"{product.get('title')} (no image)")
            continue

        url = images[0]["src"]
        raw = tmp / f"{code}-raw.jpg"
        main_dest = DEST / f"{code}-1.jpg"
        thumb_dest = DEST / f"{code}-2T.jpg"
        print(f"Downloading {code} ({product['title']})...")
        download(url, raw)
        save_main(raw, main_dest)
        make_thumb(main_dest, thumb_dest)
        written.append(code)

    print(f"\nWrote {len(written)} accessory products ({len(written) * 2} files)")
    for code in written:
        print(f"  {code}")

    if missing:
        print("\nUnmapped or missing:")
        for item in missing:
            print(f"  - {item}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
