#!/usr/bin/env python3
"""Upload CE-/KL-/39F- altviews and remove listed remote leftovers."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
DELETE_LIST = PHOTOS / ".altview-remote-deletes.txt"
PREFIXES = ("CE-", "KL-", "39F-")
sys.path.insert(0, str(ROOT / "scripts"))


def targets() -> list[str]:
    return sorted(
        p.name
        for p in PHOTOS.glob("*-altview*.jpg")
        if p.is_file() and p.name.startswith(PREFIXES)
    )


def remote_deletes() -> list[str]:
    if not DELETE_LIST.is_file():
        return []
    out: list[str] = []
    for line in DELETE_LIST.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or name.startswith("#"):
            continue
        out.append(name)
    return out


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    files = targets()
    deletes = remote_deletes()
    if not files and not deletes:
        print("Nothing to upload or delete", file=sys.stderr)
        return 1

    print(
        f"Uploading {len(files)} humidor/sauna altview(s); "
        f"deleting {len(deletes)} remote leftover(s)..."
    )
    transport = connect_paramiko_transport(
        os.environ["FTP_SERVER"],
        int(os.environ.get("SFTP_PORT", "2222")),
        os.environ["FTP_USERNAME"],
        os.environ["FTP_PASSWORD"],
    )
    ok = 0
    fail = 0
    deleted = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for i, name in enumerate(files, 1):
                local = str(PHOTOS / name)
                size = os.path.getsize(local)
                if _upload_one(sftp, local, _photo_remotes(name)):
                    print(f"[{i}/{len(files)}] OK {name} ({size} bytes)", flush=True)
                    ok += 1
                else:
                    print(f"[{i}/{len(files)}] FAIL {name}", file=sys.stderr, flush=True)
                    fail += 1
            for name in deletes:
                removed_any = False
                for remote in _photo_remotes(name):
                    try:
                        sftp.remove(remote)
                        print(f"DELETED {remote}", flush=True)
                        removed_any = True
                    except OSError:
                        pass
                if removed_any:
                    deleted += 1
                else:
                    print(f"MISS (already gone?) {name}", flush=True)
        finally:
            sftp.close()
    finally:
        transport.close()

    print(f"Uploaded {ok}/{len(files)}; deleted {deleted}/{len(deletes)}; failed {fail}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
