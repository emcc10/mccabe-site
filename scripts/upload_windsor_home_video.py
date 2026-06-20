#!/usr/bin/env python3
"""Upload homepage Windsor hero MP4 to Volusion SFTP (/v/vspfiles/)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = (
    "vspfiles/windsor-home.mp4",
    "vspfiles/windsor.mp4",
)


def _load_dotenv() -> None:
    for name in (".env.local", ".env"):
        path = ROOT / name
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)


def main() -> int:
    os.chdir(ROOT)
    _load_dotenv()

    host = (
        os.environ.get("FTP_SERVER", "").strip()
        or os.environ.get("SFTP_HOST", "").strip()
    )
    user = (
        os.environ.get("FTP_USERNAME", "").strip()
        or os.environ.get("SFTP_USER", "").strip()
    )
    password = (
        os.environ.get("FTP_PASSWORD", "").strip()
        or os.environ.get("SFTP_PASS", "").strip()
    )
    if not host or not user or not password:
        print("Missing FTP_SERVER / FTP_USERNAME / FTP_PASSWORD in env", file=sys.stderr)
        return 2

    sys.path.insert(0, str(ROOT / "scripts"))
    from deploy_volusion_assets import _remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    port = int(os.environ.get("SFTP_PORT", "2222"))
    fail = 0
    ok = 0
    transport = connect_paramiko_transport(host, port, user, password)
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for rel in TARGETS:
                local = str(ROOT / rel)
                if not os.path.isfile(local):
                    print(f"SKIP missing {rel}", file=sys.stderr)
                    fail += 1
                    continue
                size = os.path.getsize(local)
                print(f"Uploading {rel} ({size} bytes) …")
                if _upload_one(sftp, local, _remotes(rel)):
                    ok += 1
                    print(f"OK {rel}")
                else:
                    fail += 1
                    print(f"FAIL {rel}", file=sys.stderr)
        finally:
            sftp.close()
    finally:
        transport.close()

    if fail:
        print(f"{fail} upload(s) failed", file=sys.stderr)
        return 1
    print(f"Uploaded {ok} Windsor hero video file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
