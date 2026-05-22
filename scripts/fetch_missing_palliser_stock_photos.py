#!/usr/bin/env python3
"""
Download missing Volusion PLP stock photos into vspfiles/photos/.

Primary source: Palliser product-summary PDFs on images.palliser.com (dealer-facing
assets; same photography referenced in spec sheets / brand portal).

Fallback: existing sibling photos already on the live McCabe Volusion store.

Usage:
  py -3 scripts/fetch_missing_palliser_stock_photos.py
  py -3 scripts/fetch_missing_palliser_stock_photos.py --force
"""
from __future__ import annotations

import argparse
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe Palliser stock photos)"}
MIN_BYTES = 50_000

# model, style token, output filenames
PDF_SOURCES: list[tuple[str, str, list[str]]] = [
    ("77176", "WINDSOR", ["77176-A4-1.jpg", "77176-AE-1.jpg", "77176-AS-1.jpg"]),
    ("77651", "MADISON", ["77651-01-1.jpg", "77651-A1-1.jpg", "77651-D1-1.jpg"]),
    ("77656", "MADISON", ["77656-01-1.jpg", "77656-A1-1.jpg", "77656-D1-1.jpg"]),
    ("77658", "MADISON", ["77658-01-1.jpg", "77658-A1-1.jpg", "77658-D1-1.jpg"]),
    ("77743", "CHARLI", ["77743-01-1.jpg", "77743-A1-1.jpg", "77743-D1-1.jpg"]),
    ("77752", "LAGUNA", ["77752-01-1.jpg", "77752-A1-1.jpg", "77752-D1-1.jpg"]),
    ("77768", "PYPER", ["77768-91-1.jpg"]),
    ("43003", "DENALI", ["43003-38-1.jpg", "43003-33-1.jpg"]),
    ("77111", "KINSLEY", ["77111-G3-1.jpg"]),
    ("42306", "PINECREST", ["42306-31-1.jpg", "42306-32-1.jpg", "42306-33-1.jpg", "42306-34-1.jpg", "42306-35-1.jpg"]),
    ("41094", "REGENT", ["41094-39-1.jpg", "41094-32-1.jpg", "41094-35-1.jpg"]),
    ("77119", "THEA", ["77119-J2-1.jpg", "77119-M2-1.jpg"]),
    ("42002", "THEO", ["42002-39-1.jpg", "42002-32-1.jpg", "42002-33-1.jpg", "42002-34-1.jpg", "42002-35-1.jpg"]),
    ("41043", "TUNDRA", ["41043-39-1.jpg", "41043-35-1.jpg"]),
    ("41089", "ZG5", ["41089-42-1.jpg"]),
]

LIVE_FALLBACK: dict[str, list[str]] = {
    "77176-A4-1.jpg": ["77176-D1-1.jpg", "77176-A1-1.jpg"],
    "77176-AE-1.jpg": ["77176-A1-1.jpg"],
    "77176-AS-1.jpg": ["77176-A1-1.jpg"],
    "77651-01-1.jpg": ["77651-91-1.jpg"],
    "77651-A1-1.jpg": ["77651-91-1.jpg"],
    "77651-D1-1.jpg": ["77651-91-1.jpg"],
    "77656-01-1.jpg": ["77656-91-1.jpg"],
    "77656-A1-1.jpg": ["77656-91-1.jpg"],
    "77656-D1-1.jpg": ["77656-91-1.jpg"],
    "77658-01-1.jpg": ["77658-91-1.jpg"],
    "77658-A1-1.jpg": ["77658-91-1.jpg"],
    "77658-D1-1.jpg": ["77658-91-1.jpg"],
    "77768-91-1.jpg": ["77768-D1-1.jpg"],
    "43003-38-1.jpg": ["43003-31-1.jpg"],
    "43003-33-1.jpg": ["43003-31-1.jpg"],
    "42306-31-1.jpg": ["42306-39-1.jpg"],
    "42306-32-1.jpg": ["42306-39-1.jpg"],
    "42306-33-1.jpg": ["42306-39-1.jpg"],
    "42306-34-1.jpg": ["42306-39-1.jpg"],
    "42306-35-1.jpg": ["42306-39-1.jpg"],
    "42002-39-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "42002-32-1.jpg": ["42002-31-1.jpg"],
    "42002-33-1.jpg": ["42002-31-1.jpg"],
    "42002-34-1.jpg": ["42002-31-1.jpg"],
    "42002-35-1.jpg": ["42002-31-1.jpg"],
    "41094-39-1.jpg": ["41094-31-1.jpg"],
    "41094-32-1.jpg": ["41094-31-1.jpg"],
    "41094-35-1.jpg": ["41094-31-1.jpg"],
    "41043-39-1.jpg": ["41043-32-1.jpg"],
    "41043-35-1.jpg": ["41043-32-1.jpg"],
}


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def fetch_palliser_pdf(model: str, style: str) -> bytes:
    url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
    return fetch_bytes(url)


def extract_pdf_hero_jpeg(pdf_bytes: bytes) -> bytes | None:
    import fitz

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    best: tuple[int, bytes] | None = None
    for page in doc:
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < 400 or pix.height < 300:
                    continue
                if pix.n - pix.alpha > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                data = pix.tobytes("jpeg", jpg_quality=90)
                area = pix.width * pix.height
                if best is None or area > best[0]:
                    best = (area, data)
            except Exception:  # noqa: BLE001
                continue
    return best[1] if best else None


def download_live(name: str) -> bytes:
    data = fetch_bytes(f"{SITE}/v/vspfiles/photos/{name}")
    if len(data) < 5000 or data[:3] == b"GIF":
        raise ValueError(f"bad live asset {name}")
    return data


def needs_write(path: Path, force: bool) -> bool:
    if force or not path.is_file():
        return True
    return path.stat().st_size < MIN_BYTES


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    PHOTOS.mkdir(parents=True, exist_ok=True)
    pdf_cache: dict[tuple[str, str], bytes | None] = {}
    ok = 0
    fail: list[str] = []

    all_targets = sorted({t for _, _, ts in PDF_SOURCES for t in ts})

    for model, style, targets in PDF_SOURCES:
        key = (model, style)
        if key not in pdf_cache:
            try:
                pdf_cache[key] = extract_pdf_hero_jpeg(fetch_palliser_pdf(model, style))
                size = len(pdf_cache[key] or b"")
                print(f"PDF {model} {style}: {size} bytes jpeg")
            except Exception as exc:  # noqa: BLE001
                print(f"PDF fail {model} {style}: {exc}")
                pdf_cache[key] = None

    for target in all_targets:
        dest = PHOTOS / target
        if not needs_write(dest, args.force):
            print(f"skip {target}")
            ok += 1
            continue

        saved = False
        for model, style, targets in PDF_SOURCES:
            if target not in targets:
                continue
            jpeg = pdf_cache.get((model, style))
            if jpeg and len(jpeg) >= MIN_BYTES // 2:
                dest.write_bytes(jpeg)
                print(f"palliser pdf -> {target} ({len(jpeg)} bytes)")
                ok += 1
                saved = True
                break

        if saved:
            continue

        for src in LIVE_FALLBACK.get(target, []):
            try:
                dest.write_bytes(download_live(src))
                print(f"live {src} -> {target}")
                ok += 1
                saved = True
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  live {src}: {exc}")

        if not saved:
            fail.append(target)

    print(f"\nDone: {ok}/{len(all_targets)} ok")
    if fail:
        print("Failed:", ", ".join(fail))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
