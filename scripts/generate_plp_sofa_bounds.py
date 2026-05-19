#!/usr/bin/env python3
"""Precompute visible sofa bounds for PLP photos (non-white / non-transparent pixels)."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
OUT = ROOT / "vspfiles" / "js" / "mc-plp-sofa-bounds.json"
SITE = "https://www.mccabestheaterandliving.com"
PHOTO_RE = re.compile(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP bounds)"}


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return True
    if r > 235 and g > 235 and b > 235:
        return True
    hi = max(r, g, b)
    lo = min(r, g, b)
    if hi - lo < 18 and hi > 192:
        return True
    return False


def bounds_for_image(img: Image.Image) -> dict | None:
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                continue
            found = True
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if not found:
        return None
    return {
        "visibleW": max_x - min_x + 1,
        "visibleH": max_y - min_y + 1,
        "minX": min_x,
        "minY": min_y,
        "maxX": max_x + 1,
        "maxY": max_y + 1,
        "nw": w,
        "nh": h,
    }


def bounds_for(path: Path) -> dict | None:
    return bounds_for_image(Image.open(path))


def fetch_category_photos(category_path: str) -> list[str]:
    url = SITE + category_path
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        html = resp.read().decode("utf-8", "replace")
    names = sorted(
        {
            m.group(1).lower()
            for m in PHOTO_RE.finditer(html)
            if "{" not in m.group(1) and "}" not in m.group(1)
        }
    )
    PHOTOS.mkdir(parents=True, exist_ok=True)
    for name in names:
        dest = PHOTOS / name
        if dest.exists() and dest.stat().st_size > 0:
            continue
        photo_url = f"{SITE}/v/vspfiles/photos/{name}"
        try:
            req2 = urllib.request.Request(photo_url, headers=UA)
            with urllib.request.urlopen(req2, timeout=60) as resp2:
                dest.write_bytes(resp2.read())
            print(f"Fetched {name}", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001
            print(f"Skip {name}: {exc}", file=sys.stderr)
    return names


def bounds_from_url(name: str) -> dict | None:
    url = f"{SITE}/v/vspfiles/photos/{name}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    return bounds_for_image(Image.open(BytesIO(data)))


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="/category-s/177.htm")
    args = parser.parse_args()

    names = fetch_category_photos(args.category)
    out: dict[str, dict] = {}
    seen: set[str] = set()

    for name in names:
        seen.add(name)
        path = PHOTOS / name
        b = bounds_for(path) if path.exists() else None
        if not b and path.exists() is False:
            try:
                b = bounds_from_url(name)
            except Exception as exc:  # noqa: BLE001
                print(f"Skip bounds {name}: {exc}", file=sys.stderr)
                b = None
        if b:
            out[name] = b

    for path in sorted(PHOTOS.glob("*")):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        key = path.name.lower()
        if key in seen:
            continue
        b = bounds_for(path)
        if b:
            out[key] = b

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(out)} bounds → {OUT}", file=sys.stderr)
    ref = out.get("77494-91-1.jpg")
    print(f"Juno Apartment ref: {ref}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
