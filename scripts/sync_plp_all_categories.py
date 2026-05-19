#!/usr/bin/env python3
"""Fetch, de-mat, and normalize PLP photos used across all category listing pages."""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
PATHS_FILE = ROOT / "scripts" / "plp_category_paths.txt"
SITE = "https://www.mccabestheaterandliving.com"
PHOTO_RE = re.compile(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
PAGE_RE = re.compile(r"page=(\d+)", re.I)
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP sync)"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def load_category_paths(extra: list[str] | None) -> list[str]:
    paths: list[str] = []
    if PATHS_FILE.is_file():
        for line in PATHS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if not line.startswith("/"):
                line = "/" + line
            paths.append(line)
    for p in extra or []:
        p = p.strip()
        if p:
            paths.append(p if p.startswith("/") else "/" + p)
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def photo_names_from_html(html: str) -> set[str]:
    return {
        n.lower()
        for n in PHOTO_RE.findall(html)
        if "{" not in n and "}" not in n
    }


def collect_photos_for_category(category_path: str) -> set[str]:
    base = SITE + category_path
    sep = "&" if "?" in category_path else "?"
    names: set[str] = set()
    html0 = fetch(base).decode("utf-8", "replace")
    names |= photo_names_from_html(html0)
    pages = {int(m.group(1)) for m in PAGE_RE.finditer(html0)}
    for page in sorted(pages):
        if page <= 1:
            continue
        url = f"{base}{sep}Page={page}"
        try:
            html = fetch(url).decode("utf-8", "replace")
        except urllib.error.HTTPError:
            continue
        names |= photo_names_from_html(html)
    return names


def download_photo(name: str) -> bool:
    dest = PHOTOS / name
    if dest.is_file() and dest.stat().st_size > 0:
        return False
    url = f"{SITE}/v/vspfiles/photos/{name}"
    try:
        dest.write_bytes(fetch(url))
        print(f"  fetched {name}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"  skip fetch {name}: {exc}", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync PLP photos for all category pages.")
    parser.add_argument("--category", action="append", dest="categories", help="Extra category path")
    parser.add_argument("--skip-normalize", action="store_true")
    parser.add_argument("--skip-mat", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    categories = load_category_paths(args.categories)
    if not categories:
        print("No category paths.", file=sys.stderr)
        return 1

    all_names: set[str] = set()
    for cat in categories:
        print(f"Scan {cat}...")
        found = collect_photos_for_category(cat)
        print(f"  {len(found)} photo(s)")
        all_names |= found

    print(f"Total unique photos: {len(all_names)}")
    PHOTOS.mkdir(parents=True, exist_ok=True)

    fetched = 0
    for name in sorted(all_names):
        if download_photo(name):
            fetched += 1
    print(f"Downloaded {fetched} new file(s) -> {PHOTOS}")

    if args.dry_run:
        return 0

    py = sys.executable
    if not args.skip_mat:
        for name in sorted(all_names):
            subprocess.run(
                [
                    py,
                    str(ROOT / "scripts" / "replace_plp_photo_mats.py"),
                    "--file",
                    name,
                    "--out-dir",
                    str(PHOTOS),
                ],
                cwd=ROOT,
                check=False,
            )

    if not args.skip_normalize:
        rc = subprocess.run(
            [
                py,
                str(ROOT / "scripts" / "normalize_plp_photos.py"),
                "--input-dir",
                str(PHOTOS),
                "--in-place",
            ],
            cwd=ROOT,
        ).returncode
        if rc != 0:
            return rc

    rc = subprocess.run(
        [py, str(ROOT / "scripts" / "generate_plp_sofa_bounds.py"), "--all-categories"],
        cwd=ROOT,
        check=False,
    ).returncode
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
