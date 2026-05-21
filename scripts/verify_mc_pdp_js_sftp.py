#!/usr/bin/env python3
"""SFTP verify: mc-pdp-auth-cta-fix.js and mc-pdp-price-stack.js contain mcEnsurePdpPriceStack."""
from __future__ import annotations

import os
import sys

NEEDLE = "mcEnsurePdpPriceStack"
FILES = (
    "vspfiles/js/mc-pdp-auth-cta-fix.js",
    "vspfiles/js/mc-pdp-price-stack.js",
)
REMOTE_PATHS = {
    "vspfiles/js/mc-pdp-auth-cta-fix.js": (
        "/v/vspfiles/js/mc-pdp-auth-cta-fix.js",
        "/vspfiles/js/mc-pdp-auth-cta-fix.js",
    ),
    "vspfiles/js/mc-pdp-price-stack.js": (
        "/v/vspfiles/js/mc-pdp-price-stack.js",
        "/vspfiles/js/mc-pdp-price-stack.js",
    ),
}


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    for local in FILES:
        if not os.path.isfile(local):
            print(f"::error::missing local {local}", file=sys.stderr)
            return 1
        with open(local, encoding="utf-8", errors="replace") as f:
            if NEEDLE not in f.read():
                print(f"::error::local {local} missing {NEEDLE}", file=sys.stderr)
                return 1

    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    transport = connect_paramiko_transport(host, port, user, password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    try:
        for local in FILES:
            want = os.path.getsize(local)
            ok = False
            for remote in REMOTE_PATHS[local]:
                try:
                    with sftp.open(remote, "r") as rf:
                        head = rf.read(min(120000, want + 4096)).decode("utf-8", errors="replace")
                    if NEEDLE in head:
                        print(f"::notice::SFTP_OK {remote} has {NEEDLE}", flush=True)
                        ok = True
                        break
                    print(f"::warning::SFTP_STALE {remote} (no {NEEDLE})", flush=True)
                except OSError as exc:
                    print(f"::warning::SFTP_READ {remote}: {exc}", flush=True)
            if not ok:
                print(f"::error::SFTP verify failed for {local}", file=sys.stderr)
                return 1
    finally:
        sftp.close()
        transport.close()
    print(f"::notice::MC_PDP_JS_SFTP_OK ({NEEDLE})", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
