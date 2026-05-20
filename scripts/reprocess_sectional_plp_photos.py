#!/usr/bin/env python3
"""Re-fetch large sectional sources (-2T), de-mat, normalize to PLP -1.jpg (sofa-matched size)."""
from __future__ import annotations

import subprocess
import sys
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe sectional PLP)"}


def sectional_names() -> list[str]:
    return sorted(
        p.name
        for p in PHOTOS.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        and ("-sc-" in p.name.lower() or p.name.lower().startswith("sc-"))
    )


def large_source_urls(plp_name: str) -> list[str]:
    stem = plp_name.rsplit(".", 1)[0]
    base = stem[:-2] if stem.lower().endswith("-1") else stem
    variants = [
        f"{base}-2T.jpg",
        f"{base.upper()}-2T.jpg",
        f"{base.lower()}-2t.jpg",
        plp_name,
        plp_name.lower(),
    ]
    seen: set[str] = set()
    urls: list[str] = []
    for v in variants:
        if v in seen:
            continue
        seen.add(v)
        urls.append(f"{SITE}/v/vspfiles/photos/{v}")
    return urls


def fetch_large_original(plp_name: str) -> bytes:
    for url in large_source_urls(plp_name):
        try:
            req = urllib.request.Request(url, headers=UA)
            data = urllib.request.urlopen(req, timeout=90).read()
            im = Image.open(BytesIO(data))
            if im.size[0] >= 500 or im.size[1] >= 400:
                print(f"  source {url.split('/')[-1]} ({im.size[0]}x{im.size[1]}, {len(data)} bytes)")
                return data
        except (urllib.error.HTTPError, OSError, ValueError):
            continue
    raise RuntimeError(f"no large source for {plp_name}")


def write_plp_aliases(plp_name: str, data: bytes) -> None:
    dest = PHOTOS / plp_name
    dest.write_bytes(data)
    for alias in {plp_name.lower(), plp_name[:1].upper() + plp_name[1:]}:
        path = PHOTOS / alias
        if path != dest:
            path.write_bytes(data)


def main() -> int:
    py = sys.executable
    names = sectional_names()
    if not names:
        print("No sectional photos in vspfiles/photos", file=sys.stderr)
        return 1
    print(f"Reprocessing {len(names)} sectional PLP photo(s)...")

    for name in names:
        try:
            raw = fetch_large_original(name)
        except RuntimeError as exc:
            print(f"  WARN {exc}", file=sys.stderr)
            continue
        write_plp_aliases(name, raw)

    for name in names:
        subprocess.run(
            [
                py,
                str(ROOT / "scripts" / "replace_plp_photo_mats.py"),
                "--file",
                name,
                "--out-dir",
                str(PHOTOS),
            ],
            cwd=ROOT,
            check=False,
        )

    rc = 0
    for name in names:
        step = subprocess.run(
            [
                py,
                str(ROOT / "scripts" / "normalize_plp_photos.py"),
                "--input-dir",
                str(PHOTOS),
                "--in-place",
                "--file",
                name,
            ],
            cwd=ROOT,
        )
        if step.returncode != 0:
            rc = step.returncode
    if rc != 0:
        return rc

    return subprocess.run(
        [py, str(ROOT / "scripts" / "generate_plp_sofa_bounds.py")],
        cwd=ROOT,
        check=False,
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
