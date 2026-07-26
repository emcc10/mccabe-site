#!/usr/bin/env python3
"""Fast upload of Steve Silver game/dining/server import photos to Volusion.

Writes both HTTP-serving paths:
  /v/vspfiles/photos/<file>
  /vspfiles/photos/<file>

Prioritizes product heroes (-1.jpg). Skips only when BOTH remotes already
match local size (unless FORCE_REUPLOAD=1). Uses parallel SFTP workers.
"""
from __future__ import annotations

import csv
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
IMPORT_CSV = ROOT / "vspfiles" / "imports" / "steve-silver-volusion" / "volusion_import_all.csv"
REMOTE_DIRS = (
    "/v/vspfiles/photos",
    "/vspfiles/photos",
)
WORKERS = int(os.environ.get("SS_DINING_UPLOAD_WORKERS", "6"))
CHUNK = 256 * 1024
FORCE = os.environ.get("FORCE_REUPLOAD", "").strip().lower() in {"1", "true", "yes"}
HEROES_ONLY = os.environ.get("SS_DINING_HEROES_ONLY", "").strip().lower() in {
    "1",
    "true",
    "yes",
}
ALTVIEWS_ONLY = os.environ.get("SS_DINING_ALTVIEWS_ONLY", "").strip().lower() in {
    "1",
    "true",
    "yes",
}
UPLOAD_LIST_FILE = os.environ.get("UPLOAD_LIST_FILE", "").strip()


def product_codes() -> list[str]:
    raw = IMPORT_CSV.read_text(encoding="utf-8")
    rows = list(csv.DictReader(StringIO(raw)))
    codes: list[str] = []
    seen: set[str] = set()
    for row in rows:
        code = (row.get("productcode") or "").strip()
        if not code:
            continue
        if code.endswith("-1") and not (PHOTOS / f"{code}.jpg").exists():
            code = code[:-2]
        if code in seen:
            continue
        seen.add(code)
        codes.append(code)
    return codes


def collect_targets() -> list[str]:
    names: set[str] = set()
    if UPLOAD_LIST_FILE:
        list_path = Path(UPLOAD_LIST_FILE)
        if not list_path.is_file():
            list_path = ROOT / UPLOAD_LIST_FILE
        for line in list_path.read_text(encoding="utf-8").splitlines():
            name = line.strip()
            if not name or name.startswith("#"):
                continue
            if (PHOTOS / name).is_file():
                names.add(name)
    else:
        for code in product_codes():
            if HEROES_ONLY:
                hero = PHOTOS / f"{code}-1.jpg"
                if hero.is_file():
                    names.add(hero.name)
                continue
            for path in PHOTOS.glob(f"{code}*.jpg"):
                if not path.is_file():
                    continue
                if ALTVIEWS_ONLY and "altview" not in path.name.lower():
                    continue
                names.add(path.name)

    def rank(name: str) -> tuple[int, str]:
        stem = name[:-4] if name.lower().endswith(".jpg") else name
        if stem.endswith("-1"):
            return (0, name)
        if stem.endswith("-2T") or stem.endswith("-1T"):
            return (1, name)
        if "altview" in stem.lower():
            return (2, name)
        return (3, name)

    return sorted(names, key=rank)


def _connect():
    sys.path.insert(0, str(ROOT / "scripts"))
    from verify_template_sftp import connect_paramiko_transport

    import paramiko

    host = os.environ["FTP_SERVER"]
    port = int(os.environ.get("SFTP_PORT", "2222"))
    user = os.environ["FTP_USERNAME"]
    password = os.environ["FTP_PASSWORD"]
    transport = connect_paramiko_transport(host, port, user, password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    return transport, sftp


def _remote_matches(sftp, remote: str, want: int) -> bool:
    try:
        return sftp.stat(remote).st_size == want
    except OSError:
        return False


def _put_one(sftp, local: str, remote: str, want: int) -> bool:
    try:
        try:
            sftp.remove(remote)
        except OSError:
            pass
        with open(local, "rb") as src, sftp.open(remote, "wb") as dst:
            dst.set_pipelined(True)
            while True:
                buf = src.read(CHUNK)
                if not buf:
                    break
                dst.write(buf)
        got = sftp.stat(remote).st_size
        if got != want:
            print(f"SIZE_MISMATCH {remote} want={want} got={got}", flush=True)
            return False
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL {remote}: {exc}", flush=True)
        return False


def _upload_name(sftp, name: str) -> str:
    """Return 'ok', 'skip', or 'fail'."""
    local = str(PHOTOS / name)
    want = os.path.getsize(local)
    remotes = [f"{d}/{name}" for d in REMOTE_DIRS]
    if not FORCE and all(_remote_matches(sftp, r, want) for r in remotes):
        return "skip"
    for remote in remotes:
        if not _put_one(sftp, local, remote, want):
            return "fail"
    return "ok"


def _worker(batch: list[str]) -> tuple[int, int, int]:
    ok = skip = fail = 0
    transport = None
    sftp = None
    try:
        transport, sftp = _connect()
        for name in batch:
            result = _upload_name(sftp, name)
            if result == "skip":
                skip += 1
                continue
            if result == "ok":
                ok += 1
                print(f"OK {name}", flush=True)
                continue
            # reconnect + retry once
            try:
                sftp.close()
            except Exception:
                pass
            try:
                transport.close()
            except Exception:
                pass
            transport, sftp = _connect()
            result = _upload_name(sftp, name)
            if result == "ok":
                ok += 1
                print(f"OK {name} (retry)", flush=True)
            elif result == "skip":
                skip += 1
            else:
                fail += 1
                print(f"FAIL {name}", flush=True)
    finally:
        if sftp is not None:
            try:
                sftp.close()
            except Exception:
                pass
        if transport is not None:
            try:
                transport.close()
            except Exception:
                pass
    return ok, skip, fail


def main() -> int:
    os.chdir(ROOT)
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD"):
        if not os.environ.get(key):
            print(f"Missing env {key}", file=sys.stderr)
            return 2

    targets = collect_targets()
    if not targets:
        print("No Steve Silver dining/game/server photos found", file=sys.stderr)
        return 1

    workers = max(1, min(WORKERS, len(targets)))
    batches: list[list[str]] = [[] for _ in range(workers)]
    for i, name in enumerate(targets):
        batches[i % workers].append(name)

    print(
        f"Uploading {len(targets)} files via {workers} SFTP workers "
        f"to {', '.join(REMOTE_DIRS)} "
        f"(heroes_only={HEROES_ONLY} force={FORCE})",
        flush=True,
    )
    t0 = time.time()
    ok = skip = fail = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_worker, b) for b in batches if b]
        for fut in as_completed(futs):
            o, s, f = fut.result()
            ok += o
            skip += s
            fail += f

    elapsed = time.time() - t0
    print(
        f"Uploaded {ok}, skipped {skip}, failed {fail} "
        f"(of {len(targets)}) in {elapsed:.0f}s"
    )
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
