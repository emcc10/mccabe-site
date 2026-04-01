#!/usr/bin/env python3
"""
After deploy, download remote template_266.html via SFTP and confirm it contains the same
mc-deploy-verify marker as the local checkout.

Use this instead of HTTP checks: Volusion often serves stale cached HTML while the uploaded
file on SFTP is already correct.
"""
from __future__ import annotations

import os
import re
import sys
import tempfile


def _extract_verify_marker(raw: str) -> str:
    """Match meta tag regardless of attribute order or quote style."""
    for pat in (
        r'name=["\']mc-deploy-verify["\']\s+content=["\']([^"\']+)["\']',
        r'content=["\']([^"\']+)["\'][^>]*name=["\']mc-deploy-verify["\']',
    ):
        m = re.search(pat, raw, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def _template_paths_to_try() -> list[str]:
    secret = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret and not secret.startswith("/"):
        secret = "/" + secret
    if secret == "/v/v/template_266.html":
        secret = "/v/template_266.html"
    raw = [
        secret,
        "/template_266.html",
        "/v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "template_266.html",
    ]
    seen: set[str] = set()
    out: list[str] = []
    for p in raw:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _expect_from_local(ws: str) -> str:
    path = os.path.join(ws, "template_266.html")
    with open(path, encoding="utf-8", errors="replace") as f:
        raw = f.read()
    return _extract_verify_marker(raw)


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
            for remote in _template_paths_to_try():
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".html")
                tmp.close()
                local = tmp.name
                try:
                    sftp.get(remote, local)
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::SFTP get skip {remote!r}: {exc}", flush=True)
                    try:
                        os.unlink(local)
                    except OSError:
                        pass
                    continue
                try:
                    with open(local, encoding="utf-8", errors="replace") as f:
                        got = _extract_verify_marker(f.read())
                finally:
                    try:
                        os.unlink(local)
                    except OSError:
                        pass

                if got == expect:
                    print(
                        f"::notice::Remote template matches checkout (mc-deploy-verify={expect}) "
                        f"via SFTP path {remote!r}.",
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
        f"matching {expect!r}. Upload may have failed or paths differ from volusion_sftp_deploy.py.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
