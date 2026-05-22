#!/usr/bin/env python3
"""Verify vspfiles/css/custom-safe.css on Volusion SFTP (MD5 vs repo).

HTTP /v/vspfiles/css/custom-safe.css often lags SFTP/CDN; this is the deploy gate for CSS.
"""
from __future__ import annotations

import hashlib
import os
import re
import sys

from verify_template_sftp import connect_paramiko_transport, md5_hex


def css_needle() -> str:
    env = os.environ.get("CSS_NEEDLE", "").strip()
    if env:
        return env
    local = "vspfiles/css/custom-safe.css"
    if os.path.isfile(local):
        with open(local, encoding="utf-8", errors="replace") as f:
            head = f.read(400)
        m = re.search(r"C_CSS_DEPLOY_VERIFY_[0-9a-z]+", head)
        if m:
            return m.group(0)
    return "C_CSS_DEPLOY_VERIFY_20260527a"  # keep in sync with custom-safe.css line 1


def css_remote_paths() -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in (
        "/v/vspfiles/css/custom-safe.css",
        "/vspfiles/css/custom-safe.css",
        "vspfiles/css/custom-safe.css",
    ):
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    local_path = "vspfiles/css/custom-safe.css"
    needle = css_needle()
    if not os.path.isfile(local_path):
        print(f"::error::Missing {local_path}", file=sys.stderr)
        return 1

    with open(local_path, "rb") as handle:
        local_data = handle.read()
    local_md5 = md5_hex(local_data)
    want_size = len(local_data)

    host = os.environ.get("SFTP_HOST", "").strip() or os.environ.get("FTP_SERVER", "").strip()
    port = int(os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222")
    user = os.environ.get("SFTP_USER", "") or os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("SFTP_PASS", "") or os.environ.get("FTP_PASSWORD", "")

    if not host or not user or not password:
        print("::error::Missing SFTP credentials for custom-safe verify", file=sys.stderr)
        return 1

    try:
        transport = connect_paramiko_transport(host, port, user, password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::SFTP connect failed: {exc}", file=sys.stderr)
        return 1

    matched: list[str] = []
    try:
        import paramiko  # noqa: PLC0415

        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            print(
                f"::notice::Local custom-safe md5={local_md5} size={want_size} needle={needle!r}",
                flush=True,
            )
            for remote in css_remote_paths():
                try:
                    with sftp.open(remote, "rb") as handle:
                        remote_data = handle.read()
                except Exception as exc:  # noqa: BLE001
                    print(f"::warning::SKIP {remote!r}: {exc}", flush=True)
                    continue
                md5_ok = md5_hex(remote_data) == local_md5
                text = remote_data.decode("utf-8", errors="replace")
                needle_ok = needle in text
                ok = md5_ok or (len(remote_data) == want_size and needle_ok)
                print(
                    f"::notice::CHECK {remote!r} size={len(remote_data)} want={want_size} "
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
        print(f"::notice::SFTP custom-safe OK on: {', '.join(matched)}", flush=True)
        return 0

    print(
        f"::error::SFTP custom-safe does not match repo (md5={local_md5}, needle={needle!r}). "
        "Deploy did not update live CSS — re-run workflow or upload via Volusion File Manager.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
