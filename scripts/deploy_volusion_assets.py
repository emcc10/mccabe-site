#!/usr/bin/env python3
"""Upload vspfiles assets via SFTP; verify remote size matches local."""
from __future__ import annotations

import os
import sys

# Volusion SFTP truncates many files under /vspfiles/js/ to 131072 bytes (128 KiB).
VOLUSION_JS_CAP = 131072

# Must succeed for category PLP fix (design-toolkit has inlined enforcer).
CRITICAL = (
    "vspfiles/templates/266/js/min/design-toolkit.min.js",
    "vspfiles/js/mc-plp-enforcer.js",
)

# Upload if possible; failure is a warning (size cap or path).
OPTIONAL = (
    "vspfiles/css/custom-safe.css",
    "vspfiles/css/mc-live-patch.css",
    "vspfiles/js/mc-site-fix.js",
    "vspfiles/templates/266/css/mccabe-overrides.css",
    "vspfiles/js/sectional-configs.js",
)

# Over 128 KiB on /vspfiles/js/ — cannot upload via SFTP without truncation; skip.
SKIP_OVER_CAP = (
    "vspfiles/js/mtl-sectional-renderer.js",
    "vspfiles/templates/266/js/min/template.min.js",
)


def _remotes(rel: str) -> list[str]:
    rel = rel.replace("\\", "/")
    paths = [f"/v/{rel}", rel, f"/{rel}"]
    if rel.startswith("vspfiles/templates/266/js/min/"):
        name = rel.rsplit("/", 1)[-1]
        paths.append(f"/vspfiles/templates/266/js/min/{name}")
    return paths


def _upload_one(sftp, local: str) -> bool:
    want = os.path.getsize(local)
    if local.replace("\\", "/") in {p.replace("\\", "/") for p in SKIP_OVER_CAP}:
        if want > VOLUSION_JS_CAP:
            print(
                f"::notice::SKIP_CAP {local!r} size={want} — over Volusion "
                f"{VOLUSION_JS_CAP}-byte SFTP limit (expected; not uploaded)",
                flush=True,
            )
            return True

    last_exc: Exception | None = None
    for remote in _remotes(local):
        try:
            sftp.put(local, remote, confirm=False)
            got = sftp.stat(remote).st_size
            if got == want:
                print(f"::notice::PUT_OK {local!r} -> {remote!r} size={want}", flush=True)
                return True
            if got == VOLUSION_JS_CAP and want > VOLUSION_JS_CAP:
                print(
                    f"::warning::TRUNCATED {remote!r} at {VOLUSION_JS_CAP} bytes "
                    f"(local {want}) — Volusion 128 KiB cap",
                    flush=True,
                )
            else:
                print(
                    f"::warning::SIZE_MISMATCH {remote!r} want={want} got={got}",
                    flush=True,
                )
            last_exc = None
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            print(f"::warning::PUT_SKIP {remote!r}: {exc}", flush=True)
    if last_exc:
        print(f"::error::FAIL {local!r}: {last_exc}", file=sys.stderr)
    else:
        print(f"::error::FAIL {local!r}: no remote path with matching size", file=sys.stderr)
    return False


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

    critical_fail = 0
    optional_fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            try:
                print(f"::notice::SFTP getcwd={sftp.getcwd()!r}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"::notice::getcwd: {exc}", flush=True)

            for local in CRITICAL + OPTIONAL + SKIP_OVER_CAP:
                if not os.path.isfile(local):
                    print(f"::warning::SKIP missing {local!r}", flush=True)
                    continue
                ok = _upload_one(sftp, local)
                if not ok:
                    if local in CRITICAL:
                        critical_fail += 1
                    elif local not in SKIP_OVER_CAP:
                        optional_fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    if critical_fail:
        print(f"::error::{critical_fail} critical asset(s) failed", file=sys.stderr)
        return 1
    if optional_fail:
        print(f"::warning::{optional_fail} optional asset(s) failed", flush=True)
    print("::notice::ASSETS_DEPLOY_OK", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
