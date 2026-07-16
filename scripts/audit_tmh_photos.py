#!/usr/bin/env python3
"""Audit TMH photo status: local repo vs live CDN (presence + min width)."""
from __future__ import annotations

import io
import json
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow required: pip install Pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
CDN = "https://www.mccabestheaterandliving.com/v/vspfiles/photos"
MIN_WIDTH = 650
UA = {"User-Agent": "Mozilla/5.0"}


def probe_size(url: str) -> tuple[int | None, int | None, int]:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        im = Image.open(io.BytesIO(data))
        return im.size[0], im.size[1], len(data)
    except Exception:
        return None, None, 0


def main() -> int:
    codes: set[str] = set()
    for path in PHOTOS.glob("TMH-*-1.jpg"):
        codes.add(path.name[:-6])

    rows = []
    under_live: list[dict] = []
    for code in sorted(codes):
        local_main = PHOTOS / f"{code}-1.jpg"
        local_2t = PHOTOS / f"{code}-2T.jpg"
        row: dict = {
            "code": code,
            "local_1": local_main.is_file(),
            "local_2t": local_2t.is_file(),
            "local_1_bytes": local_main.stat().st_size if local_main.is_file() else 0,
            "local_2t_bytes": local_2t.stat().st_size if local_2t.is_file() else 0,
        }
        if local_main.is_file():
            with Image.open(local_main) as im:
                row["local_1_w"] = im.size[0]
        if local_2t.is_file():
            with Image.open(local_2t) as im:
                row["local_2t_w"] = im.size[0]

        for suf in ("-1.jpg", "-2T.jpg"):
            w, h, nbytes = probe_size(f"{CDN}/{code}{suf}?v=audit")
            row[f"live{suf}_w"] = w
            row[f"live{suf}_h"] = h
            row[f"live{suf}_bytes"] = nbytes
            if w is not None and w < MIN_WIDTH:
                under_live.append(
                    {"file": f"{code}{suf}", "width": w, "height": h, "bytes": nbytes}
                )

        rows.append(row)

    out = ROOT / "tmp" / "tmh-photo-audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "min_width": MIN_WIDTH,
                "total_codes": len(rows),
                "live_under_min_width": under_live,
                "live_under_count": len(under_live),
                "rows": rows,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"TMH products in repo: {len(rows)}")
    print(f"Live files under {MIN_WIDTH}px wide: {len(under_live)}")
    for item in under_live[:20]:
        print(f"  {item['file']}: {item['width']}x{item['height']}")
    if len(under_live) > 20:
        print(f"  ... and {len(under_live) - 20} more")
    print(f"Wrote {out}")
    return 1 if under_live else 0


if __name__ == "__main__":
    raise SystemExit(main())
