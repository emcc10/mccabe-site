#!/usr/bin/env python3
"""Create TMH-TRV-* Volusion photo files from TMH-MAT-* sources.

Travel mahjong mats use ProductCode TMH-TRV-* on Volusion but mat art was
committed as TMH-MAT-* (and *-TRAVEL-MAT for two SKUs). Copy -1.jpg and -2T.jpg
so SFTP uploads match live product codes.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"

# Volusion travel mat ProductCode -> repo TMH-MAT photo stem
TRV_TO_MAT: dict[str, str] = {
    "TMH-TRV-AMETHYST-GEM-MAT": "TMH-MAT-AMETHYST-GEM-TRAVEL-MAT",
    "TMH-TRV-AMETHYST-TABLE-MAT": "TMH-MAT-AMETHYST-TABLE-TRAVEL-MAT",
    "TMH-TRV-BLUE-MAT": "TMH-MAT-BLUE-MAT",
    "TMH-TRV-ELEC-BLU-GARDEN": "TMH-MAT-ELEC-BLU-GARDEN",
    "TMH-TRV-ELEC-BLU-TRELLIS": "TMH-MAT-ELEC-BLU-TRELLIS",
    "TMH-TRV-EMERALD-GEM-MAT": "TMH-MAT-EMERALD-GEM-MAT",
    "TMH-TRV-EMERALD-TABLE-MAT": "TMH-MAT-EMERALD-TABLE-MAT",
    "TMH-TRV-LILAC-GARDEN-MAT": "TMH-MAT-LILAC-GARDEN-MAT",
    "TMH-TRV-LILAC-TRELLIS-MAT": "TMH-MAT-LILAC-TRELLIS-MAT",
    "TMH-TRV-PLUM-GARDEN-MAT": "TMH-MAT-PLUM-GARDEN-MAT",
    "TMH-TRV-PLUM-TRELLIS-MAT": "TMH-MAT-PLUM-TRELLIS-MAT",
    "TMH-TRV-PURP-RED-GRN": "TMH-MAT-DECO-OLIVE-AND-RED-MAT",
    "TMH-TRV-RUBY-GEM-MAT": "TMH-MAT-RUBY-GEM-MAT",
    "TMH-TRV-RUBY-TABLE-MAT": "TMH-MAT-RUBY-TABLE-MAT",
    "TMH-TRV-SAPPHIRE-GEM-MAT": "TMH-MAT-SAPPHIRE-GEM-MAT",
    "TMH-TRV-SAPPHIRE-TABLE-MAT": "TMH-MAT-SAPPHIRE-TABLE-MAT",
    "TMH-TRV-TEAL-GARDEN-MAT": "TMH-MAT-TEAL-GARDEN-MAT",
    "TMH-TRV-TEAL-TRELLIS-MAT": "TMH-MAT-TEAL-TRELLIS-MAT",
}


def sync_one(trv_code: str, mat_code: str) -> bool:
    ok = True
    for suffix in ("-1.jpg", "-2T.jpg"):
        src = PHOTOS / f"{mat_code}{suffix}"
        dest = PHOTOS / f"{trv_code}{suffix}"
        if not src.is_file():
            print(f"MISSING source {src.name} for {trv_code}", file=sys.stderr)
            ok = False
            continue
        shutil.copy2(src, dest)
        print(f"OK {dest.name} <- {src.name}")
    return ok


def main() -> int:
    PHOTOS.mkdir(parents=True, exist_ok=True)
    fail = 0
    for trv, mat in sorted(TRV_TO_MAT.items()):
        if not sync_one(trv, mat):
            fail += 1
    print(f"Synced {len(TRV_TO_MAT) - fail}/{len(TRV_TO_MAT)} travel mat photo pair(s)")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
