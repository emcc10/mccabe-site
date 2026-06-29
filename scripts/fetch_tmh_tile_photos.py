#!/usr/bin/env python3
"""Download TMH tile product photos from Mahjong House Shopify into vspfiles/photos/."""
from __future__ import annotations

import io
import json
import shutil
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow required: pip install Pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "vspfiles" / "photos"
TMP = ROOT / "tmp" / "tmh-tile-downloads"
MAIN_MAX = 1946

# Volusion ProductCode -> official Shopify CDN image
TILE_PRODUCTS: dict[str, str] = {
    "TMH-TILE-BLUE-ISLAND-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandBlueTiles.jpg?v=1772600523"
    ),
    "TMH-TILE-CLASSIC-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "ClassicWhiteTiles.jpg?v=1772600513"
    ),
    "TMH-TILE-GREEN-ISLAND-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandGreenTiles.jpg?v=1772600318"
    ),
    "TMH-TILE-PINK-ISLAND-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandPinkTiles.jpg?v=1772600335"
    ),
    "TMH-TILE-ROYAL-BLU-ISLAND": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandRoyalBlueTiles_b9890a8a-50da-4728-be11-4cd1475a6677.jpg?v=1772600493"
    ),
    "TMH-TILE-SALMON-ISLAND-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandSalmonTiles2.jpg?v=1772600483"
    ),
    "TMH-TILE-WHITE-ISLAND-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "IslandWhiteTiles.jpg?v=1772600068"
    ),
    "TMH-TILE-TORTOISE-CREAM": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "Tortoise_CreamModTiles_3.jpg?v=1773428030"
    ),
    "TMH-TILE-HOT-PINK-TEXAS-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasHotPinkTiles.jpg?v=1772600502"
    ),
    "TMH-TILE-OLIVE-TEXAS-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasOliveTiles.jpg?v=1772600459"
    ),
    "TMH-TILE-PINK-TEXAS-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasPinkTiles.jpg?v=1772600438"
    ),
    "TMH-TILE-ROYAL-BLU-TEXAS": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasRoyalBlueTiles.jpg?v=1772600448"
    ),
    "TMH-TILE-TURQUOISE-TEXAS-TILES": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TexasTurquoiseTiles_d8be67a4-493f-4489-9282-1b551414ca70.jpg?v=1772600470"
    ),
    "TMH-TILE-BLU-WHT-HOUSE": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "Blue_WhiteHouseTiles_3.jpg?v=1773438238"
    ),
    "TMH-TILE-BRIGHTS-ELEC-BLU": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TheBrights_ElectricBlueHouseTiles_2.jpg?v=1773427805"
    ),
    "TMH-TILE-BRIGHTS-LILAC": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TheBrights_LilacHouseMahjongTiles_2.jpg?v=1773427818"
    ),
    "TMH-TILE-BRIGHTS-PLUM": (
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/"
        "TheBrights_PlumHouseTiles_3.jpg?v=1773427867"
    ),
}


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def save_main(data: bytes, dest: Path) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as im:
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > MAIN_MAX:
            im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=93, optimize=True)
        return im.size


def write_product(code: str, url: str) -> tuple[int, int]:
    TMP.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    raw = TMP / f"{code}-raw"
    main_dest = DEST / f"{code}-1.jpg"
    thumb_dest = DEST / f"{code}-2T.jpg"
    data = download(url)
    raw.write_bytes(data)
    size = save_main(data, main_dest)
    shutil.copy2(main_dest, thumb_dest)
    return size


def main() -> int:
    ok: list[str] = []
    fail: list[str] = []
    for code, url in sorted(TILE_PRODUCTS.items()):
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
    out = ROOT / "tmp" / "tmh-tile-photos-manifest.json"
    out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(ok)} tile product(s), {len(ok) * 2} files; failed {len(fail)}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
