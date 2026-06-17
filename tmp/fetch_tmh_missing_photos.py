#!/usr/bin/env python3
"""Fetch missing TMH/RV Volusion product photos from Mahjong House Shopify."""
from __future__ import annotations

import io
import json
import re
import shutil
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "tmh-downloads"
MAIN_MAX = 1946
THUMB_MAX = 220

# Volusion ProductCode -> Shopify image URL (wholesale or retail CDN)
PRODUCTS: dict[str, str] = {
    # Travel sets
    "TMH-TRV-ICE-BLU-BRIGHTS": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IceBlue_BrightsTravelMahjongSet_2.jpg?v=1771861050"
    ),
    "TMH-TRV-BUTTER-YELLOW-SET": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "ButterYellowTravelMahjongSet.jpg?v=1771861324"
    ),
    "TMH-TRV-PALE-VIOLET-OPRAH": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "PaleVioletTravelMahjongSet.jpg?v=1771861237"
    ),
    "TMH-TRV-WHT-JEWEL-TONES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "WhitewithJewel-TonesTravelMahjongSet.jpg?v=1771861156"
    ),
    # Island travel tile colors
    "TMH-TRV-ISLAND-BRIGHT-BLU": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandBlueTiles.jpg?v=1772600523"
    ),
    "TMH-TRV-ISLAND-ROYAL-BLU": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandRoyalBlueTiles_b9890a8a-50da-4728-be11-4cd1475a6677.jpg?v=1772600493"
    ),
    "TMH-TRV-ISLAND-TILES-GREEN": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandGreenTiles.jpg?v=1772600318"
    ),
    "TMH-TRV-ISLAND-TILES-PINK": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandPinkTiles.jpg?v=1772600335"
    ),
    "TMH-TRV-ISLAND-TILES-SALMON": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandSalmonTiles2.jpg?v=1772600483"
    ),
    # Texas travel tile colors
    "TMH-TRV-TEXAS-TILES-HOT-PINK": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasHotPinkTiles.jpg?v=1772600502"
    ),
    "TMH-TRV-TEXAS-TILES-OLIVE": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasOliveTiles.jpg?v=1772600459"
    ),
    "TMH-TRV-TEXAS-TILES-PINK": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasPinkTiles.jpg?v=1772600438"
    ),
    "TMH-TRV-TEXAS-TILES-TURQUOISE": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasTurquoiseTiles_d8be67a4-493f-4489-9282-1b551414ca70.jpg?v=1772600470"
    ),
    # Mats
    "TMH-MAT-PURP-RED-FLWR-BDR": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "Purple_RedFlowerBorderMahjongMat.jpg?v=1773433206"
    ),
    "TMH-MAT-PURP-RED-GRN": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "DecoOlive_RedDouble-SidedMahjongMat.jpg?v=1771706028"
    ),
    "TMH-MAT-BLUE-FLOWER-BORDER-MAT": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "BlueFlowerBorderMahjongMat.jpg?v=1773432647"
    ),
    # Accessories (retail Shopify CDN)
    "TMH-ACC-HOUSE-RAFFIA-CHARM": (
        "https://cdn.shopify.com/s/files/1/0711/9247/7915/files/"
        "TheMahjongHouseRaffiaBagCharm_30b97d34-4504-4ae4-9f3f-e19cb3aaf9dd.jpg?v=1770223697"
    ),
    "TMH-ACC-LG-SEAGRASS-TOTE": (
        "https://cdn.shopify.com/s/files/1/0711/9247/7915/files/"
        "LargeWovenMAHJONGSeagrassTote_343d5896-5430-49e9-a0db-96e3f844fc0c.jpg?v=1770223644"
    ),
}

# Legacy/alternate Volusion codes from admin screenshots
ALIASES: dict[str, str] = {
    "RV-TEXAS-TILES-HOT-PINK": "TMH-TRV-TEXAS-TILES-HOT-PINK",
    "RV-TEXAS-TILES-OLIVE": "TMH-TRV-TEXAS-TILES-OLIVE",
    "RV-TEXAS-TILES-PINK": "TMH-TRV-TEXAS-TILES-PINK",
    "RV-TEXAS-TILES-TURQUOISE": "TMH-TRV-TEXAS-TILES-TURQUOISE",
    "RV-WHT-JEWEL-TONES": "TMH-TRV-WHT-JEWEL-TONES",
}


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def save_main(data: bytes, dest: Path) -> tuple[int, int]:
    if Image is None:
        dest.write_bytes(data)
        return (-1, -1)
    with Image.open(io.BytesIO(data)) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > MAIN_MAX:
            im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=93, optimize=True)
        return im.size


def save_thumb(main: Path, dest: Path) -> None:
    # PDP uses -2T.jpg at full size (see refresh_mat_photos.py)
    shutil.copy2(main, dest)


def write_product(code: str, url: str) -> tuple[int, int]:
    TMP.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    raw = TMP / f"{code}-raw"
    main_dest = DEST / f"{code}-1.jpg"
    thumb_dest = DEST / f"{code}-2T.jpg"
    data = download(url)
    raw.write_bytes(data)
    size = save_main(data, main_dest)
    save_thumb(main_dest, thumb_dest)
    return size


def main() -> int:
    targets: dict[str, str] = dict(PRODUCTS)
    for alias, canonical in ALIASES.items():
        if canonical in PRODUCTS:
            targets[alias] = PRODUCTS[canonical]

    ok: list[str] = []
    fail: list[str] = []
    for code, url in sorted(targets.items()):
        try:
            size = write_product(code, url)
            print(f"OK {code} -> {size[0]}x{size[1]}")
            ok.append(code)
        except Exception as exc:
            print(f"FAIL {code}: {exc}")
            fail.append(code)

    manifest = {
        "ok": ok,
        "fail": fail,
        "files": [f"{c}-{s}.jpg" for c in ok for s in ("1", "2T")],
    }
    (ROOT / "tmp" / "tmh-missing-photos-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"\nWrote {len(ok)} product(s), {len(ok) * 2} files; failed {len(fail)}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
