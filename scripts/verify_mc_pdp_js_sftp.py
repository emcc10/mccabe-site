#!/usr/bin/env python3
"""SFTP gate: canonical /v/vspfiles/js/* must match repo (MD5 + size), like custom-safe.css."""
from __future__ import annotations

import hashlib
import os
import sys

NEEDLE = "mcEnsurePdpPriceStack"
CANONICAL = {
    "vspfiles/js/mc-pdp-auth-cta-fix.js": "/v/vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/js/mc-pdp-price-stack.js": "/v/vspfiles/js/mc-pdp-price-stack.js",
}


def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))

    host = os.environ.get("SFTP_HOST", "").strip() or os.environ.get("FTP_SERVER", "").strip()
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "") or os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("SFTP_PASS", "") or os.environ.get("FTP_PASSWORD", "")

    if not host or not user or not password:
        print("::error::Missing SFTP credentials for mc-pdp JS verify", file=sys.stderr)
        return 1

    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    try:
        transport = connect_paramiko_transport(host, port, user, password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP connect failed: {exc}", file=sys.stderr)
        return 1

    all_ok = True
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for local, remote in CANONICAL.items():
                if not os.path.isfile(local):
                    print(f"::error::Missing local {local}", file=sys.stderr)
                    all_ok = False
                    continue
                with open(local, "rb") as handle:
                    local_data = handle.read()
                if NEEDLE not in local_data.decode("utf-8", errors="replace"):
                    print(f"::error::Local {local} missing {NEEDLE}", file=sys.stderr)
                    all_ok = False
                    continue
                want_md5 = md5_hex(local_data)
                want_size = len(local_data)
                try:
                    with sftp.open(remote, "rb") as rf:
                        remote_data = rf.read()
                except OSError as exc:
                    print(
                        f"::error::SFTP cannot read {remote!r}: {exc} — "
                        "deploy did not write the HTTP-served path",
                        file=sys.stderr,
                    )
                    all_ok = False
                    continue
                md5_ok = md5_hex(remote_data) == want_md5
                needle_ok = NEEDLE in remote_data.decode("utf-8", errors="replace")
                ok = md5_ok and needle_ok and len(remote_data) == want_size
                print(
                    f"::notice::CHECK {remote!r} size={len(remote_data)} want={want_size} "
                    f"md5={'yes' if md5_ok else 'no'} needle={'yes' if needle_ok else 'no'}",
                    flush=True,
                )
                if ok:
                    print(f"::notice::SFTP_CANONICAL_OK {remote}", flush=True)
                else:
                    print(
                        f"::error::SFTP stale/wrong at {remote!r} (HTTP uses this URL)",
                        file=sys.stderr,
                    )
                    all_ok = False
        finally:
            sftp.close()
    finally:
        transport.close()

    if all_ok:
        print("::notice::MC_PDP_JS_SFTP_CANONICAL_OK", flush=True)
        return 0
    print(
        "::error::mc-pdp JS not on canonical /v/vspfiles/ paths — green lftp to /vspfiles/ only is not enough",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
