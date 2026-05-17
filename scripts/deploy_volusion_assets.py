#!/usr/bin/env python3
"""Upload vspfiles assets via SFTP; verify remote size matches local."""
from __future__ import annotations

import os
import sys

ASSETS = (
    "vspfiles/css/custom-safe.css",
    "vspfiles/css/mc-live-patch.css",
    "vspfiles/js/mc-plp-enforcer.js",
    "vspfiles/js/mc-site-fix.js",
    "vspfiles/js/mtl-sectional-renderer.js",
    "vspfiles/js/sectional-configs.js",
    "vspfiles/templates/266/css/mccabe-overrides.css",
    "vspfiles/templates/266/js/min/design-toolkit.min.js",
    "vspfiles/templates/266/js/min/template.min.js",
)


def _remotes(rel: str) -> list[str]:
    rel = rel.replace("\\", "/")
    return [
        f"/v/{rel}",
        rel,
        f"/{rel}",
    ]


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))

    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.banner_timeout = 120
    try:
        transport.connect(username=user, password=password)
    except Exception as exc:  # noqa: BLE001
        print(f"::error::CONNECT_FAIL {exc}", file=sys.stderr)
        return 2

    failed = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::SFTP getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::getcwd: {exc}", flush=True)

            for local in ASSETS:
                if not os.path.isfile(local):
                    print(f"::warning::SKIP missing {local!r}", flush=True)
                    continue
                want = os.path.getsize(local)
                ok = False
                last_exc: Exception | None = None
                for remote in _remotes(local):
                    try:
                        sftp.put(local, remote, confirm=False)
                        got = sftp.stat(remote).st_size
                        if got == want:
                            print(
                                f"::notice::PUT_OK {local!r} -> {remote!r} size={want}",
                                flush=True,
                            )
                            ok = True
                            break
                        print(
                            f"::warning::SIZE_MISMATCH {remote!r} want={want} got={got}",
                            flush=True,
                        )
                        last_exc = None
                    except Exception as exc:  # noqa: BLE001
                        last_exc = exc
                        print(f"::warning::PUT_SKIP {remote!r}: {exc}", flush=True)
                if not ok:
                    failed += 1
                    msg = last_exc or "no remote path accepted upload with matching size"
                    print(f"::error::FAIL {local!r}: {msg}", file=sys.stderr)
        finally:
            sftp.close()
    finally:
        transport.close()

    if failed:
        print(f"::error::{failed} asset(s) failed upload verification", file=sys.stderr)
        return 1
    print("::notice::ASSETS_DEPLOY_OK", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
