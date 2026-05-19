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
sys.path.insert(0, str(ROOT / "scripts"))

from plp_sofa_bounds import detect_sofa_bounds  # noqa: E402

PHOTOS = ROOT / "vspfiles" / "photos"
OUT = ROOT / "vspfiles" / "js" / "mc-plp-sofa-bounds.json"
SITE = "https://www.mccabestheaterandliving.com"
PHOTO_RE = re.compile(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP bounds)"}


def bounds_for(path: Path) -> dict | None:
    b = detect_sofa_bounds(Image.open(path))
    return b.as_dict() if b else None


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
    b = detect_sofa_bounds(Image.open(BytesIO(data)))
    return b.as_dict() if b else None


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
        if not b and not path.exists():
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
