#!/usr/bin/env python3
"""Upload ONLY TMH PLP thumbnail files (-1.jpg and -1T.jpg). Never uploads -2T or other assets."""
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
        names.add(path.name)
        t = PHOTOS / f"{path.name[:-6]}-1T.jpg"
        if t.is_file():
            names.add(t.name)
    return sorted(names)


def assert_min_width(path: Path) -> None:
    from PIL import Image

    with Image.open(path) as im:
        w, _h = im.size
    if w < MIN_WIDTH:
        raise ValueError(f"{path.name} is {w}px wide (min {MIN_WIDTH})")


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
        print("No TMH -1 thumbnails found", file=sys.stderr)
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
                if _upload_one(sftp, local, _photo_remotes(name)):
                    print(f"OK {name} ({os.path.getsize(local)} bytes)")
                    ok += 1
                else:
                    print(f"FAIL {name}", file=sys.stderr)
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(files)} TMH thumbnail(s) only; failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
