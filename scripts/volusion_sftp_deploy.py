#!/usr/bin/env python3
"""
Paramiko SFTP deploy fallback.

Template + CSS use different remote paths (Volusion):
  template -> /template_266.html first (SFTP root), then fallbacks under /v/, etc.
  CSS      -> /vspfiles/css/custom-safe.css and /v/vspfiles/css/custom-safe.css (File Editor: wwwroot/v/vspfiles/css/).
  mccabe-overrides -> alongside under vspfiles/templates/266/css/ (linked from template_266.html).

Override with SFTP_TEMPLATE_REMOTE / SFTP_CSS_REMOTE_FILE (full paths).
"""
from __future__ import annotations

import os
import sys

LOCAL_MCCABE = "vspfiles/templates/266/css/mccabe-overrides.css"


def _css_remote() -> str:
    p = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    if p:
        return p
    return "/vspfiles/css/custom-safe.css"


def _mccabe_remote_for_css(c_path: str) -> str:
    if c_path in ("/v/vspfiles/css/custom-safe.css", "v/vspfiles/css/custom-safe.css"):
        return "/v/vspfiles/templates/266/css/mccabe-overrides.css"
    if c_path == "/vspfiles/css/custom-safe.css":
        return "/vspfiles/templates/266/css/mccabe-overrides.css"
    if c_path == "/mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css":
        return "/mccabestheaterandliving.com/v/vspfiles/templates/266/css/mccabe-overrides.css"
    if c_path == "/mccabestheaterandliving.com/vspfiles/css/custom-safe.css":
        return "/mccabestheaterandliving.com/vspfiles/templates/266/css/mccabe-overrides.css"
    if c_path == "vspfiles/css/custom-safe.css":
        return "vspfiles/templates/266/css/mccabe-overrides.css"
    return "/v/vspfiles/templates/266/css/mccabe-overrides.css"


def _template_css_pairs(c_remote: str) -> list[tuple[str, str]]:
    secret_t = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret_t and not secret_t.startswith("/"):
        secret_t = "/" + secret_t
    if secret_t == "/v/v/template_266.html":
        secret_t = "/v/template_266.html"
    domain_t = "/mccabestheaterandliving.com/v/template_266.html"
    domain_c = "/mccabestheaterandliving.com/vspfiles/css/custom-safe.css"
    domain_c_under_v = "/mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css"
    v_wwwroot_css = "/v/vspfiles/css/custom-safe.css"

    raw: list[tuple[str, str]] = []
    if secret_t:
        raw.append((secret_t, c_remote))
        raw.append((secret_t, v_wwwroot_css))
    raw.extend(
        [
            ("/v/template_266.html", c_remote),
            ("/v/template_266.html", v_wwwroot_css),
            ("/v/v/template_266.html", c_remote),
            ("/v/v/template_266.html", v_wwwroot_css),
            ("/template_266.html", c_remote),
            ("/template_266.html", v_wwwroot_css),
            (domain_t, domain_c),
            (domain_t, domain_c_under_v),
            ("template_266.html", "vspfiles/css/custom-safe.css"),
            ("template_266.html", "v/vspfiles/css/custom-safe.css"),
        ]
    )

    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str]] = []
    for t_path, c_path in raw:
        key = (t_path, c_path)
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out


def _try_pair(sftp, t_path: str, c_path: str) -> None:
    sftp.put("template_266.html", t_path)
    sftp.put("vspfiles/css/custom-safe.css", c_path)
    m_path = _mccabe_remote_for_css(c_path)
    sftp.put(LOCAL_MCCABE, m_path)


def _mirror_template_to_canonical_paths(sftp) -> None:
    for rel in (
        "/v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "/v/v/template_266.html",
        "/template_266.html",
    ):
        try:
            sftp.put("template_266.html", rel, confirm=False)
            print(f"::notice::PARAMIKO_MIRROR_OK template -> {rel}", flush=True)
        except Exception as exc:
            print(f"::warning::PARAMIKO_MIRROR_SKIP template {rel}: {exc}", flush=True)


def _mirror_css_to_canonical_paths(sftp) -> None:
    for rel in (
        "/vspfiles/css/custom-safe.css",
        "/v/vspfiles/css/custom-safe.css",
        "v/vspfiles/css/custom-safe.css",
        "/mccabestheaterandliving.com/vspfiles/css/custom-safe.css",
        "/mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css",
    ):
        try:
            sftp.put("vspfiles/css/custom-safe.css", rel, confirm=False)
            print(f"::notice::PARAMIKO_MIRROR_OK css -> {rel}", flush=True)
        except Exception as exc:
            print(f"::warning::PARAMIKO_MIRROR_SKIP css {rel}: {exc}", flush=True)


def _mirror_mccabe_to_canonical_paths(sftp) -> None:
    for rel in (
        "/v/vspfiles/templates/266/css/mccabe-overrides.css",
        "v/vspfiles/templates/266/css/mccabe-overrides.css",
        "/vspfiles/templates/266/css/mccabe-overrides.css",
        "/mccabestheaterandliving.com/v/vspfiles/templates/266/css/mccabe-overrides.css",
    ):
        try:
            sftp.put(LOCAL_MCCABE, rel, confirm=False)
            print(f"::notice::PARAMIKO_MIRROR_OK mccabe-overrides -> {rel}", flush=True)
        except Exception as exc:
            print(f"::warning::PARAMIKO_MIRROR_SKIP mccabe-overrides {rel}: {exc}", flush=True)


def _try_home_relative(sftp) -> bool:
    try:
        sftp.put("template_266.html", "template_266.html")
        sftp.put("vspfiles/css/custom-safe.css", "vspfiles/css/custom-safe.css")
        sftp.put(LOCAL_MCCABE, "vspfiles/templates/266/css/mccabe-overrides.css")
        return True
    except Exception:
        return False


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    if not os.path.isfile(LOCAL_MCCABE):
        print(f"PARAMIKO_FAIL missing {LOCAL_MCCABE}", file=sys.stderr)
        return 1

    host = os.environ["SFTP_HOST"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    c_remote = _css_remote()
    import paramiko

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            any_ok = False
            for t_path, c_path in _template_css_pairs(c_remote):
                print(f"PARAMIKO_TRY template={t_path!r} css={c_path!r}", flush=True)
                try:
                    _try_pair(sftp, t_path, c_path)
                except Exception as exc:
                    print(f"PARAMIKO_TRY_FAIL template={t_path!r}: {exc}", file=sys.stderr)
                else:
                    any_ok = True
                    print(f"PARAMIKO_OK_PAIR template={t_path!r}", flush=True)
            if any_ok:
                _mirror_template_to_canonical_paths(sftp)
                _mirror_css_to_canonical_paths(sftp)
                _mirror_mccabe_to_canonical_paths(sftp)
                print("PARAMIKO_OK (one or more path pairs succeeded)", flush=True)
                return 0
            if _try_home_relative(sftp):
                print("PARAMIKO_OK (login-relative template + vspfiles/css/)", flush=True)
                _mirror_template_to_canonical_paths(sftp)
                _mirror_css_to_canonical_paths(sftp)
                _mirror_mccabe_to_canonical_paths(sftp)
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
