#!/usr/bin/env python3
"""Force-upload My Boards files to /v/vspfiles/ only (browser URL path).

Volusion often updates /vspfiles/ but leaves /v/vspfiles/ stale. New filenames
(e.g. my-boards-app.js) may 404 on HTTP — overwrite existing names like my-boards-page.js.
"""
from __future__ import annotations

import glob
import os
import sys

BOARDS_FILES = (
    "vspfiles/my-boards.html",
    "vspfiles/boards/my-boards-page.js",
    "vspfiles/boards/board-styles.js",
    "vspfiles/boards/my-boards-page.css",
    "vspfiles/boards/my-boards-critical.css",
    "vspfiles/boards/my-boards-bundle.css",
    "vspfiles/boards/my-boards-boot.js",
    "vspfiles/boards/my-boards-fragment.html",
    "vspfiles/boards/session.php",
    "vspfiles/boards/list.php",
    "vspfiles/boards/save.php",
    "vspfiles/boards/delete.php",
    "vspfiles/boards/_auth.php",
)

# local path, remote path (when remote differs — fixed app bytes onto legacy URL)
ALIASES = (
    ("vspfiles/boards/my-boards-page.js", "/v/vspfiles/boards/my-boards-page.js"),
)

MUST_MATCH = (
    ("vspfiles/my-boards.html", None, b"renderInline"),
    ("vspfiles/boards/my-boards-page.js", "/v/vspfiles/boards/my-boards-page.js", b"__MC_BOARDS_APP_V2"),
    ("vspfiles/boards/board-styles.js", None, b"ensureShellIds"),
    ("vspfiles/boards/my-boards-bundle.css", None, b"mc-boards__feature"),
)


def canonical_remote(local: str) -> str:
    local = local.replace("\\", "/")
    sub = local.split("vspfiles/", 1)[-1]
    return f"/v/vspfiles/{sub}"


def ensure_dir(sftp, remote: str) -> None:
    directory = remote.rsplit("/", 1)[0]
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


def force_put(sftp, local: str, remote: str, chunk_size: int = 16384) -> bool:
    want = os.path.getsize(local)
    ensure_dir(sftp, remote)
    for attempt in range(1, 5):
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
            got = sftp.stat(remote).st_size
            if got == want:
                print(
                    f"::notice::BOARDS_CANON_OK {local!r} -> {remote!r} size={want}",
                    flush=True,
                )
                return True
            print(
                f"::warning::BOARDS_CANON_SIZE attempt={attempt} {remote!r} "
                f"want={want} got={got}",
                flush=True,
            )
        except Exception as exc:  # noqa: BLE001
            print(
                f"::warning::BOARDS_CANON_TRY attempt={attempt} {remote!r}: {exc}",
                flush=True,
            )
    return False


def sftp_verify(sftp, remote: str, want_size: int, needle: bytes) -> bool:
    try:
        with sftp.open(remote, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        print(f"::warning::BOARDS_SFTP_READ {remote!r}: {exc}", flush=True)
        return False
    ok_size = len(data) == want_size
    ok_needle = needle in data
    print(
        f"::notice::BOARDS_SFTP_VERIFY {remote!r} size={len(data)} want={want_size} "
        f"needle={'yes' if ok_needle else 'no'}",
        flush=True,
    )
    return ok_size and ok_needle


def main() -> int:
    os.chdir(os.environ.get("GITHUB_WORKSPACE", "."))
    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    import paramiko  # noqa: PLC0415

    fail = 0
    must_fail = 0
    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            uploaded: set[str] = set()
            files = list(BOARDS_FILES)
            files.extend(sorted(glob.glob("vspfiles/boards/showcase/*.png")))
            for local in files:
                if not os.path.isfile(local):
                    print(f"::warning::BOARDS_CANON_SKIP missing {local!r}", flush=True)
                    continue
                remote = canonical_remote(local)
                if remote in uploaded:
                    continue
                if force_put(sftp, local, remote):
                    uploaded.add(remote)
                else:
                    fail += 1

            for local, remote in ALIASES:
                if not os.path.isfile(local):
                    continue
                if remote in uploaded:
                    continue
                if force_put(sftp, local, remote):
                    uploaded.add(remote)

            for local, remote_override, needle in MUST_MATCH:
                if not os.path.isfile(local):
                    must_fail += 1
                    continue
                remote = remote_override or canonical_remote(local)
                want = os.path.getsize(local)
                if not sftp_verify(sftp, remote, want, needle):
                    must_fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()

    if must_fail:
        print(
            f"::error::{must_fail} required boards file(s) failed SFTP verify",
            file=sys.stderr,
        )
        return 1
    if fail:
        print(f"::warning::{fail} boards file(s) failed canonical upload", flush=True)
    print("::notice::BOARDS_CANONICAL_DONE", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
