#!/usr/bin/env python3
"""Replace baked gray PLP photo backgrounds with white and optionally upload via SFTP.

Volusion product photos live at /vspfiles/photos/*.jpg|png on the store server.

Examples:
  py -3 scripts/replace_plp_photo_mats.py --category /category-s/177.htm --dry-run
  py -3 scripts/replace_plp_photo_mats.py --category /category-s/177.htm
  py -3 scripts/replace_plp_photo_mats.py --category /category-s/177.htm --upload
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.error
import urllib.request
from collections import deque
from io import BytesIO
from pathlib import Path

from PIL import Image

SITE = "https://www.mccabestheaterandliving.com"
PHOTO_RE = re.compile(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP mat fix)"}

# Volusion / export mat colors seen on PLP thumbs
MAT_COLORS = (
    (242, 242, 242),  # #f2f2f2
    (243, 243, 241),  # #f3f3f1
    (241, 241, 241),
    (238, 238, 238),
    (235, 235, 235),
)
MAT_TOLERANCE = 8


def near_mat_color(r: int, g: int, b: int) -> bool:
    for mr, mg, mb in MAT_COLORS:
        if abs(r - mr) <= MAT_TOLERANCE and abs(g - mg) <= MAT_TOLERANCE and abs(b - mb) <= MAT_TOLERANCE:
            return True
    if abs(r - g) <= 6 and abs(r - b) <= 6 and 228 <= r <= 246:
        return True
    return False


def replace_mat_background(img: Image.Image) -> tuple[Image.Image, int]:
    """Flood-fill mat gray from image edges only — preserves interior sofa shadows."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    changed = 0

    def push(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, a = px[x, y]
        if a < 10 or not near_mat_color(r, g, b):
            return
        visited[idx] = 1
        q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        px[x, y] = (255, 255, 255, a)
        changed += 1
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    return rgba, changed


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def collect_photo_names(category_path: str) -> list[str]:
    url = SITE + category_path
    html = fetch(url).decode("utf-8", "replace")
    return sorted(n for n in set(PHOTO_RE.findall(html)) if "{" not in n and "}" not in n)


def process_file(name: str, out_dir: Path | None, dry_run: bool) -> tuple[int, int]:
    url = f"{SITE}/v/vspfiles/photos/{name}"
    try:
        raw = fetch(url)
    except urllib.error.HTTPError as exc:
        print(f"{name}: SKIP ({exc.code})")
        return 0, 0
    img = Image.open(BytesIO(raw))
    fixed, changed = replace_mat_background(img)
    total = img.size[0] * img.size[1]
    print(f"{name}: {changed} mat pixels / {total} ({100 * changed / max(total, 1):.2f}%)")
    if dry_run or changed == 0:
        return changed, 0
    out_dir = out_dir or Path("tmp/plp-photos-fixed")
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / name
    if name.lower().endswith(".png"):
        fixed.save(dest, format="PNG", optimize=True)
    else:
        fixed.convert("RGB").save(dest, format="JPEG", quality=92)
    return changed, dest.stat().st_size


def upload_files(local_dir: Path, names: list[str]) -> int:
    host = os.environ.get("FTP_SERVER")
    user = os.environ.get("FTP_USERNAME")
    password = os.environ.get("FTP_PASSWORD")
    port = int(os.environ.get("SFTP_PORT", "2222"))
    if not all([host, user, password]):
        print("Set FTP_SERVER, FTP_USERNAME, FTP_PASSWORD to upload.", file=sys.stderr)
        return 1

    import paramiko  # noqa: PLC0415

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    fail = 0
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            for name in names:
                local = local_dir / name
                if not local.is_file():
                    print(f"skip missing {local}", file=sys.stderr)
                    fail += 1
                    continue
                for remote in (f"/vspfiles/photos/{name}", f"/v/vspfiles/photos/{name}"):
                    try:
                        want = local.stat().st_size
                        sftp.put(str(local), remote, confirm=False)
                        got = sftp.stat(remote).st_size
                        if got == want:
                            print(f"uploaded {name} -> {remote} ({want} bytes)")
                            break
                        print(f"SIZE_MISMATCH {remote} want={want} got={got}", file=sys.stderr)
                        fail += 1
                    except OSError as exc:
                        print(f"upload fail {remote}: {exc}", file=sys.stderr)
                        fail += 1
        finally:
            sftp.close()
    finally:
        transport.close()
    return fail


def main() -> int:
    parser = argparse.ArgumentParser(description="Replace gray mats in Volusion PLP photos.")
    parser.add_argument("--category", default="/category-s/177.htm", help="Category page path")
    parser.add_argument("--file", action="append", dest="files", help="Single photo filename")
    parser.add_argument("--out-dir", type=Path, default=Path("tmp/plp-photos-fixed"))
    parser.add_argument("--dry-run", action="store_true", help="Analyze only, do not write files")
    parser.add_argument("--upload", action="store_true", help="SFTP upload fixed files")
    args = parser.parse_args()

    names = args.files or collect_photo_names(args.category)
    if not names:
        print("No photos found.", file=sys.stderr)
        return 1

    print(f"Processing {len(names)} photo(s)...")
    touched: list[str] = []
    for name in names:
        changed, _size = process_file(name, args.out_dir, args.dry_run)
        if changed > 0 and not args.dry_run:
            touched.append(name)

    print(f"Fixed {len(touched)} file(s) -> {args.out_dir}")
    if args.upload and not args.dry_run:
        if not touched:
            print("Nothing to upload.")
            return 0
        return upload_files(args.out_dir, touched)
    return 0


if __name__ == "__main__":
    sys.exit(main())
