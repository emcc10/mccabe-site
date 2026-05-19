#!/usr/bin/env python3
"""Verify template_266.html on Volusion SFTP (source of truth for deploy).

The public URL /v/template_266.html is often stale (CDN or Volusion DB copy) while SFTP
has the new file. CI must pass when SFTP contains the expected marker, not only HTTP.
"""
from __future__ import annotations

import os
import re
import sys


def _paths() -> list[str]:
    secret = os.environ.get("SFTP_TEMPLATE_REMOTE", "").strip()
    if secret and not secret.startswith("/") and not secret.startswith("v/"):
        secret = "/v/" + secret.lstrip("/")
    if secret in ("v/v/template_266.html", "/v/v/template_266.html"):
        secret = "/v/template_266.html"
    out: list[str] = []
    seen: set[str] = set()
    for p in (
        secret,
        "/v/template_266.html",
        "template_266.html",
        "v/template_266.html",
        "/mccabestheaterandliving.com/v/template_266.html",
        "/template_266.html",
    ):
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _needle() -> str:
    env = os.environ.get("TEMPLATE_NEEDLE", "").strip()
    if env:
        return env
    local = "template_266.html"
    if os.path.isfile(local):
        with open(local, encoding="utf-8", errors="replace") as f:
            raw = f.read()
        m = re.search(r"mc-plp-enforcer\.js\?v=[0-9]+", raw)
        if m:
            return m.group(0)
    return ""


def _tail_contains(sftp, remote: str, needle: str, tail_bytes: int = 131072) -> tuple[bool, int]:
    st = sftp.stat(remote)
    size = int(st.st_size)
    start = max(0, size - tail_bytes)
    with sftp.open(remote, "rb") as handle:
        if start:
            handle.seek(start)
        blob = handle.read().decode("utf-8", errors="replace")
    return needle in blob, size


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    needle = _needle()
    if not needle:
        print("::error::No TEMPLATE_NEEDLE or mc-plp-enforcer tag in template_266.html", file=sys.stderr)
        return 1
    if not os.path.isfile("template_266.html"):
        print("::error::Missing template_266.html", file=sys.stderr)
        return 1

    want_size = os.path.getsize("template_266.html")
    host = (
        os.environ.get("SFTP_HOST", "").strip()
        or os.environ.get("FTP_SERVER", "").strip()
    )
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "") or os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("SFTP_PASS", "") or os.environ.get("FTP_PASSWORD", "")

    if not host or not user or not password:
        print("::error::Missing SFTP credentials for template verify", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP connect failed: {exc}", file=sys.stderr)
        return 1

    matched: list[str] = []
    sized: list[str] = []
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::SFTP getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::getcwd: {exc}", flush=True)

            for remote in _paths():
                try:
                    has_needle, size = _tail_contains(sftp, remote, needle)
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::SKIP {remote!r}: {exc}", flush=True)
                    continue
                size_ok = size == want_size
                print(
                    f"::notice::CHECK {remote!r} size={size} want={want_size} "
                    f"needle={'yes' if has_needle else 'no'}",
                    flush=True,
                )
                if size_ok:
                    sized.append(remote)
                if has_needle:
                    matched.append(remote)
        finally:
            try:
                sftp.close()
            except Exception:
                pass
    finally:
        transport.close()

    if matched:
        print(
            f"::notice::SFTP template OK — {needle!r} on: {', '.join(matched)}",
            flush=True,
        )
        if not sized:
            print(
                "::warning::SFTP size mismatch vs local (needle present) — "
                "file may be partial or wrong path duplicated",
                flush=True,
            )
        return 0

    print(
        f"::error::SFTP template missing {needle!r} on all paths. "
        f"Tried: {', '.join(_paths())}",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
