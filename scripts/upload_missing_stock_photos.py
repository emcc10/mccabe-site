#!/usr/bin/env python3
"""Upload only the 40 missing-stock PLP photos to Volusion SFTP.

Requires env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD (optional SFTP_PORT, default 2222).

Usage:
  py -3 scripts/upload_missing_stock_photos.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"

TARGETS = """
77176-A4-1.jpg 77176-AE-1.jpg 77176-AS-1.jpg
77651-01-1.jpg 77651-A1-1.jpg 77651-D1-1.jpg
77656-01-1.jpg 77656-A1-1.jpg 77656-D1-1.jpg
77658-01-1.jpg 77658-A1-1.jpg 77658-D1-1.jpg
77743-01-1.jpg 77743-A1-1.jpg 77743-D1-1.jpg
77752-01-1.jpg 77752-A1-1.jpg 77752-D1-1.jpg
77768-91-1.jpg
43003-38-1.jpg 43003-33-1.jpg 77111-G3-1.jpg
42306-31-1.jpg 42306-32-1.jpg 42306-34-1.jpg 42306-33-1.jpg 42306-35-1.jpg
41094-39-1.jpg 41094-32-1.jpg 41094-35-1.jpg
77119-J2-1.jpg 77119-M2-1.jpg
42002-39-1.jpg 42002-32-1.jpg 42002-34-1.jpg 42002-33-1.jpg 42002-35-1.jpg
41043-39-1.jpg 41043-35-1.jpg 41089-42-1.jpg
""".split()


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    transport = connect_paramiko_transport(host, port, user, password)
    fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for name in TARGETS:
                local = str(PHOTOS / name)
                if not os.path.isfile(local):
                    print(f"MISSING local {name}", file=sys.stderr)
                    fail += 1
                    continue
                if not _upload_one(sftp, local, _photo_remotes(name)):
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    if fail:
        print(f"Failed {fail}/{len(TARGETS)}", file=sys.stderr)
        return 1
    print(f"Uploaded {len(TARGETS)} stock photo(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
