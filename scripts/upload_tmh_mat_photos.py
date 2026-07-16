#!/usr/bin/env python3
"""Upload TMH -1.jpg and -2T.jpg files to Volusion SFTP.

Volusion PDPs use {ProductCode}-2T.jpg as #product_photo for Mahjong House,
so both -1 and -2T must be full-size (>=650px wide), never 320px thumbs.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
MIN_WIDTH = 650
sys.path.insert(0, str(ROOT / "scripts"))


def targets() -> list[str]:
    names: set[str] = set()
    for path in PHOTOS.glob("TMH-*-1.jpg"):
        code = path.name[:-6]
        names.add(f"{code}-1.jpg")
        for suf in ("-2T.jpg", "-1T.jpg"):
            thumb = PHOTOS / f"{code}{suf}"
            if thumb.is_file():
                names.add(f"{code}{suf}")
    return sorted(names)


def assert_min_width(path: Path) -> tuple[int, int]:
    try:
        from PIL import Image
    except ImportError as exc:
        raise SystemExit("Pillow required: pip install Pillow") from exc

    with Image.open(path) as im:
        w, h = im.size
    if w < MIN_WIDTH:
        raise ValueError(f"{path.name} is {w}px wide (min {MIN_WIDTH})")
    return w, h


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    files = targets()
    if not files:
        print("No TMH photos found", file=sys.stderr)
        return 1

    for name in files:
        assert_min_width(PHOTOS / name)

    transport = connect_paramiko_transport(
        os.environ["FTP_SERVER"],
        int(os.environ.get("SFTP_PORT", "2222")),
        os.environ["FTP_USERNAME"],
        os.environ["FTP_PASSWORD"],
    )
    ok = 0
    fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for name in files:
                local = str(PHOTOS / name)
                size = os.path.getsize(local)
                if _upload_one(sftp, local, _photo_remotes(name)):
                    print(f"OK {name} ({size} bytes)")
                    ok += 1
                else:
                    print(f"FAIL {name}", file=sys.stderr)
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(files)} TMH photo(s); failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
