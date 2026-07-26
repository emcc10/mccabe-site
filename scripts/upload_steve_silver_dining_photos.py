#!/usr/bin/env python3
"""Upload Steve Silver game/dining/server import photos to Volusion SFTP.

Targets only SKUs from vspfiles/imports/steve-silver-volusion/volusion_import_all.csv
so bedroom sync stays fast. Skips remotes that already match local size.
"""
from __future__ import annotations

import csv
import os
import sys
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
IMPORT_CSV = ROOT / "vspfiles" / "imports" / "steve-silver-volusion" / "volusion_import_all.csv"


def product_codes() -> list[str]:
    raw = IMPORT_CSV.read_text(encoding="utf-8")
    rows = list(csv.DictReader(StringIO(raw)))
    codes: list[str] = []
    seen: set[str] = set()
    for row in rows:
        code = (row.get("productcode") or "").strip()
        if not code:
            continue
        # Guard against accidental "-1" suffix in a bad productcode cell.
        if code.endswith("-1") and (PHOTOS / f"{code}.jpg").exists():
            pass
        elif code.endswith("-1"):
            code = code[: -2]
        if code in seen:
            continue
        seen.add(code)
        codes.append(code)
    return codes


def collect_targets() -> list[str]:
    names: set[str] = set()
    for code in product_codes():
        for path in PHOTOS.glob(f"{code}*.jpg"):
            if path.is_file():
                names.add(path.name)
    return sorted(names)


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    sys.path.insert(0, str(ROOT / "scripts"))
    from deploy_volusion_assets import _photo_remotes, _upload_one
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    targets = collect_targets()
    if not targets:
        print("No Steve Silver dining/game/server photos found", file=sys.stderr)
        return 1

    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]

    transport = connect_paramiko_transport(host, port, user, password)
    fail = 0
    ok = 0
    skipped = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for name in targets:
                local = str(PHOTOS / name)
                want = os.path.getsize(local)
                remotes = _photo_remotes(name)
                already = False
                for remote in remotes:
                    try:
                        if sftp.stat(remote).st_size == want:
                            already = True
                            break
                    except OSError:
                        continue
                if already:
                    skipped += 1
                    if skipped % 50 == 1:
                        print(f"SKIP {name} (remote size matches)", flush=True)
                    continue
                if not _upload_one(sftp, local, remotes):
                    fail += 1
                    print(f"FAIL {name}", flush=True)
                else:
                    ok += 1
                    print(f"OK {name}", flush=True)
        finally:
            sftp.close()
    finally:
        transport.close()

    print(
        f"Uploaded {ok}, skipped {skipped}, failed {fail} "
        f"(of {len(targets)} Steve Silver dining/game/server photo(s))"
    )
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
