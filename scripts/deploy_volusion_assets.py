#!/usr/bin/env python3
"""Upload vspfiles assets via SFTP; verify remote size matches local."""
from __future__ import annotations

import glob
import os
import sys

VOLUSION_JS_CAP = 131072

CRITICAL = (
    "vspfiles/templates/266/js/min/design-toolkit.min.js",
    "vspfiles/js/mc-plp-enforcer.js",
    "vspfiles/templates/266/js/mc-plp-enforcer.js",
)

OPTIONAL = (
    "vspfiles/css/custom-safe.css",
    "vspfiles/css/mc-live-patch.css",
    "vspfiles/css/mc-plp-body-last.css",
    "vspfiles/js/mc-site-fix.js",
    "vspfiles/templates/266/css/mccabe-overrides.css",
    "vspfiles/js/sectional-configs.js",
)

SKIP_OVER_CAP = (
    "vspfiles/js/mtl-sectional-renderer.js",
    "vspfiles/templates/266/js/min/template.min.js",
)


def _remotes(rel: str) -> list[str]:
    rel = rel.replace("\\", "/")
    paths = [f"/vspfiles/{rel.split('vspfiles/', 1)[-1]}" if "vspfiles/" in rel else rel]
    paths.extend([f"/v/{rel}", rel, f"/{rel}"])
    if rel.startswith("vspfiles/templates/266/js/min/"):
        name = rel.rsplit("/", 1)[-1]
        paths.append(f"/vspfiles/templates/266/js/min/{name}")
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _photo_remotes(name: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for p in (
        f"/vspfiles/photos/{name}",
        f"/v/vspfiles/photos/{name}",
        f"/mccabestheaterandliving.com/v/vspfiles/photos/{name}",
        f"vspfiles/photos/{name}",
    ):
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _upload_one(sftp, local: str, remotes: list[str] | None = None) -> bool:
    want = os.path.getsize(local)
    if local.replace("\\", "/") in {p.replace("\\", "/") for p in SKIP_OVER_CAP}:
        if want > VOLUSION_JS_CAP:
            print(
                f"::notice::SKIP_CAP {local!r} size={want} — over Volusion "
                f"{VOLUSION_JS_CAP}-byte SFTP limit (expected; not uploaded)",
                flush=True,
            )
            return True

    paths = remotes if remotes is not None else _remotes(local)
    last_exc: Exception | None = None
    for remote in paths:
        try:
            sftp.put(local, remote, confirm=False)
            got = sftp.stat(remote).st_size
            if got == want:
                print(f"::notice::PUT_OK {local!r} -> {remote!r} size={want}", flush=True)
                return True
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
    photo_fail = 0
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

            plp_photos = sorted(
                glob.glob("vspfiles/photos/*.jpg")
                + glob.glob("vspfiles/photos/*.jpeg")
                + glob.glob("vspfiles/photos/*.png")
            )
            if plp_photos:
                print(f"::notice::PLP_PHOTOS uploading {len(plp_photos)} file(s)", flush=True)
            for local in plp_photos:
                name = os.path.basename(local)
                ok = _upload_one(sftp, local, _photo_remotes(name))
                if not ok:
                    photo_fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    if critical_fail:
        print(f"::error::{critical_fail} critical asset(s) failed", file=sys.stderr)
        return 1
    if photo_fail:
        print(f"::error::{photo_fail} PLP photo(s) failed to upload", file=sys.stderr)
        return 1
    if optional_fail:
        print(f"::warning::{optional_fail} optional asset(s) failed", flush=True)
    print("::notice::ASSETS_DEPLOY_OK", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
