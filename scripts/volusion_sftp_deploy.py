#!/usr/bin/env python3
"""
Volusion SFTP deploy — minimal.

Files on the store live under **/v** (https://host/v/…). For each asset we upload to:
  • /v/… absolute path
  • same logical path **relative to a chroot at /v** (template_266.html, vspfiles/…)

Optional: SFTP_TEMPLATE_REMOTE, SFTP_CSS_REMOTE_FILE (first try; defaults still run after).
"""
from __future__ import annotations

import os
import sys

THEME_REL = (
    "templates/266/css/template.css",
    "templates/266/js/min/design-toolkit.min.js",
    "templates/266/js/min/template.min.js",
)
THEME_BASES = ("/v/vspfiles/", "vspfiles/")


def _ensure_remote_parent_dirs(sftp, remote_path: str) -> None:
    remote_path = (remote_path or "").replace("\\", "/").strip()
    if not remote_path or remote_path.endswith("/"):
        return
    parent = remote_path.rsplit("/", 1)[0].strip()
    if not parent:
        return
    is_abs = parent.startswith("/")
    parts = [p for p in parent.strip("/").split("/") if p]
    if not parts:
        return
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}" if (cur or is_abs) else p
        if is_abs and not cur.startswith("/"):
            cur = "/" + cur
        try:
            sftp.stat(cur)
        except Exception:
            try:
                sftp.mkdir(cur)
            except Exception:
                pass


def _put(sftp, local: str, remote: str) -> bool:
    _ensure_remote_parent_dirs(sftp, remote)
    sftp.put(local, remote, confirm=False)
    print(f"::notice::PUT_OK {local!r} -> {remote!r}", flush=True)
    return True


def _try_put(sftp, local: str, remote: str) -> bool:
    try:
        return _put(sftp, local, remote)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PUT_SKIP {remote!r}: {exc}", flush=True)
        return False


def _uniq(paths: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _template_remotes() -> list[str]:
    paths = [
        os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip(),
        "/v/template_266.html",
        "template_266.html",
    ]
    return _uniq([p for p in paths if p])


def _css_remotes() -> list[str]:
    paths = [
        os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip(),
        "/v/vspfiles/css/custom-safe.css",
        "vspfiles/css/custom-safe.css",
    ]
    return _uniq([p for p in paths if p])


def _mccabe_remotes() -> list[str]:
    css0 = (_css_remotes() or ["/v/vspfiles/css/custom-safe.css"])[0]
    if css0.startswith("/v/vspfiles/css/"):
        m_abs = css0.replace("/css/custom-safe.css", "/templates/266/css/mccabe-overrides.css")
        m_rel = "vspfiles/templates/266/css/mccabe-overrides.css"
        return _uniq([m_abs, m_rel])
    if css0.startswith("vspfiles/css/"):
        return _uniq(
            [
                "vspfiles/templates/266/css/mccabe-overrides.css",
                "/v/vspfiles/templates/266/css/mccabe-overrides.css",
            ]
        )
    return _uniq(
        [
            "/v/vspfiles/templates/266/css/mccabe-overrides.css",
            "vspfiles/templates/266/css/mccabe-overrides.css",
        ]
    )


def _theme_remote(mccabe_remote: str, tail: str) -> str:
    if not mccabe_remote.endswith("mccabe-overrides.css"):
        return f"/v/vspfiles/{tail}"
    prefix = mccabe_remote[: -len("mccabe-overrides.css")]
    if tail.startswith("templates/266/css/"):
        return prefix + tail.split("/")[-1]
    js_prefix = prefix.replace("/css/", "/js/min/", 1)
    return js_prefix + tail.split("/")[-1]


def _any_template_matches_local(sftp) -> bool:
    try:
        want = os.path.getsize("template_266.html")
    except OSError:
        return False
    if want <= 0:
        return False
    for p in ("/v/template_266.html", "template_266.html"):
        try:
            if sftp.stat(p).st_size == want:
                print(f"::notice::STAT_OK {p!r} size={want}", flush=True)
                return True
        except Exception:
            continue
    return False


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))

    host = os.environ["SFTP_HOST"]
    port = int((os.environ.get("SFTP_PORT") or "").strip() or "2222")
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.banner_timeout = 90
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::CONNECT_FAIL {exc}", file=sys.stderr)
        return 2

    tpl_written = False
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::SFTP getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::getcwd: {exc}", flush=True)

            for r in _template_remotes():
                if _try_put(sftp, "template_266.html", r):
                    tpl_written = True

            for r in _css_remotes():
                _try_put(sftp, "vspfiles/css/custom-safe.css", r)

            mccabe_list = _mccabe_remotes()
            mc0 = mccabe_list[0] if mccabe_list else "/v/vspfiles/templates/266/css/mccabe-overrides.css"
            for r in mccabe_list:
                _try_put(sftp, "vspfiles/templates/266/css/mccabe-overrides.css", r)

            for tail in THEME_REL:
                local = f"vspfiles/{tail}"
                if not os.path.isfile(local):
                    continue
                for base in THEME_BASES:
                    _try_put(sftp, local, base + tail)
                alt = _theme_remote(mc0, tail)
                if alt and alt not in {base + tail for base in THEME_BASES}:
                    _try_put(sftp, local, alt)

            if tpl_written or _any_template_matches_local(sftp):
                print("::notice::DEPLOY_OK", flush=True)
                return 0
            print("::error::DEPLOY_FAIL template not on server at /v/template_266.html or template_266.html", file=sys.stderr)
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
