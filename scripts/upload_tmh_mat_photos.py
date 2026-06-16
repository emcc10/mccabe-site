#!/usr/bin/env python3
"""Upload TMH mahjong mat -1.jpg and -2T.jpg files to Volusion SFTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
sys.path.insert(0, str(ROOT / "scripts"))


def targets() -> list[str]:
    names: set[str] = set()
    for pattern in ("TMH-MAT-*-1.jpg", "TMH-TRV-*-1.jpg"):
        for path in PHOTOS.glob(pattern):
            code = path.name[:-6]
            names.add(f"{code}-1.jpg")
            thumb = PHOTOS / f"{code}-2T.jpg"
            if thumb.is_file():
                names.add(f"{code}-2T.jpg")
    return sorted(names)


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
        print("No TMH-MAT photos found", file=sys.stderr)
        return 1

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

    print(f"Uploaded {ok}/{len(files)} TMH mat/travel photo(s); failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
