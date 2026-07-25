#!/usr/bin/env python3
"""Upload changed SS-*-altview*.jpg files and remove listed remote leftovers."""
from __future__ import annotations

import os
import sys
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
DELETE_LIST = PHOTOS / ".altview-remote-deletes.txt"
sys.path.insert(0, str(ROOT / "scripts"))


def ss_altview_targets() -> list[str]:
    return sorted(
        p.name
        for p in PHOTOS.glob("SS-*-altview*.jpg")
        if p.is_file()
    )


def remote_deletes() -> list[str]:
    if not DELETE_LIST.is_file():
        return []
    out: list[str] = []
    for line in DELETE_LIST.read_text(encoding="utf-8").splitlines():
        name = line.strip()
        if not name or name.startswith("#"):
            continue
        # This job owns SS cleanup deletes; leave CE/KL/39F to the humidor script.
        if name.upper().startswith("SS-"):
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

    # Prefer changed-only when DEPLOY_CHANGED_FILES is set.
    changed_env = os.environ.get("DEPLOY_CHANGED_FILES", "")
    changed = {Path(line.strip()).name for line in changed_env.splitlines() if line.strip()}
    files = ss_altview_targets()
    if changed:
        files = [n for n in files if n in changed or f"vspfiles/photos/{n}" in changed_env]
        # Always upload renumbered keepers for any SS code that had a delete marker.
        delete_names = remote_deletes()
        codes = {
            re_code(n)
            for n in delete_names
            if re_code(n)
        }
        if codes:
            extra = [n for n in ss_altview_targets() if any(n.startswith(c + "-altview") for c in codes)]
            files = sorted(set(files) | set(extra))

    deletes = remote_deletes()
    if not files and not deletes:
        print("Nothing to upload or delete", file=sys.stderr)
        return 1

    print(f"Uploading {len(files)} SS altview(s); deleting {len(deletes)} remote leftover(s)...")
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


def re_code(name: str) -> str:
    m = re.match(r"(SS-.+)-altview\d+\.jpg$", name, re.I)
    return m.group(1).upper() if m else ""


if __name__ == "__main__":
    raise SystemExit(main())
