#!/usr/bin/env python3
"""Verify template_266.html on Volusion SFTP (source of truth for deploy).

The public URL /v/template_266.html is often stale (CDN or Volusion DB copy) while SFTP
has the new file. CI must pass when SFTP bytes match the repo file (MD5), not only size.
"""
from __future__ import annotations

import hashlib
import os
import re
import sys


def template_remote_paths() -> list[str]:
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


def template_needle() -> str:
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


def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def read_local_template() -> bytes:
    with open("template_266.html", "rb") as handle:
        return handle.read()


def read_remote_template(sftp, remote: str) -> bytes:
    with sftp.open(remote, "rb") as handle:
        return handle.read()


def check_remote(
    sftp,
    remote: str,
    local_data: bytes,
    local_md5: str,
    needle: str,
) -> tuple[bool, int, bool, bool]:
    """Return (ok, remote_size, md5_match, needle_present)."""
    remote_data = read_remote_template(sftp, remote)
    remote_size = len(remote_data)
    md5_match = md5_hex(remote_data) == local_md5
    text = remote_data.decode("utf-8", errors="replace")
    needle_present = bool(needle and needle in text)
    ok = md5_match or (remote_size == len(local_data) and needle_present)
    return ok, remote_size, md5_match, needle_present


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    needle = template_needle()
    if not needle:
        print(
            "::error::No TEMPLATE_NEEDLE or mc-plp-enforcer tag in template_266.html",
            file=sys.stderr,
        )
        return 1
    if not os.path.isfile("template_266.html"):
        print("::error::Missing template_266.html", file=sys.stderr)
        return 1

    local_data = read_local_template()
    local_md5 = md5_hex(local_data)
    want_size = len(local_data)

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
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::SFTP getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::getcwd: {exc}", flush=True)

            print(
                f"::notice::Local template md5={local_md5} size={want_size} needle={needle!r}",
                flush=True,
            )

            for remote in template_remote_paths():
                try:
                    ok, size, md5_ok, needle_ok = check_remote(
                        sftp, remote, local_data, local_md5, needle
                    )
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::SKIP {remote!r}: {exc}", flush=True)
                    continue
                print(
                    f"::notice::CHECK {remote!r} size={size} want={want_size} "
                    f"md5={'yes' if md5_ok else 'no'} needle={'yes' if needle_ok else 'no'}",
                    flush=True,
                )
                if ok:
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
            f"::notice::SFTP template OK — md5/needle on: {', '.join(matched)}",
            flush=True,
        )
        return 0

    print(
        f"::error::SFTP template does not match repo (md5={local_md5}, needle={needle!r}). "
        f"Tried: {', '.join(template_remote_paths())}. "
        "Volusion may be serving a stale copy at the same byte size — re-run deploy or "
        "upload template_266.html via Volusion File Editor.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
