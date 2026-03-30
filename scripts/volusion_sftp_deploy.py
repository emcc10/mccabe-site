#!/usr/bin/env python3
"""
Paramiko SFTP deploy fallback.

Template + CSS use different remote paths (Volusion):
  template → /template_266.html first (SFTP root), then fallbacks under /v/, etc.
  CSS      → /vspfiles/css/custom-safe.css

Override with SFTP_TEMPLATE_REMOTE / SFTP_CSS_REMOTE_FILE (full paths).
"""
from __future__ import annotations

import os
import sys


def _css_remote() -> str:
    p = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    if p:
        return p
    return "/vspfiles/css/custom-safe.css"


def _template_candidates() -> list[str]:
    one = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if one:
        return [one]
    return [
        "/template_266.html",
        "/v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "v/template_266.html",
    ]


def _try_pair(sftp, t_path: str, c_path: str) -> None:
    sftp.put("template_266.html", t_path)
    sftp.put("vspfiles/css/custom-safe.css", c_path)


def _try_home_relative(sftp) -> bool:
    try:
        sftp.put("template_266.html", "template_266.html")
        sftp.put("vspfiles/css/custom-safe.css", "vspfiles/css/custom-safe.css")
        return True
    except Exception:  # noqa: BLE001
        return False


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    host = os.environ["SFTP_HOST"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    c_remote = _css_remote()
    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for t_path in _template_candidates():
                c_path = c_remote
                if t_path.startswith("/mccabestheaterandliving.com/") and c_remote == "/vspfiles/css/custom-safe.css":
                    c_path = "/mccabestheaterandliving.com/vspfiles/css/custom-safe.css"
                print(f"PARAMIKO_TRY template={t_path!r} css={c_path!r}", flush=True)
                try:
                    _try_pair(sftp, t_path, c_path)
                except Exception as exc:  # noqa: BLE001
                    print(f"PARAMIKO_TRY_FAIL: {exc}", file=sys.stderr)
                else:
                    print("PARAMIKO_OK", flush=True)
                    return 0
            if _try_home_relative(sftp):
                print("PARAMIKO_OK (login-relative template + vspfiles/css/)", flush=True)
                return 0
            return 1
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
