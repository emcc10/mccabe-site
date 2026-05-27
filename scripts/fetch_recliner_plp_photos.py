#!/usr/bin/env python3
"""Fetch all Palliser recliner PLP photos — front-angle only, color-varied per style."""
from __future__ import annotations

import argparse
import io
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

from fetch_missing_palliser_stock_photos import (  # noqa: E402
    MIN_BYTES,
    MIN_H,
    MIN_W,
    SITE,
    SOS,
    save_stock,
    strip_grey_mat,
    to_jpeg,
    validate_jpeg,
)
from replace_plp_photo_mats import replace_mat_background  # noqa: E402

FD = (
    "https://images.furnituredealer.net/b/p/a1e18853-5f6b-4575-b42b-6c376b416583/assets"
)
DENALI_GREY = f"{FD}/f5c591a3e91242808969e874dbc9d5a2.jpg"
THEA_M2 = f"{FD}/fa3bca52c55245cbacdcb6ebe7b1f431.jpg"
KINSLEY = "https://cdn.knorrweb.com/palliser/3a42b61803c86aa08fe2752276a994c9.webp"
ZG5 = (
    "https://dowfurniture.com/cdn/shop/products/"
    "Palliser_2022-10-21T20_12_04.850936_gjilcrurxc_1200x1194.jpg"
)

# Curated front/3-4 studio shots — different color per SKU within each style number.
RECLINER_SOURCES: dict[str, str] = {
    # Theo 42002 (7) — grey, blue, cream
    "42002-32-1.jpg": f"{SOS}/245773.original.jpg",
    "42002-33-1.jpg": f"{SOS}/167629.original.jpg",
    "42002-34-1.jpg": f"{SOS}/167766.original.jpg",
    "42002-35-1.jpg": f"{SOS}/167631.original.jpg",
    "42002-39-1.jpg": f"{SOS}/245775.original.jpg",
    "42002-31-1.jpg": f"{SOS}/245774.original.jpg",
    "42002-38-1.jpg": f"{SOS}/244360.original.jpg",
    # Pinecrest 42306 (7) — grey leather, dark grey, black, fabric
    "42306-32-1.jpg": f"{SOS}/88658.original.jpg",
    "42306-33-1.jpg": f"{SOS}/88353.original.jpg",
    "42306-34-1.jpg": f"{SOS}/245799.original.jpg",
    "42306-35-1.jpg": f"{SOS}/245821.original.jpg",
    "42306-31-1.jpg": f"{SOS}/58202.original.jpg",
    "42306-39-1.jpg": f"{SOS}/245855.original.jpg",
    "42306-38-1.jpg": f"{SOS}/58202.original.jpg",
    # Denali 43003 (7) — cream, black, teal, grey leather
    "43003-31-1.jpg": f"{SOS}/44505.original.jpg",
    "43003-32-1.jpg": f"{SOS}/245802.original.jpg",
    "43003-33-1.jpg": f"{SOS}/88687.original.jpg",
    "43003-34-1.jpg": DENALI_GREY,
    "43003-35-1.jpg": f"{SOS}/88687.original.jpg",
    "43003-38-1.jpg": f"{SOS}/245802.original.jpg",
    "43003-39-1.jpg": f"{SOS}/44505.original.jpg",
    # Tundra 41043 (4) — brown, tan, grey
    "41043-32-1.jpg": f"{SOS}/88429.original.jpg",
    "41043-33-1.jpg": f"{SOS}/88919.original.jpg",
    "41043-35-1.jpg": f"{SOS}/264468.original.png",
    "41043-39-1.jpg": f"{SOS}/88429.original.jpg",
    # Oakwood 41049 (4)
    "41049-32-1.jpg": f"{SOS}/88429.original.jpg",
    "41049-33-1.jpg": f"{SOS}/264560.original.jpg",
    "41049-35-1.jpg": f"{SOS}/88919.original.jpg",
    "41049-39-1.jpg": f"{SOS}/88433.original.jpg",
    # Regent 41094 (4)
    "41094-32-1.jpg": f"{SOS}/88429.original.jpg",
    "41094-33-1.jpg": f"{SOS}/88433.original.jpg",
    "41094-35-1.jpg": f"{SOS}/88919.original.jpg",
    "41094-39-1.jpg": f"{SOS}/88429.original.jpg",
    # Henry, ZG5, gliders, Thea
    "41051-35-1.jpg": f"{SOS}/244228.original.jpg",
    "41089-42-1.jpg": ZG5,
    "77111-G3-1.jpg": KINSLEY,
    "77108-G3-1.jpg": f"{SOS}/214614.original.jpg",
    "77115-G3-1.jpg": f"{SOS}/215568.original.jpg",
    "77119-J2-1.jpg": f"{SITE}/v/vspfiles/photos/77119-N2-2T.jpg",
    "77119-M2-1.jpg": THEA_M2,
    "77119-N2-1.jpg": f"{SITE}/v/vspfiles/photos/77119-N2-1.jpg",
}


def save_recliner(url: str, dest: Path) -> None:
    save_stock(url, dest)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    PHOTOS.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail: list[str] = []

    for target in sorted(RECLINER_SOURCES):
        dest = PHOTOS / target
        if dest.is_file() and not args.force:
            try:
                validate_jpeg(dest.read_bytes())
                print(f"skip {target}")
                ok += 1
                continue
            except Exception as exc:  # noqa: BLE001
                print(f"replace bad {target}: {exc}")

        url = RECLINER_SOURCES[target]
        try:
            print(f"fetch {target} <- {url.split('/')[-1]}")
            save_recliner(url, dest)
            ok += 1
        except Exception as exc:  # noqa: BLE001
            print(f"  FAILED: {exc}")
            fail.append(target)

    print(f"\nDone: {ok}/{len(RECLINER_SOURCES)} ok")
    if fail:
        print("Failed:", ", ".join(fail))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
