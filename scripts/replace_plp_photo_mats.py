#!/usr/bin/env python3
"""Replace baked gray PLP photo backgrounds with white and optionally upload via SFTP.

Volusion product photos live at /vspfiles/photos/*.jpg|png on the store server.
Use when thumbnails still show a gray mat inside the image file itself.

Examples:
  py -3 scripts/replace_plp_photo_mats.py --category /category-s/177.htm --dry-run
  py -3 scripts/replace_plp_photo_mats.py --file 77180-01-1.jpg --upload
  py -3 scripts/replace_plp_photo_mats.py --category /category-s/177.htm --upload
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

SITE = "https://www.mccabestheaterandliving.com"
PHOTO_RE = re.compile(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP mat fix)"}


def is_gray_mat_pixel(r: int, g: int, b: int) -> bool:
    if abs(r - g) > 10 or abs(r - b) > 10 or abs(g - b) > 10:
        return False
    return 225 <= r <= 248


def replace_gray_with_white(img: Image.Image) -> tuple[Image.Image, int]:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    changed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            if is_gray_mat_pixel(r, g, b):
                px[x, y] = (255, 255, 255, a)
                changed += 1
    return rgba, changed


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def collect_photo_names(category_path: str) -> list[str]:
    url = SITE + category_path
    html = fetch(url).decode("utf-8", "replace")
    names = sorted(set(PHOTO_RE.findall(html)))
    return names


def process_file(name: str, out_dir: Path | None, dry_run: bool) -> tuple[int, int]:
    url = f"{SITE}/v/vspfiles/photos/{name}"
    raw = fetch(url)
    img = Image.open(BytesIO(raw))
    fixed, changed = replace_gray_with_white(img)
    total = img.size[0] * img.size[1]
    print(f"{name}: {changed} gray pixels / {total} ({100 * changed / max(total, 1):.2f}%)")
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
                remote = f"/vspfiles/photos/{name}"
                want = local.stat().st_size
                sftp.put(str(local), remote, confirm=False)
                got = sftp.stat(remote).st_size
                if got == want:
                    print(f"uploaded {name} -> {remote} ({want} bytes)")
                else:
                    print(f"SIZE_MISMATCH {name} want={want} got={got}", file=sys.stderr)
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

    if args.upload and not args.dry_run:
        if not touched:
            print("Nothing to upload.")
            return 0
        return upload_files(args.out_dir, touched)
    return 0


if __name__ == "__main__":
    sys.exit(main())
