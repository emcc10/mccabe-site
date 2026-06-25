#!/usr/bin/env python3
"""Stat restore files on every Volusion SFTP path the deploy scripts use.

FileZilla may show /v/vspfiles/... while the web URL /v/vspfiles/... maps to a
different physical path (chroot at /v). This script finds which remote path has
the expected byte size.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "deploy" / "manual-sftp-restore-20260625"

CHECKS = (
    (
        "template.min.js",
        BUNDLE / "vspfiles/templates/266/js/min/template.min.js",
        (
            "/v/vspfiles/templates/266/js/min/template.min.js",
            "vspfiles/templates/266/js/min/template.min.js",
            "/vspfiles/templates/266/js/min/template.min.js",
            "v/vspfiles/templates/266/js/min/template.min.js",
            "/v/v/vspfiles/templates/266/js/min/template.min.js",
            "/mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/template.min.js",
        ),
    ),
    (
        "SAR-MNKY-LUSH-1.jpg",
        BUNDLE / "vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
        (
            "/v/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
            "vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
            "/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
            "v/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
            "/v/v/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
            "/mccabestheaterandliving.com/v/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
        ),
    ),
    (
        "mc-plp-enforcer.js (control)",
        BUNDLE / "vspfiles/js/mc-plp-enforcer.js",
        (
            "/v/vspfiles/js/mc-plp-enforcer.js",
            "vspfiles/js/mc-plp-enforcer.js",
            "/vspfiles/js/mc-plp-enforcer.js",
            "v/vspfiles/js/mc-plp-enforcer.js",
            "/v/v/vspfiles/js/mc-plp-enforcer.js",
        ),
    ),
)


def _stat_all(sftp, path: str) -> tuple[int | None, str | None]:
    try:
        return sftp.stat(path).st_size, None
    except OSError as exc:
        return None, str(exc)


def main() -> int:
    host = (os.environ.get("SFTP_HOST") or os.environ.get("FTP_SERVER") or "").strip()
    user = (os.environ.get("SFTP_USER") or os.environ.get("FTP_USERNAME") or "").strip()
    password = (os.environ.get("SFTP_PASS") or os.environ.get("FTP_PASSWORD") or "").strip()
    port = int((os.environ.get("SFTP_PORT") or os.environ.get("FTP_PORT") or "2222").strip())

    if not host or not user or not password:
        print("Set FTP_SERVER, FTP_USERNAME, FTP_PASSWORD then re-run.", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.banner_timeout = 120
    transport.connect(username=user, password=password)
    fails = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"SFTP getcwd={sftp.getcwd()!r}")
            except Exception as exc:  # noqa: BLE001
                print(f"SFTP getcwd: {exc}")

            for list_path in (".", "/", "v", "/v", "vspfiles", "/vspfiles", "/v/vspfiles"):
                try:
                    names = sorted(x.filename for x in sftp.listdir_attr(list_path))[:12]
                    print(f"listdir {list_path!r}: {names}")
                except Exception as exc:  # noqa: BLE001
                    print(f"listdir {list_path!r}: {exc}")

            print()
            for label, local, remotes in CHECKS:
                if not local.is_file():
                    print(f"::error::missing local {local}")
                    fails += 1
                    continue
                want = local.stat().st_size
                print(f"=== {label} (want {want} bytes) ===")
                hits: list[str] = []
                for remote in remotes:
                    got, err = _stat_all(sftp, remote)
                    if got is None:
                        print(f"  MISSING {remote!r} ({err})")
                    else:
                        mark = "OK" if got == want else "WRONG_SIZE"
                        print(f"  {mark:10} {remote!r} size={got}")
                        if got == want:
                            hits.append(remote)
                if not hits:
                    print(f"  ::error::No SFTP path has {want} bytes for {label}")
                    fails += 1
                elif len(hits) > 1:
                    print(f"  note: duplicate copies at {hits!r}")
                print()

            print("HTTP (what the storefront loads — no cache bust):")
            import urllib.request

            for url in (
                "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/template.min.js",
                "https://www.mccabestheaterandliving.com/v/vspfiles/photos/SAR-MNKY-LUSH-1.jpg",
                "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js",
            ):
                try:
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "McCabe SFTP verify"}
                    )
                    with urllib.request.urlopen(req, timeout=60) as resp:
                        body = resp.read()
                    print(f"  {resp.status} len={len(body)} {url}")
                except Exception as exc:  # noqa: BLE001
                    print(f"  FAIL {url}: {exc}")

            if fails:
                print(
                    "\nIf files exist only under /v/v/vspfiles/... or v/vspfiles/..., "
                    "move them to the path that matches HTTP (usually vspfiles/... at SFTP login root)."
                )
            return 1 if fails else 0
        finally:
            sftp.close()
    finally:
        transport.close()


if __name__ == "__main__":
    sys.exit(main())
