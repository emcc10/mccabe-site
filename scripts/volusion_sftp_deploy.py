#!/usr/bin/env python3
"""
Paramiko SFTP deploy fallback. Uses absolute remote paths for template + CSS.

Default: custom-safe.css in the same remote folder as template_266.html (e.g. /v/).
Optional SFTP_CSS_SUBDIR=vspfiles/css for legacy layout.
Optional SFTP_CSS_REMOTE_FILE= full path override.
"""
from __future__ import annotations

import os
import sys


def _roots() -> list[str]:
    override = os.environ.get("SFTP_ROOT_V", "").strip()
    if override:
        return [override]
    return ["/v", "/", "__HOME__", "/mccabestheaterandliving.com/v", "v"]


def _css_subdir_segments() -> list[str]:
    rel = os.environ.get("SFTP_CSS_SUBDIR", "").strip().strip("/")
    if not rel:
        return []
    return [s for s in rel.split("/") if s]


def _css_relative_under_template_root() -> str:
    segs = _css_subdir_segments()
    if not segs:
        return "custom-safe.css"
    return "/".join(segs + ["custom-safe.css"])


def _goto_root(sftp, root: str) -> None:
    if root == "__HOME__":
        return
    sftp.chdir("/")
    if root in ("", "/", "."):
        return
    for seg in root.strip("/").split("/"):
        if seg:
            sftp.chdir(seg)


def _remote_pair(root: str) -> tuple[str | None, str | None]:
    """(template_abs, css_abs) or (None, None) for __HOME__ relative mode."""
    if root == "__HOME__":
        return None, None
    override = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    css_rel = _css_relative_under_template_root()
    r = root.strip()
    if r in ("/", ""):
        t_rem = "/template_266.html"
        c_rem = override or ("/" + css_rel)
        return t_rem, c_rem
    if r.startswith("/"):
        base = r.rstrip("/")
        t_rem = f"{base}/template_266.html"
        c_rem = override or f"{base}/{css_rel}"
        return t_rem, c_rem
    t_rem = f"{r}/template_266.html"
    c_rem = override or f"{r}/{css_rel}"
    return t_rem, c_rem


def _try_upload(sftp, root: str) -> None:
    t_rem, c_rem = _remote_pair(root)
    if t_rem is None:
        _goto_root(sftp, root)
        sftp.put("template_266.html", "template_266.html")
        for seg in _css_subdir_segments():
            sftp.chdir(seg)
        sftp.put("vspfiles/css/custom-safe.css", "custom-safe.css")
        return
    sftp.put("template_266.html", t_rem)
    sftp.put("vspfiles/css/custom-safe.css", c_rem)


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    host = os.environ["SFTP_HOST"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        for root in _roots():
            t_rem, c_rem = _remote_pair(root)
            print(f"PARAMIKO_TRY root={root!r} template={t_rem!r} css={c_rem!r}", flush=True)
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
