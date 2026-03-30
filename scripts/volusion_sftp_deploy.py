#!/usr/bin/env python3
"""
Paramiko-based SFTP deploy fallback when OpenSSH + sshpass cannot authenticate
(Volusion and similar appliances often behave better with Paramiko's negotiation).
"""
from __future__ import annotations

import os
import sys


def _roots() -> list[str]:
    override = os.environ.get("SFTP_ROOT_V", "").strip()
    if override:
        return [override]
    return ["/v", "/", "__HOME__", "/mccabestheaterandliving.com/v", "v"]


def _css_segments() -> list[str]:
    rel = os.environ.get("SFTP_CSS_SUBDIR", "vspfiles/css").strip("/")
    return [s for s in rel.split("/") if s]


def _goto_root(sftp, root: str) -> None:
    if root == "__HOME__":
        return
    sftp.chdir("/")
    if root in ("", "/", "."):
        return
    for seg in root.strip("/").split("/"):
        if seg:
            sftp.chdir(seg)


def _try_upload(sftp, root: str) -> None:
    _goto_root(sftp, root)
    sftp.put("template_266.html", "template_266.html")
    for seg in _css_segments():
        sftp.chdir(seg)
    sftp.put("vspfiles/css/custom-safe.css", "custom-safe.css")


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    host = os.environ["SFTP_HOST"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    import paramiko  # noqa: PLC0415 — after pip install in workflow

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        for root in _roots():
            sftp = paramiko.SFTPClient.from_transport(transport)
            try:
                _try_upload(sftp, root)
            except Exception as exc:  # noqa: BLE001
                print(f"PARAMIKO_TRY_FAIL root={root!r}: {exc}", file=sys.stderr)
            else:
                print(f"PARAMIKO_OK root={root!r}", flush=True)
                sftp.close()
                return 0
            finally:
                try:
                    sftp.close()
                except Exception:
                    pass
        return 1
    finally:
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
