#!/usr/bin/env python3
"""Read-only SFTP probe: cwd, directory listings, stat deploy paths. Run in Actions after deploy."""
from __future__ import annotations

import os
import sys


def _port() -> int:
    return int(
        (os.environ.get("SFTP_PORT") or "").strip()
        or (os.environ.get("FTP_PORT") or "").strip()
        or "2222"
    )


def _creds() -> tuple[str, str, str]:
    host = (os.environ.get("SFTP_HOST") or os.environ.get("FTP_SERVER") or "").strip()
    user = (os.environ.get("SFTP_USER") or os.environ.get("FTP_USERNAME") or "").strip()
    password = (os.environ.get("SFTP_PASS") or os.environ.get("FTP_PASSWORD") or "").strip()
    return host, user, password


PATHS: tuple[str, ...] = (
    "/v/template_266.html",
    "/template_266.html",
    "v/template_266.html",
    "template_266.html",
    "/v/vspfiles/css/custom-safe.css",
    "v/vspfiles/css/custom-safe.css",
    "/vspfiles/css/custom-safe.css",
    "/v/vspfiles/templates/266/css/mccabe-overrides.css",
    "v/vspfiles/templates/266/css/mccabe-overrides.css",
)


def main() -> int:
    host, user, password = _creds()
    if not host or not user or not password:
        print(
            "::error::Set SFTP_HOST/FTP_SERVER, SFTP_USER/FTP_USERNAME, SFTP_PASS/FTP_PASSWORD",
            file=sys.stderr,
        )
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, _port()))
    transport.banner_timeout = 90
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::PROBE_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::PROBE getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::PROBE getcwd: {exc}", flush=True)
            for listdir_path in (".", "/", "/v", "v", "/vspfiles", "vspfiles"):
                try:
                    names = [x.filename for x in sftp.listdir_attr(listdir_path)][:40]
                    print(f"::notice::PROBE listdir {listdir_path!r} n={len(names)} sample={names!r}", flush=True)
                except Exception as exc:  # noqa: BLE001
                    print(f"::notice::PROBE listdir {listdir_path!r}: {exc}", flush=True)
            for p in PATHS:
                try:
                    st = sftp.stat(p)
                    print(
                        f"::notice::PROBE stat {p!r} size={st.st_size}",
                        flush=True,
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"::notice::PROBE stat {p!r}: {exc}", flush=True)
            return 0
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
