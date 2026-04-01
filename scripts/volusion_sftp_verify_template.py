#!/usr/bin/env python3
"""
After deploy, download remote template_266.html via SFTP and confirm it contains the same
mc-deploy-verify marker as the local checkout.

Volusion serves the theme at https://store.com/v/template_266.html — that maps to SFTP
/v/template_266.html, NOT necessarily the same file as /template_266.html at account root.
We must verify /v/ first when that file exists, or a green check can lie.
"""
from __future__ import annotations

import os
import re
import sys
import tempfile

# Paths that match the live browser URL …/v/template_266.html (wwwroot v/)
_CANONICAL_V_PATHS: tuple[str, ...] = (
    "/v/template_266.html",
    "/mccabestheaterandliving.com/v/template_266.html",
)


def _expect_from_local(ws: str) -> str:
    path = os.path.join(ws, "template_266.html")
    with open(path, encoding="utf-8", errors="replace") as f:
        raw = f.read()
    m = re.search(r'name="mc-deploy-verify"\s+content="([^"]+)"', raw)
    return m.group(1) if m else ""


def _normalize_secret_template_path() -> str:
    secret = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret and not secret.startswith("/"):
        secret = "/" + secret
    if secret == "/v/v/template_266.html":
        secret = "/v/template_266.html"
    return secret


def _download_marker(sftp, remote: str) -> str | None:
    """Return marker string, or None if file missing/unreadable."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
    tmp.close()
    local = tmp.name
    try:
        sftp.get(remote, local)
    except Exception:  # noqa: BLE001
        try:
            os.unlink(local)
        except OSError:
            pass
        return None
    try:
        with open(local, encoding="utf-8", errors="replace") as f:
            m = re.search(
                r'name="mc-deploy-verify"\s+content="([^"]+)"',
                f.read(),
            )
        return m.group(1) if m else ""
    finally:
        try:
            os.unlink(local)
        except OSError:
            pass


def _fallback_paths() -> list[str]:
    secret = _normalize_secret_template_path()
    raw = [secret, "/template_266.html", "template_266.html"]
    seen: set[str] = set(_CANONICAL_V_PATHS)
    out: list[str] = []
    for p in raw:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def main() -> int:
    ws = os.environ.get("GITHUB_WORKSPACE", ".")
    os.chdir(ws)

    expect = _expect_from_local(ws)
    if not expect:
        print("::notice::No mc-deploy-verify in template; skipping remote SFTP verify.")
        return 0

    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("SECRET_SFTP_HOST", "").strip()
        or os.environ.get("SECRET_FTP_HOST", "").strip()
    )
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("SECRET_SFTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "")
    password = os.environ.get("SFTP_PASS", "")

    if not host or not user or not password:
        print("::error::Missing SFTP env (host, user, pass) for verify step.", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP verify connect failed: {exc}", file=sys.stderr)
        return 1

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for remote in _CANONICAL_V_PATHS:
                got = _download_marker(sftp, remote)
                if got is None:
                    print(f"::notice::No file at {remote!r} (skipped).", flush=True)
                    continue
                if got == expect:
                    print(
                        f"::notice::Remote template matches checkout (mc-deploy-verify={expect}) "
                        f"via SFTP path {remote!r} (live /v/ path).",
                        flush=True,
                    )
                    return 0
                print(
                    "::error::Live theme path "
                    f"{remote!r} has mc-deploy-verify={got!r}, expected {expect!r}. "
                    "SFTP root /template_266.html may be updated but the store reads "
                    "/v/template_266.html — fix deploy paths or SFTP_TEMPLATE_REMOTE.",
                    file=sys.stderr,
                )
                return 1

            print(
                "::warning::No template at /v/... paths; falling back to SFTP root paths "
                "(confirm FileZilla: live theme file may differ).",
                flush=True,
            )
            for remote in _fallback_paths():
                got = _download_marker(sftp, remote)
                if got is None:
                    print(f"::warning::SFTP get skip {remote!r}", flush=True)
                    continue
                if got == expect:
                    print(
                        f"::notice::Remote template matches checkout (mc-deploy-verify={expect}) "
                        f"via SFTP path {remote!r} (fallback; /v/ path not found).",
                        flush=True,
                    )
                    return 0
                print(
                    f"::warning::Path {remote!r} has mc-deploy-verify={got!r}, expected {expect!r}.",
                    flush=True,
                )
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()

    print(
        "::error::Could not confirm remote template: no SFTP path returned mc-deploy-verify "
        f"matching {expect!r}. Upload may have failed or paths differ.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
