#!/usr/bin/env python3
"""
Write template_266.html to every canonical Volusion SFTP path (confirm=False).

Use when CSS updates but the active theme file may be a different path than the
pair that succeeded first. Exits 1 if no put succeeds with matching MD5 read-back.
"""
from __future__ import annotations

import os
import sys

from verify_template_sftp import (
    check_remote,
    md5_hex,
    read_local_template,
    template_remote_paths,
)


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)
    local = "template_266.html"
    if not os.path.isfile(local):
        print(f"::error::Missing {local}", file=sys.stderr)
        return 1

    local_data = read_local_template()
    local_md5 = md5_hex(local_data)
    want = len(local_data)
    needle = ""
    try:
        from verify_template_sftp import template_needle

        needle = template_needle()
    except Exception:  # noqa: BLE001
        pass

    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("SECRET_SFTP_HOST", "").strip()
        or os.environ.get("SECRET_FTP_HOST", "").strip()
        or os.environ.get("SECRET_FTP_SERVER", "").strip()
    )
    port = int(
        os.environ.get("SFTP_PORT")
        or os.environ.get("SECRET_SFTP_PORT")
        or os.environ.get("SECRET_FTP_PORT")
        or "2222"
    )
    user = os.environ.get("SFTP_USER", "")
    password = os.environ.get("SFTP_PASS", "")

    if not host or not user or not password:
        print("::error::Missing SFTP env for force template step.", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::force template connect failed: {exc}", file=sys.stderr)
        return 1

    verified: list[str] = []
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for remote in template_remote_paths():
                try:
                    sftp.put(local, remote, confirm=False)
                    ok, got, md5_ok, needle_ok = check_remote(
                        sftp, remote, local_data, local_md5, needle
                    )
                    print(
                        f"::notice::FORCE_TEMPLATE → {remote} size={got} want={want} "
                        f"md5={'yes' if md5_ok else 'no'} needle={'yes' if needle_ok else 'no'}",
                        flush=True,
                    )
                    if ok:
                        verified.append(remote)
                    else:
                        print(
                            f"::warning::FORCE_TEMPLATE_READBACK_MISMATCH {remote!r}",
                            flush=True,
                        )
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::FORCE_TEMPLATE_SKIP {remote!r}: {exc}", flush=True)
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()

    if not verified:
        print(
            "::error::Could not write template_266.html with matching MD5 on any SFTP path. "
            "Check SFTP_TEMPLATE_REMOTE and permissions.",
            file=sys.stderr,
        )
        return 1
    print(
        f"::notice::FORCE_TEMPLATE verified on: {', '.join(verified)}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
