#!/usr/bin/env python3
"""Upload photos listed in UPLOAD_LIST_FILE to Volusion SFTP."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
sys.path.insert(0, str(ROOT / "scripts"))


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    list_file = os.environ.get("UPLOAD_LIST_FILE", "").strip()
    if not list_file:
        print("Missing UPLOAD_LIST_FILE", file=sys.stderr)
        return 2
    path = Path(list_file)
    if not path.is_file():
        path = ROOT / list_file
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or name.startswith("#"):
            continue
        if (PHOTOS / name).is_file():
            names.append(name)
        else:
            print(f"skip missing {name}", file=sys.stderr)
    if not names:
        print("No files to upload", file=sys.stderr)
        return 1

    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport
    import paramiko

    transport = connect_paramiko_transport(
        os.environ["FTP_SERVER"],
        int(os.environ.get("SFTP_PORT", "2222")),
        os.environ["FTP_USERNAME"],
        os.environ["FTP_PASSWORD"],
    )
    ok = fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for i, name in enumerate(names, 1):
                if _upload_one(sftp, str(PHOTOS / name), _photo_remotes(name)):
                    print(f"[{i}/{len(names)}] OK {name}", flush=True)
                    ok += 1
                else:
                    print(f"[{i}/{len(names)}] FAIL {name}", file=sys.stderr, flush=True)
                    fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()
    print(f"Uploaded {ok}/{len(names)}; failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
