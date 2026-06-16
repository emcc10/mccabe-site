"""Download missing TMH mat images from Shopify and write Volusion photo names."""
from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None

DEST = Path(r"c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site\vspfiles\photos")
THUMB_MAX = 220

MISSING = [
    (
        "TMH-MAT-BLU-PNK-FLWR-BDR",
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/Blue_PinkFlowerBorderMahjongMat.jpg?v=1773432515",
    ),
    (
        "TMH-MAT-BLUE-PEONY-MAT",
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/Mat-TMHPeonies-LavenderBlues.jpg?v=1769374652",
    ),
    (
        "TMH-MAT-PINK-CORNER-STARS-MAT",
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/Mat-CornerStars-PinkRed.jpg?v=1769374649",
    ),
    (
        "TMH-MAT-YELLOW-ISLAND",
        "https://cdn.shopify.com/s/files/1/0801/2762/3382/files/Mat-IslandBorder-GoldPink.jpg?v=1769374643",
    ),
]


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def save_main(src_bytes_path: Path, main_dest: Path) -> None:
    if Image is None:
        shutil.copy2(src_bytes_path, main_dest)
        return
    with Image.open(src_bytes_path) as im:
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
    DEST.mkdir(parents=True, exist_ok=True)
    tmp = DEST.parent.parent / "tmp" / "mat-downloads"
    tmp.mkdir(parents=True, exist_ok=True)

    for code, url in MISSING:
        raw = tmp / f"{code}-raw.jpg"
        main_dest = DEST / f"{code}-1.jpg"
        thumb_dest = DEST / f"{code}-2T.jpg"
        print(f"Downloading {code}...")
        download(url, raw)
        save_main(raw, main_dest)
        make_thumb(main_dest, thumb_dest)
        print(f"  -> {main_dest.name}, {thumb_dest.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
