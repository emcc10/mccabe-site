#!/usr/bin/env python3
"""Upload all Palliser recliner PLP photos to Volusion SFTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from fetch_recliner_plp_photos import RECLINER_SOURCES  # noqa: E402

PHOTOS = ROOT / "vspfiles" / "photos"
TARGETS = sorted(RECLINER_SOURCES)


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
    print(f"Uploaded {len(TARGETS)} recliner photo(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
