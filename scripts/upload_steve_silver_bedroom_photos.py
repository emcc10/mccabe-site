#!/usr/bin/env python3
"""Upload Steve Silver PLP/PDP photos to Volusion SFTP.

Ensures SS-* bedroom and upholstery images reach /v/vspfiles/photos/ even when
the generic changed-files deploy misses files.

Game/dining/server import photos use upload_steve_silver_dining_photos.py.
"""
from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
PATTERNS = (
    "SS-BC*.jpg",
    "SS-CAS*.jpg",
    "SS-HP900*.jpg",
    "SS-MON*.jpg",
    "SS-RV*.jpg",
    "SS-SIG*.jpg",
    "SS-CONROE*.jpg",
    "SS-GATLIN*.jpg",
    "SS-DENVER*.jpg",
    "SS-LUNA*.jpg",
    "SS-DANIEL*.jpg",
    "SS-ZENITH*.jpg",
    "SS-ALEX*.jpg",
    "SS-OLSEN*.jpg",
    "SS-KEILY*.jpg",
    "SS-NOAH*.jpg",
    "SS-HEL*.jpg",
    "SS-GG*.jpg",
    "SS-GEORGE*.jpg",
    "SS-BS850*.jpg",
)


def collect_targets() -> list[str]:
    names: set[str] = set()
    list_file = os.environ.get("UPLOAD_LIST_FILE", "").strip()
    if list_file:
        path = Path(list_file)
        if not path.is_file():
            path = ROOT / list_file
        for line in path.read_text(encoding="utf-8").splitlines():
            name = line.strip()
            if not name or name.startswith("#"):
                continue
            if (PHOTOS / name).is_file():
                names.add(name)
        return sorted(names)

    for pat in PATTERNS:
        for path in PHOTOS.glob(pat):
            if path.is_file():
                names.add(path.name)
    return sorted(names)


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

    targets = collect_targets()
    if not targets:
        print("No Steve Silver photos found", file=sys.stderr)
        return 1

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
                if not _upload_one(sftp, local, _photo_remotes(name)):
                    fail += 1
                else:
                    ok += 1
                    print(f"OK {name}")
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(targets)} Steve Silver photo(s)")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
