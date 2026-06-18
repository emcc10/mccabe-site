#!/usr/bin/env python3
"""Upload Steve Silver mirror PLP/PDP photos to Volusion SFTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
CODES = (
    "SS-BC900MR",
    "SS-BC950MRB",
    "SS-CAS900M",
    "SS-HP900MRD",
    "SS-HP900MRW",
    "SS-RV900M",
)
SUFFIXES = ("-1.jpg", "-1T.jpg", "-2.jpg", "-2T.jpg")


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    sys.path.insert(0, str(ROOT / "scripts"))
    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    targets = [f"{code}{suffix}" for code in CODES for suffix in SUFFIXES]
    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    transport = connect_paramiko_transport(host, port, user, password)
    fail = 0
    ok = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for name in targets:
                local = str(PHOTOS / name)
                if not os.path.isfile(local):
                    print(f"MISSING {name}", file=sys.stderr)
                    fail += 1
                    continue
                if not _upload_one(sftp, local, _photo_remotes(name)):
                    fail += 1
                else:
                    ok += 1
                    print(f"OK {name}")
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(targets)} mirror photo(s)")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
