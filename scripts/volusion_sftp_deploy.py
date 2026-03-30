#!/usr/bin/env python3
"""
Paramiko-based SFTP deploy fallback when OpenSSH + sshpass cannot authenticate
(Volusion and similar appliances often behave better with Paramiko's negotiation).

Always uses absolute remote paths for template + CSS so CSS cannot land beside the
template if a chdir into vspfiles/css fails.
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


def _css_remote_suffix() -> str:
    return "/".join([*_css_segments(), "custom-safe.css"])


def _goto_root(sftp, root: str) -> None:
    if root == "__HOME__":
        return
    sftp.chdir("/")
    if root in ("", "/", "."):
        return
    for seg in root.strip("/").split("/"):
        if seg:
            sftp.chdir(seg)


def _remote_paths(root: str) -> tuple[str | None, str | None]:
    """Return (template_remote, css_remote) or (None, None) to use chdir+relative puts."""
    if root == "__HOME__":
        return None, None
    override = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    css_suffix = _css_remote_suffix()
    r = root.rstrip("/")
    if r in ("", "/"):
        t_rem = "/template_266.html"
        c_rem = override or f"/{css_suffix}"
    else:
        base = r if r.startswith("/") else r
        t_rem = f"{base}/template_266.html" if not base.startswith("/") else f"{base}/template_266.html"
        if not base.startswith("/"):
            t_rem = f"{base}/template_266.html"
            c_rem = override or f"{base}/{css_suffix}"
        else:
            t_rem = f"{base}/template_266.html"
            c_rem = override or f"{base}/{css_suffix}"
    # Normalize duplicate slashes (except after colon)
    def squash(p: str) -> str:
        out = []
        for part in p.split("/"):
            if part == "" and out == []:
                out.append("")
            elif part != "":
                out.append(part)
        return "/" + "/".join(out[1:]) if p.startswith("/") else "/".join(out)

    if t_rem.startswith("/"):
        t_rem = "/" + "/".join(x for x in t_rem.split("/") if x)
        c_rem = "/" + "/".join(x for x in c_rem.split("/") if x) if c_rem.startswith("/") else c_rem
    else:
        t_rem = "/".join(x for x in t_rem.split("/") if x)
        c_rem = "/".join(x for x in c_rem.split("/") if x) if not override else c_rem
    return t_rem, c_rem


def _remote_paths_v2(root: str) -> tuple[str | None, str | None]:
    """Clearer construction of absolute remote paths."""
    if root == "__HOME__":
        return None, None
    override = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    css_rel = _css_remote_suffix()

    if override:
        css_rem: str | None = override
    else:
        css_rem = None

    r = root.strip()
    if r in ("/", ""):
        t_rem = "/template_266.html"
        if css_rem is None:
            css_rem = f"/{css_rel}"
        return t_rem, css_rem

    if r.startswith("/"):
        base = r.rstrip("/")
        t_rem = f"{base}/template_266.html"
        if css_rem is None:
            css_rem = f"{base}/{css_rel}"
        return t_rem, css_rem

    # relative root e.g. "v"
    t_rem = f"{r}/template_266.html"
    if css_rem is None:
        css_rem = f"{r}/{css_rel}"
    return t_rem, css_rem


def _try_upload(sftp, root: str) -> None:
    t_rem, c_rem = _remote_paths_v2(root)
    if t_rem is None:
        _goto_root(sftp, root)
        sftp.put("template_266.html", "template_266.html")
        for seg in _css_segments():
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

    import paramiko  # noqa: PLC0415 — after pip install in workflow

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        for root in _roots():
            t_rem, c_rem = _remote_paths_v2(root)
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
