"""Download Saranoni variant T/S images from catalog import packs into vspfiles/photos/."""
from __future__ import annotations

import argparse
import csv
import io
import re
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Pillow required: pip install Pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
IMPORT_ROOT = ROOT / "catalog" / "saranoni-imports"
DEST = ROOT / "vspfiles" / "photos"

SWATCH = 320
MAIN_MAX = 1946
JPEG_QUALITY = 93


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def shopify_url(url: str, width: int) -> str:
    base = url.split("?")[0]
    return f"{base}?width={width}"


def save_main(data: bytes, dest: Path) -> None:
    with Image.open(io.BytesIO(data)) as im:
        im = im.convert("RGB") if im.mode not in ("RGB", "L") else im
        im.thumbnail((MAIN_MAX, MAIN_MAX), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)


def save_swatch(main_path: Path, dest: Path) -> None:
    with Image.open(main_path) as im:
        im = im.convert("RGB") if im.mode not in ("RGB", "L") else im
        w, h = im.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))
        im = im.resize((SWATCH, SWATCH), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=88, optimize=True)


def iter_variant_rows(product_codes: list[str] | None):
    for pack_dir in sorted(IMPORT_ROOT.iterdir()):
        if not pack_dir.is_dir():
            continue
        code = pack_dir.name
        if product_codes and code not in product_codes:
            continue
        csv_path = pack_dir / "variant_images.csv"
        if not csv_path.is_file():
            continue
        with csv_path.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                row["_pack"] = code
                yield row


def process_row(row: dict, force: bool) -> tuple[str, str]:
    code = row.get("ProductCode") or row["_pack"]
    label = row.get("VariantLabel") or ""
    url = (row.get("SaranoniImageURL") or "").strip()
    t_name = (row.get("ThumbFile") or "").strip()
    s_name = (row.get("SmallFile") or "").strip()
    if not url or not t_name or not s_name:
        return "skip", f"{code} {label}: missing url or filenames"

    t_path = DEST / t_name
    s_path = DEST / s_name
    if t_path.is_file() and s_path.is_file() and not force:
        return "exists", f"{code} {label}: already present"

    try:
        data = fetch(shopify_url(url, MAIN_MAX))
        if len(data) < 500:
            return "fail", f"{code} {label}: download too small"
        save_main(data, t_path)
        save_swatch(t_path, s_path)
        return "ok", f"{code} {label}: {t_name}, {s_name}"
    except Exception as err:
        return "fail", f"{code} {label}: {err}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "product_codes",
        nargs="*",
        help="Optional ProductCode(s); default all import packs",
    )
    parser.add_argument("--force", action="store_true", help="Re-download even if files exist")
    args = parser.parse_args()
    codes = args.product_codes or None

    counts = {"ok": 0, "exists": 0, "skip": 0, "fail": 0}
    for row in iter_variant_rows(codes):
        status, msg = process_row(row, args.force)
        counts[status] += 1
        print(f"[{status}] {msg}")

    print(
        f"\nDone: {counts['ok']} downloaded, {counts['exists']} skipped (exist), "
        f"{counts['skip']} skipped (invalid), {counts['fail']} failed"
    )
    print(f"Output: {DEST}")
    print("Deploy: push vspfiles/photos/ (deploy.yml uploads changed photos via SFTP)")


if __name__ == "__main__":
    main()
