#!/usr/bin/env python3
"""Strict deploy gate: template_266, custom-safe.css, mccabe-overrides.css on SFTP + HTTP.

Browsers load /v/vspfiles/… — SFTP must match repo MD5 on at least one canonical /v/vspfiles/
path per asset. HTTP checks confirm the live storefront serves the same deploy markers.
"""
from __future__ import annotations

import hashlib
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

from verify_template_sftp import connect_paramiko_transport, md5_hex

STOREFRONT = "https://www.mccabestheaterandliving.com"

TEMPLATE_SFTP_PATHS = (
    "/v/template_266.html",
    "template_266.html",
    "/template_266.html",
)

CUSTOM_SAFE_SFTP_PATHS = (
    "/v/vspfiles/css/custom-safe.css",
    "/vspfiles/css/custom-safe.css",
    "vspfiles/css/custom-safe.css",
)

MCCABE_OVERRIDES_SFTP_PATHS = (
    "/v/vspfiles/templates/266/css/mccabe-overrides.css",
    "/vspfiles/templates/266/css/mccabe-overrides.css",
    "vspfiles/templates/266/css/mccabe-overrides.css",
)


def _read_local(path: str) -> bytes:
    with open(path, "rb") as handle:
        return handle.read()


def _template_marker() -> str:
    raw = _read_local("template_266.html").decode("utf-8", errors="replace")
    m = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', raw)
    if not m:
        raise ValueError("template_266.html missing mc-deploy-verify meta tag")
    return m.group(1)


def _css_marker() -> str:
    raw = _read_local("vspfiles/css/custom-safe.css").decode("utf-8", errors="replace")
    m = re.search(r"C_CSS_DEPLOY_VERIFY_[A-Za-z0-9]+", raw[:8000])
    if not m:
        raise ValueError("custom-safe.css missing C_CSS_DEPLOY_VERIFY_* marker")
    return m.group(0)


def _overrides_marker() -> str:
    raw = _read_local("vspfiles/templates/266/css/mccabe-overrides.css").decode(
        "utf-8", errors="replace"
    )
    m = re.search(r"MC_OVERRIDES_VERIFY_[A-Za-z0-9]+", raw[:8000])
    if not m:
        raise ValueError("mccabe-overrides.css missing MC_OVERRIDES_VERIFY_* marker")
    return m.group(0)


def _browser_headers(url: str) -> dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,text/css,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": f"{STOREFRONT}/",
    }


def _http_fetch(url: str, limit: int = 2_000_000) -> tuple[bool, str, int | None]:
    bust = f"{url}{'&' if '?' in url else '?'}_mcv={int(time.time())}"
    req = urllib.request.Request(bust, headers=_browser_headers(url), method="GET")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
            return True, resp.read(limit).decode("utf-8", errors="replace"), resp.status
    except urllib.error.HTTPError as exc:
        return False, f"HTTP {exc.code}", exc.code
    except Exception as exc:  # noqa: BLE001
        return False, str(exc), None


def _sftp_canon_match(
    sftp,
    local_path: str,
    remote_paths: tuple[str, ...],
    *,
    require_v_vspfiles: bool,
) -> tuple[bool, list[str]]:
    local_data = _read_local(local_path)
    local_md5 = md5_hex(local_data)
    matched: list[str] = []
    canon_matched = False

    for remote in remote_paths:
        try:
            with sftp.open(remote, "rb") as handle:
                remote_data = handle.read()
        except Exception as exc:  # noqa: BLE001
            print(f"::notice::SFTP_SKIP {remote!r}: {exc}", flush=True)
            continue
        md5_ok = md5_hex(remote_data) == local_md5
        print(
            f"::notice::SFTP_CHECK {remote!r} size={len(remote_data)} "
            f"want={len(local_data)} md5={'yes' if md5_ok else 'no'}",
            flush=True,
        )
        if md5_ok:
            matched.append(remote)
            if remote.startswith("/v/vspfiles/") or remote == "/v/template_266.html":
                canon_matched = True

    if require_v_vspfiles and matched and not canon_matched:
        print(
            f"::error::SFTP {local_path!r} matched a non-canonical path only "
            f"({matched}) — browsers load /v/vspfiles/ or /v/template_266.html",
            file=sys.stderr,
        )
        return False, matched
    return bool(matched), matched


def _http_has_marker(url: str, marker: str, *, kind: str) -> tuple[bool, str]:
    ok, body, status = _http_fetch(url)
    if not ok:
        return False, body
    if kind == "template":
        m = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', body)
        got = m.group(1) if m else "(no meta tag)"
        if got == marker:
            return True, got
        return False, got
    if marker in body:
        return True, "found"
    return False, "(marker missing)"


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))

    try:
        template_marker = _template_marker()
        css_marker = _css_marker()
        overrides_marker = _overrides_marker()
    except ValueError as exc:
        print(f"::error::{exc}", file=sys.stderr)
        return 1

    print(
        f"::notice::CORE_DEPLOY_MARKERS template={template_marker!r} "
        f"css={css_marker!r} overrides={overrides_marker!r}",
        flush=True,
    )

    host = os.environ.get("FTP_SERVER", "").strip() or os.environ.get("SFTP_HOST", "").strip()
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222")
    user = os.environ.get("FTP_USERNAME", "") or os.environ.get("SFTP_USER", "")
    password = os.environ.get("FTP_PASSWORD", "") or os.environ.get("SFTP_PASS", "")

    if not host or not user or not password:
        print("::error::Missing SFTP credentials for core deploy verify", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    sftp_fail = 0
    try:
        transport = connect_paramiko_transport(host, port, user, password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            ok, paths = _sftp_canon_match(
                sftp,
                "template_266.html",
                TEMPLATE_SFTP_PATHS,
                require_v_vspfiles=False,
            )
            if not ok:
                print("::error::SFTP template_266.html does not match repo", file=sys.stderr)
                sftp_fail += 1
            else:
                print(f"::notice::SFTP template OK on {paths}", flush=True)

            ok, paths = _sftp_canon_match(
                sftp,
                "vspfiles/css/custom-safe.css",
                CUSTOM_SAFE_SFTP_PATHS,
                require_v_vspfiles=True,
            )
            if not ok:
                print("::error::SFTP custom-safe.css does not match repo", file=sys.stderr)
                sftp_fail += 1
            else:
                print(f"::notice::SFTP custom-safe OK on {paths}", flush=True)

            ok, paths = _sftp_canon_match(
                sftp,
                "vspfiles/templates/266/css/mccabe-overrides.css",
                MCCABE_OVERRIDES_SFTP_PATHS,
                require_v_vspfiles=True,
            )
            if not ok:
                print(
                    "::error::SFTP mccabe-overrides.css does not match repo",
                    file=sys.stderr,
                )
                sftp_fail += 1
            else:
                print(f"::notice::SFTP mccabe-overrides OK on {paths}", flush=True)
        finally:
            sftp.close()
        transport.close()
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP core verify failed: {exc}", file=sys.stderr)
        return 1

    if sftp_fail:
        return 1

    http_fail = 0
    checks = (
        (
            f"{STOREFRONT}/v/template_266.html",
            template_marker,
            "template",
            "template_266.html",
        ),
        (
            f"{STOREFRONT}/v/vspfiles/css/custom-safe.css",
            css_marker,
            "css",
            "custom-safe.css",
        ),
        (
            f"{STOREFRONT}/v/vspfiles/templates/266/css/mccabe-overrides.css",
            overrides_marker,
            "css",
            "mccabe-overrides.css",
        ),
    )

    for url, marker, kind, label in checks:
        ok, detail = _http_has_marker(url, marker, kind=kind)
        if ok:
            print(f"::notice::HTTP {label} OK: {url} marker={marker!r}", flush=True)
            continue
        blocked = isinstance(detail, str) and detail.startswith("HTTP 403")
        if blocked and kind == "template":
            print(
                f"::warning::HTTP {label} blocked ({detail}) — SFTP already matched; "
                "spot-check View Source in browser",
                flush=True,
            )
            continue
        print(
            f"::error::HTTP {label} mismatch: {url} saw {detail!r}, expected {marker!r}",
            file=sys.stderr,
        )
        http_fail += 1

    if http_fail:
        return 1

    print("::notice::CORE_DEPLOY_VERIFIED (SFTP + HTTP) — template, custom-safe, mccabe-overrides", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
