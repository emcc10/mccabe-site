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
    "vspfiles/my-boards.html",
    "vspfiles/boards/my-boards-boot.js",
    "vspfiles/boards/my-boards-page.js",
    "vspfiles/boards/board-styles.js",
    "vspfiles/boards/my-boards-page.css",
    "vspfiles/boards/my-boards-critical.css",
    "vspfiles/boards/my-boards-bundle.css",
    "vspfiles/boards/my-boards-fragment.html",
    "vspfiles/boards/session.php",
    "vspfiles/boards/list.php",
    "vspfiles/boards/save.php",
    "vspfiles/boards/delete.php",
    "vspfiles/boards/_auth.php",
)

OPTIONAL = (
    "vspfiles/css/custom-safe.css",
    "vspfiles/css/mc-live-patch.css",
    "vspfiles/css/mc-plp-body-last.css",
    "vspfiles/js/mc-plp-sofa-bounds.json",
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


def _showcase_remotes(name: str) -> list[str]:
    """Volusion chroot often serves under /v/vspfiles — try that path first."""
    seen: set[str] = set()
    out: list[str] = []
    for p in (
        f"/v/vspfiles/boards/showcase/{name}",
        f"/vspfiles/boards/showcase/{name}",
    ):
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def _ensure_remote_dir(sftp, remote: str) -> None:
    directory = remote.rsplit("/", 1)[0]
    if not directory:
        return
    parts = [p for p in directory.split("/") if p]
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except OSError:
            try:
                sftp.mkdir(cur)
            except OSError:
                pass


def _upload_chunked(sftp, local: str, remote: str, chunk_size: int = 16384) -> bool:
    """Volusion SFTP often truncates single-shot put() at 32 KiB for PNGs."""
    want = os.path.getsize(local)
    _ensure_remote_dir(sftp, remote)
    try:
        try:
            sftp.remove(remote)
        except OSError:
            pass
        with open(local, "rb") as src:
            with sftp.open(remote, "wb") as dst:
                dst.set_pipelined(True)
                while True:
                    buf = src.read(chunk_size)
                    if not buf:
                        break
                    dst.write(buf)
    except Exception as exc:  # noqa: BLE001
        print(f"::warning::CHUNK_PUT_SKIP {remote!r}: {exc}", flush=True)
        return False
    try:
        got = sftp.stat(remote).st_size
    except OSError:
        return False
    if got == want:
        print(f"::notice::PUT_OK_CHUNKED {local!r} -> {remote!r} size={want}", flush=True)
        return True
    print(
        f"::warning::SIZE_MISMATCH_CHUNKED {remote!r} want={want} got={got}",
        flush=True,
    )
    return False


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
    use_chunked_first = want > 31000 or local.lower().endswith(".png")
    last_exc: Exception | None = None
    for remote in paths:
        try:
            _ensure_remote_dir(sftp, remote)
            if use_chunked_first and _upload_chunked(sftp, local, remote):
                return True
            sftp.put(local, remote, confirm=False)
            got = sftp.stat(remote).st_size
            if got == want:
                print(f"::notice::PUT_OK {local!r} -> {remote!r} size={want}", flush=True)
                return True
            print(
                f"::warning::SIZE_MISMATCH {remote!r} want={want} got={got}",
                flush=True,
            )
            if got < want and _upload_chunked(sftp, local, remote):
                return True
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

            skip_photos = os.environ.get("SKIP_PLP_PHOTOS", "").strip() in ("1", "true", "yes")
            plp_photos = sorted(
                glob.glob("vspfiles/photos/*.jpg")
                + glob.glob("vspfiles/photos/*.jpeg")
                + glob.glob("vspfiles/photos/*.png")
            )
            if skip_photos:
                print(
                    f"::notice::SKIP_PLP_PHOTOS=1 — skipping {len(plp_photos)} PLP photo(s)",
                    flush=True,
                )
            elif plp_photos:
                print(f"::notice::PLP_PHOTOS uploading {len(plp_photos)} file(s)", flush=True)
            if not skip_photos:
                for local in plp_photos:
                    name = os.path.basename(local)
                    ok = _upload_one(sftp, local, _photo_remotes(name))
                    if not ok:
                        photo_fail += 1

            showcase = sorted(glob.glob("vspfiles/boards/showcase/*.png"))
            if showcase:
                print(
                    f"::notice::BOARDS_SHOWCASE uploading {len(showcase)} file(s)",
                    flush=True,
                )
            showcase_fail = 0
            for local in showcase:
                name = os.path.basename(local)
                ok = _upload_one(sftp, local, _showcase_remotes(name))
                if not ok:
                    showcase_fail += 1
            if showcase_fail:
                print(
                    f"::warning::{showcase_fail} boards showcase image(s) failed "
                    "(non-blocking — upload via Volusion File Manager if My Boards previews break)",
                    flush=True,
                )
                optional_fail += showcase_fail
        finally:
            sftp.close()
    finally:
        transport.close()

    if critical_fail:
        print(f"::error::{critical_fail} critical asset(s) failed", file=sys.stderr)
        return 1
    total_photos = len(glob.glob("vspfiles/photos/*"))
    if photo_fail and total_photos and photo_fail > max(5, total_photos // 10):
        print(
            f"::error::{photo_fail}/{total_photos} PLP photo(s) failed to upload",
            file=sys.stderr,
        )
        return 1
    if photo_fail:
        print(
            f"::warning::{photo_fail}/{total_photos} PLP photo(s) failed — "
            "gray mat may persist on those SKUs",
            flush=True,
        )
    if optional_fail:
        print(f"::warning::{optional_fail} optional asset(s) failed", flush=True)
    print("::notice::ASSETS_DEPLOY_OK", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
