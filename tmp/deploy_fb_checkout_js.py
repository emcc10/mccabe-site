#!/usr/bin/env python3
"""Upload mc-facebook-checkout.js and bump its template cache-bust tag.

Uploads the JS to both Volusion path aliases, then rewrites
mc-facebook-checkout.js?v=OLD -> ?v=NEW in the two template files that
load it so Cloudflare is forced to fetch the new bytes.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "vspfiles" / "js" / "mc-facebook-checkout.js"
REMOTES = (
    "vspfiles/js/mc-facebook-checkout.js",
    "/v/vspfiles/js/mc-facebook-checkout.js",
)
OLD = b"mc-facebook-checkout.js?v=20260730fb14"
NEW = b"mc-facebook-checkout.js?v=20260801fb15"
TEMPLATES = ("template_266.html", "vspfiles/templates/266/header_static.html")


def main() -> int:
    host = os.environ.get("FTP_SERVER") or os.environ.get("SFTP_HOST")
    user = os.environ.get("FTP_USERNAME") or os.environ.get("SFTP_USER")
    password = os.environ.get("FTP_PASSWORD") or os.environ.get("SFTP_PASS")
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
                ok = uploaded == size
                print(f"PUT {'OK' if ok else 'SIZE MISMATCH'}: {remote}", flush=True)
                if not ok:
                    failures += 1
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"PUT FAILED: {remote}: {exc}", flush=True)

        for remote in TEMPLATES:
            try:
                with sftp.open(remote, "rb") as handle:
                    handle.prefetch()
                    data = handle.read()
                count = data.count(OLD)
                print(f"{remote}: {len(data)} bytes, old-tag={count}", flush=True)
                if count == 0:
                    # Already bumped or different tag — report current tag.
                    import re

                    found = re.findall(rb"mc-facebook-checkout\.js\?v=[0-9a-z]+", data)
                    print(f"  current tags: {sorted(set(found))}", flush=True)
                    continue
                backup = f"{remote}.bak-fb15"
                with sftp.open(backup, "wb") as handle:
                    handle.write(data)
                patched = data.replace(OLD, NEW)
                with sftp.open(remote, "wb") as handle:
                    handle.write(patched)
                with sftp.open(remote, "rb") as handle:
                    handle.prefetch()
                    verify = handle.read()
                ok = verify.count(NEW) == count and verify.count(OLD) == 0
                print(f"  {'OK' if ok else 'VERIFY FAILED'} {remote}", flush=True)
                if not ok:
                    failures += 1
            except Exception as exc:  # noqa: BLE001
                failures += 1
                print(f"TEMPLATE FAILED: {remote}: {exc}", flush=True)
    finally:
        sftp.close()
        transport.close()

    print("DONE" if not failures else f"DONE with {failures} failure(s)", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
