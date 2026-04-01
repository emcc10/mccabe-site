#!/usr/bin/env python3
"""
Write template_266.html to every canonical Volusion SFTP path (confirm=False).

Use when CSS updates but the active theme file may be a different path than the
pair that succeeded first. Exits 1 if no put succeeds.
"""
from __future__ import annotations

import os
import sys


def _paths() -> list[str]:
    secret = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret and not secret.startswith("/"):
        secret = "/" + secret
    if secret == "/v/v/template_266.html":
        secret = "/v/template_266.html"
    out: list[str] = []
    seen: set[str] = set()
    # /v/ first — same file as browser …/v/template_266.html (not SFTP root /template_266.html).
    for p in (
        secret,
        "/v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "/v/v/template_266.html",
        "v/template_266.html",
        "/template_266.html",
        "template_266.html",
    ):
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)
    local = "template_266.html"
    if not os.path.isfile(local):
        print(f"::error::Missing {local}", file=sys.stderr)
        return 1

    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("SECRET_SFTP_HOST", "").strip()
        or os.environ.get("SECRET_FTP_HOST", "").strip()
    )
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("SECRET_SFTP_PORT") or "2222")
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

    ok_any = False
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for remote in _paths():
                try:
                    sftp.put(local, remote, confirm=False)
                    print(f"::notice::FORCE_TEMPLATE_OK → {remote}", flush=True)
                    ok_any = True
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::FORCE_TEMPLATE_SKIP {remote!r}: {exc}", flush=True)
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()

    if not ok_any:
        print(
            "::error::Could not write template_266.html to any canonical SFTP path. "
            "Check SFTP_TEMPLATE_REMOTE and permissions.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
