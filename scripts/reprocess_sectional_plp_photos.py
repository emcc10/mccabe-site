#!/usr/bin/env python3
"""Re-fetch and re-normalize sectional PLP thumbs (fill height like stationary sofas)."""
from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

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


def fetch_overwrite(name: str) -> None:
    url = f"{SITE}/v/vspfiles/photos/{name}"
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=90).read()
    (PHOTOS / name).write_bytes(data)
    print(f"  fetched {name} ({len(data)} bytes)")


def main() -> int:
    py = sys.executable
    names = sectional_names()
    if not names:
        print("No sectional photos in vspfiles/photos", file=sys.stderr)
        return 1
    print(f"Reprocessing {len(names)} sectional photo(s)...")
    for name in names:
        try:
            fetch_overwrite(name)
        except Exception as exc:  # noqa: BLE001
            print(f"  skip fetch {name}: {exc}", file=sys.stderr)

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
