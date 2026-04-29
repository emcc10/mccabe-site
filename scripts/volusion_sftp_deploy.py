#!/usr/bin/env python3
"""
Paramiko SFTP deploy fallback.

Template + CSS use different remote paths (Volusion):
  template → /template_266.html first (SFTP root), then fallbacks under /v/, etc.
  CSS      → /vspfiles/css/custom-safe.css and /v/vspfiles/css/custom-safe.css (File Editor: wwwroot/v/vspfiles/css/).
  mccabe   → parallel to CSS under .../templates/266/css/mccabe-overrides.css (linked from template).
  theme    → template.css + js/min/*.js under .../templates/266/ (same href/src as template).

Override with SFTP_TEMPLATE_REMOTE / SFTP_CSS_REMOTE_FILE (full paths).
"""
from __future__ import annotations

import os
import sys


def _css_remote() -> str:
    p = os.environ.get("SFTP_CSS_REMOTE_FILE", "").strip()
    if p:
        return p
    return "/v/vspfiles/css/custom-safe.css"


def _mccabe_remote_for_css(c_path: str) -> str:
    """Keep theme override path parallel to custom-safe (v/ wwwroot vs /vspfiles)."""
    mapping = {
        "/v/vspfiles/css/custom-safe.css": "/v/vspfiles/templates/266/css/mccabe-overrides.css",
        "v/vspfiles/css/custom-safe.css": "/v/vspfiles/templates/266/css/mccabe-overrides.css",
        "/vspfiles/css/custom-safe.css": "/vspfiles/templates/266/css/mccabe-overrides.css",
        "/mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css": (
            "/mccabestheaterandliving.com/v/vspfiles/templates/266/css/mccabe-overrides.css"
        ),
        "/mccabestheaterandliving.com/vspfiles/css/custom-safe.css": (
            "/mccabestheaterandliving.com/vspfiles/templates/266/css/mccabe-overrides.css"
        ),
        "vspfiles/css/custom-safe.css": "vspfiles/templates/266/css/mccabe-overrides.css",
    }
    return mapping.get(c_path, "/v/vspfiles/templates/266/css/mccabe-overrides.css")


def _template266_theme_tail_paths() -> list[str]:
    """Paths under …/vspfiles/ linked from template_266.html (same tree as mccabe-overrides)."""
    return [
        "templates/266/css/template.css",
        "templates/266/js/min/design-toolkit.min.js",
        "templates/266/js/min/template.min.js",
    ]


def _theme_asset_remote(mccabe_path: str, tail: str) -> str:
    """Derive remote path for template.css / JS from the mccabe-overrides.css path for this deploy pair."""
    suffix = "mccabe-overrides.css"
    name = tail.split("/")[-1]
    if mccabe_path.endswith(suffix):
        prefix = mccabe_path[: -len(suffix)]
        if tail.startswith("templates/266/css/"):
            return prefix + name
        js_prefix = prefix.replace("/css/", "/js/min/", 1)
        return js_prefix + name
    return f"{mccabe_path.rstrip('/')}/{tail.removeprefix('templates/266/').lstrip('/')}"


def _ensure_remote_parent_dirs(sftp, remote_path: str) -> None:
    """Best-effort mkdir -p for the parent of a remote file (avoids SFTP 550 when folders are missing)."""
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
        if is_abs:
            cur = f"{cur}/{p}" if cur else f"/{p}"
        else:
            cur = f"{cur}/{p}" if cur else p
        try:
            sftp.stat(cur)
        except Exception:
            try:
                sftp.mkdir(cur)
            except Exception:
                pass


def _put_file(sftp, local: str, remote: str) -> None:
    _ensure_remote_parent_dirs(sftp, remote)
    sftp.put(local, remote, confirm=False)


def _template_css_pairs(c_remote: str) -> list[tuple[str, str]]:
    """Every (template_path, css_path) we try — same order as deploy.yml (secret first, then fallbacks).

    When SFTP_TEMPLATE_REMOTE is set, older Paramiko behavior stopped after the first successful put;
    that path is often writable but not the file Volusion serves, so we always attempt the full list.
    """
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
            # Site-root-relative: many Volusion SFTP logins are chrooted here (no leading slash).
            ("v/template_266.html", "v/vspfiles/css/custom-safe.css"),
            ("v/template_266.html", "vspfiles/css/custom-safe.css"),
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


def _try_pair(sftp, t_path: str, c_path: str) -> bool:
    """Upload template + assets for this path pair. Each file is best-effort.
    Returns True if template_266.html was written to t_path (Volusion often rejects css on the same try)."""
    m_path = _mccabe_remote_for_css(c_path)
    template_ok = False
    try:
        _put_file(sftp, "template_266.html", t_path)
        template_ok = True
        print(f"::notice::PARAMIKO_PUT_OK template → {t_path!r}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP template {t_path!r}: {exc}", flush=True)
    try:
        _put_file(sftp, "vspfiles/css/custom-safe.css", c_path)
        print(f"::notice::PARAMIKO_PUT_OK css → {c_path!r}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP css {c_path!r}: {exc}", flush=True)
    try:
        _put_file(sftp, "vspfiles/templates/266/css/mccabe-overrides.css", m_path)
        print(f"::notice::PARAMIKO_PUT_OK mccabe → {m_path!r}", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP mccabe {m_path!r}: {exc}", flush=True)
    for tail in _template266_theme_tail_paths():
        local = f"vspfiles/{tail}"
        if not os.path.isfile(local):
            continue
        remote = _theme_asset_remote(m_path, tail)
        try:
            _put_file(sftp, local, remote)
            print(f"::notice::PARAMIKO_PUT_OK theme {local!r} → {remote!r}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"PARAMIKO_TRY_PAIR_THEME_SKIP {local!r}→{remote!r}: {exc}", flush=True)
    return template_ok


def _mirror_template_to_canonical_paths(sftp) -> None:
    """Extra template writes — logged so Action logs show whether Volusion paths are writable."""
    for rel in (
        "v/template_266.html",
        "template_266.html",
        "/v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "/v/v/template_266.html",
        "/template_266.html",
    ):
        try:
            _put_file(sftp, "template_266.html", rel)
            print(f"::notice::PARAMIKO_MIRROR_OK template → {rel}", flush=True)
        except Exception as exc:  # noqa: BLE001
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
            _put_file(sftp, "vspfiles/css/custom-safe.css", rel)
            print(f"::notice::PARAMIKO_MIRROR_OK css → {rel}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::PARAMIKO_MIRROR_SKIP css {rel}: {exc}", flush=True)


def _mirror_mccabe_to_canonical_paths(sftp) -> None:
    local = "vspfiles/templates/266/css/mccabe-overrides.css"
    for rel in (
        "/v/vspfiles/templates/266/css/mccabe-overrides.css",
        "v/vspfiles/templates/266/css/mccabe-overrides.css",
        "/vspfiles/templates/266/css/mccabe-overrides.css",
        "vspfiles/templates/266/css/mccabe-overrides.css",
        "/mccabestheaterandliving.com/v/vspfiles/templates/266/css/mccabe-overrides.css",
        "/mccabestheaterandliving.com/vspfiles/templates/266/css/mccabe-overrides.css",
    ):
        try:
            _put_file(sftp, local, rel)
            print(f"::notice::PARAMIKO_MIRROR_OK mccabe-overrides → {rel}", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"::warning::PARAMIKO_MIRROR_SKIP mccabe {rel}: {exc}", flush=True)


def _mirror_template266_theme_assets(sftp) -> None:
    bases = (
        "/v/vspfiles/",
        "v/vspfiles/",
        "/vspfiles/",
        "vspfiles/",
        "/mccabestheaterandliving.com/v/vspfiles/",
        "/mccabestheaterandliving.com/vspfiles/",
    )
    for tail in _template266_theme_tail_paths():
        local = f"vspfiles/{tail}"
        if not os.path.isfile(local):
            print(f"::warning::PARAMIKO_MIRROR_SKIP missing local {local}", flush=True)
            continue
        for base in bases:
            rel = base + tail
            try:
                _put_file(sftp, local, rel)
                print(f"::notice::PARAMIKO_MIRROR_OK template266 → {rel}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::warning::PARAMIKO_MIRROR_SKIP template266 {rel}: {exc}", flush=True)


def _try_home_relative(sftp) -> bool:
    """Best-effort uploads from SFTP login directory. True if at least the template was written."""
    template_ok = False
    try:
        _put_file(sftp, "template_266.html", "template_266.html")
        template_ok = True
        print("::notice::PARAMIKO_PUT_OK template → template_266.html (cwd-relative)", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP template template_266.html: {exc}", flush=True)
    try:
        _put_file(sftp, "vspfiles/css/custom-safe.css", "vspfiles/css/custom-safe.css")
        print("::notice::PARAMIKO_PUT_OK css → vspfiles/css/custom-safe.css", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP css vspfiles/css/custom-safe.css: {exc}", flush=True)
    try:
        _put_file(
            sftp,
            "vspfiles/templates/266/css/mccabe-overrides.css",
            "vspfiles/templates/266/css/mccabe-overrides.css",
        )
        print(
            "::notice::PARAMIKO_PUT_OK mccabe → vspfiles/templates/266/css/mccabe-overrides.css",
            flush=True,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::PARAMIKO_PUT_SKIP mccabe (cwd-relative): {exc}", flush=True)
    for tail in _template266_theme_tail_paths():
        local = f"vspfiles/{tail}"
        if os.path.isfile(local):
            try:
                _put_file(sftp, local, tail)
                print(f"::notice::PARAMIKO_PUT_OK theme cwd-relative → {tail!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::warning::PARAMIKO_PUT_SKIP theme {tail!r}: {exc}", flush=True)
    return template_ok


def _remote_template_matches_local(sftp) -> bool:
    """True if any common remote path exists with the same byte size as repo template_266.html."""
    try:
        local_sz = os.path.getsize("template_266.html")
    except OSError:
        return False
    for p in (
        "/v/template_266.html",
        "v/template_266.html",
        "/template_266.html",
        "template_266.html",
    ):
        try:
            st = sftp.stat(p)
            if st.st_size == local_sz and local_sz > 0:
                print(
                    f"::notice::PARAMIKO_STAT_OK remote template {p!r} size={st.st_size} matches local",
                    flush=True,
                )
                return True
        except Exception:
            continue
    return False


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    host = os.environ["SFTP_HOST"]
    # GitHub Actions sets SFTP_PORT to "" when the optional secret is unset (key present, empty value).
    port = int((os.environ.get("SFTP_PORT") or "").strip() or "2222")
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASS"]

    c_remote = _css_remote()
    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.banner_timeout = 90
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"PARAMIKO_CONNECT_FAIL: {exc}", file=sys.stderr)
        return 2

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                cwd = sftp.getcwd()
                print(f"::notice::SFTP getcwd={cwd!r}", flush=True)
            except Exception as exc_gcwd:  # noqa: BLE001
                print(f"::notice::SFTP getcwd unavailable: {exc_gcwd}", flush=True)
            try:
                sample = sorted(name.filename for name in sftp.listdir_attr("."))[:40]
                print(f"::notice::SFTP listdir(.)(sample)={sample}", flush=True)
            except Exception as exc_ls:  # noqa: BLE001
                print(f"::notice::SFTP listdir(.) skipped: {exc_ls}", flush=True)
            template_ok_any = False
            for t_path, c_path in _template_css_pairs(c_remote):
                print(f"PARAMIKO_TRY template={t_path!r} css={c_path!r}", flush=True)
                if _try_pair(sftp, t_path, c_path):
                    template_ok_any = True
                    print(f"PARAMIKO_OK_TEMPLATE_WRITTEN path={t_path!r}", flush=True)
            # Always mirror — pair loop may have uploaded CSS/mccabe without a template_ok flag
            # (template put failed per pair but css put succeeded, or only mirrors reach the live path).
            _mirror_template_to_canonical_paths(sftp)
            _mirror_css_to_canonical_paths(sftp)
            _mirror_mccabe_to_canonical_paths(sftp)
            _mirror_template266_theme_assets(sftp)
            if template_ok_any:
                print("PARAMIKO_OK (template + mirrors)", flush=True)
                return 0
            if _try_home_relative(sftp):
                print("PARAMIKO_OK (cwd-relative + mirrors)", flush=True)
                _mirror_template_to_canonical_paths(sftp)
                _mirror_css_to_canonical_paths(sftp)
                _mirror_mccabe_to_canonical_paths(sftp)
                _mirror_template266_theme_assets(sftp)
                return 0
            if _remote_template_matches_local(sftp):
                print("PARAMIKO_OK (remote template size matches local after mirrors)", flush=True)
                return 0
            print(
                "::error::PARAMIKO_FAIL no template_266.html write succeeded; "
                "remote stat did not match local file size",
                file=sys.stderr,
            )
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
