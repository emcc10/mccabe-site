#!/usr/bin/env python3
"""Upload only mc-fb-checkout-mahjong.js to Volusion over SFTP.

Single-file on purpose: nothing else in the working copy is safe to push.
Credentials come from the environment (FTP_SERVER / FTP_USERNAME /
FTP_PASSWORD, optional SFTP_PORT).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "vspfiles" / "js" / "mc-fb-checkout-mahjong.js"
REMOTES = (
    "vspfiles/js/mc-fb-checkout-mahjong.js",
    "/v/vspfiles/js/mc-fb-checkout-mahjong.js",
)


def main() -> int:
    host = os.environ.get("FTP_SERVER")
    user = os.environ.get("FTP_USERNAME")
    password = os.environ.get("FTP_PASSWORD")
    port = int(os.environ.get("SFTP_PORT") or "2222")
    if not (host and user and password):
        print("Missing FTP_SERVER / FTP_USERNAME / FTP_PASSWORD", file=sys.stderr)
        return 1
    if not LOCAL.is_file():
        print(f"Missing local file: {LOCAL}", file=sys.stderr)
        return 1

    size = LOCAL.stat().st_size
    print(f"Local: {LOCAL.name} ({size} bytes)", flush=True)

    transport = paramiko.Transport((host, port))
    transport.banner_timeout = 90
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    failures = 0
    try:
        for remote in REMOTES:
            try:
                sftp.put(str(LOCAL), remote, confirm=True)
                uploaded = sftp.stat(remote).st_size
                if uploaded == size:
                    print(f"PUT OK: {remote}", flush=True)
                else:
                    failures += 1
                    print(f"PUT SIZE MISMATCH ({uploaded}): {remote}", flush=True)
            except Exception as exc:  # noqa: BLE001 - report and try the other path
                failures += 1
                print(f"PUT FAILED: {remote}: {exc}", flush=True)
    finally:
        sftp.close()
        transport.close()

    print("DONE" if not failures else f"DONE with {failures} failure(s)", flush=True)
    return 1 if failures == len(REMOTES) else 0


if __name__ == "__main__":
    raise SystemExit(main())
