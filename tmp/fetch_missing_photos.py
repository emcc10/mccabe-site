#!/usr/bin/env python3
"""Download missing PLP photos from live Volusion (sibling SKUs) + Palliser spec PDF renders."""
from __future__ import annotations

import io
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe fetch missing photos)"}

# target -> list of live-site source filenames to try (same collection / piece family)
FALLBACK: dict[str, list[str]] = {
    # Windsor — use existing grande / 2-seat thumbs for angled variants
    "77176-A4-1.jpg": ["77176-D1-1.jpg", "77176-A1-1.jpg"],
    "77176-AE-1.jpg": ["77176-A1-1.jpg", "77176-D1-1.jpg"],
    "77176-AS-1.jpg": ["77176-A1-1.jpg", "77176-D1-1.jpg"],
    # Madison families — apartment sofa photo often used for line hero on other dealers
    "77651-01-1.jpg": ["77651-91-1.jpg"],
    "77651-A1-1.jpg": ["77651-91-1.jpg", "77651-01-1.jpg"],
    "77651-D1-1.jpg": ["77651-91-1.jpg", "77651-01-1.jpg"],
    "77656-01-1.jpg": ["77656-91-1.jpg"],
    "77656-A1-1.jpg": ["77656-91-1.jpg", "77656-01-1.jpg"],
    "77656-D1-1.jpg": ["77656-91-1.jpg", "77656-01-1.jpg"],
    "77658-01-1.jpg": ["77658-91-1.jpg"],
    "77658-A1-1.jpg": ["77658-91-1.jpg", "77658-01-1.jpg"],
    "77658-D1-1.jpg": ["77658-91-1.jpg", "77658-01-1.jpg"],
    # Pyper
    "77768-91-1.jpg": ["77768-D1-1.jpg", "77768-91-1.jpg"],
    # Recliners — mechanism variants often share collection shot
    "43003-38-1.jpg": ["43003-31-1.jpg"],
    "43003-33-1.jpg": ["43003-31-1.jpg"],
    "42306-31-1.jpg": ["42306-39-1.jpg"],
    "42306-32-1.jpg": ["42306-39-1.jpg"],
    "42306-33-1.jpg": ["42306-39-1.jpg"],
    "42306-34-1.jpg": ["42306-39-1.jpg"],
    "42306-35-1.jpg": ["42306-39-1.jpg"],
    "42002-39-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "42002-32-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "42002-33-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "42002-34-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "42002-35-1.jpg": ["42002-31-1.jpg", "42002-38-1.jpg"],
    "41094-39-1.jpg": ["41094-31-1.jpg"],
    "41094-32-1.jpg": ["41094-31-1.jpg"],
    "41094-35-1.jpg": ["41094-31-1.jpg"],
    "41043-39-1.jpg": ["41043-32-1.jpg"],
    "41043-35-1.jpg": ["41043-32-1.jpg"],
}

# Palliser spec PDF: model + style token -> SKUs (extract largest raster from PDF page 1)
PDF_JOBS: list[tuple[str, str, list[str]]] = [
    ("77743", "CHARLI", ["77743-01-1.jpg", "77743-A1-1.jpg", "77743-D1-1.jpg"]),
    ("77752", "LAGUNA", ["77752-01-1.jpg", "77752-A1-1.jpg", "77752-D1-1.jpg"]),
    ("77651", "MADISON", ["77651-01-1.jpg", "77651-A1-1.jpg", "77651-D1-1.jpg"]),
    ("77656", "MADISON", ["77656-01-1.jpg", "77656-A1-1.jpg", "77656-D1-1.jpg"]),
    ("77658", "MADISON", ["77658-01-1.jpg", "77658-A1-1.jpg", "77658-D1-1.jpg"]),
    ("77111", "KINSLEY", ["77111-G3-1.jpg"]),
    ("77119", "THEA", ["77119-J2-1.jpg", "77119-M2-1.jpg"]),
    ("41089", "ZG5", ["41089-42-1.jpg"]),
]


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = resp.read()
    if len(data) < 5000:
        raise ValueError(f"too small ({len(data)} bytes)")
    if data[:6] in (b"GIF89a", b"GIF87a"):
        raise ValueError("gif placeholder")
    return data


def download_live(name: str) -> bytes:
    return fetch_bytes(f"{SITE}/v/vspfiles/photos/{name}")


def extract_pdf_largest_image(pdf_bytes: bytes) -> bytes | None:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return None
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    best: tuple[int, bytes] | None = None
    for page in doc[:2]:
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < 200 or pix.height < 150:
                    continue
                if pix.n - pix.alpha > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                data = pix.tobytes("jpeg", jpg_quality=92)
                area = pix.width * pix.height
                if best is None or area > best[0]:
                    best = (area, data)
            except Exception:  # noqa: BLE001
                continue
    return best[1] if best else None


def fetch_palliser_pdf(model: str, style: str) -> bytes:
    from urllib.parse import quote

    url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def main() -> None:
    PHOTOS.mkdir(parents=True, exist_ok=True)
    ok: list[str] = []
    fail: list[str] = []

    all_targets = sorted(
        set(FALLBACK) | {t for _, _, ts in PDF_JOBS for t in ts}
    )

    pdf_cache: dict[tuple[str, str], bytes | None] = {}

    for model, style, targets in PDF_JOBS:
        try:
            pdf = fetch_palliser_pdf(model, style)
            img = extract_pdf_largest_image(pdf)
            pdf_cache[(model, style)] = img
            if img:
                print(f"PDF image {model} {style}: {len(img)} bytes")
            else:
                print(f"PDF no raster {model} {style}")
        except Exception as exc:  # noqa: BLE001
            print(f"PDF fail {model} {style}: {exc}")
            pdf_cache[(model, style)] = None

    for target in all_targets:
        dest = PHOTOS / target
        if dest.is_file() and dest.stat().st_size > 8000:
            print(f"skip exists {target}")
            ok.append(target)
            continue
        saved = False
        for job in PDF_JOBS:
            if target in job[2] and pdf_cache.get((job[0], job[1])):
                dest.write_bytes(pdf_cache[(job[0], job[1])])  # type: ignore[arg-type]
                print(f"pdf -> {target}")
                ok.append(target)
                saved = True
                break
        if saved:
            continue
        for src in FALLBACK.get(target, []):
            try:
                data = download_live(src)
                dest.write_bytes(data)
                print(f"live {src} -> {target}")
                ok.append(target)
                saved = True
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  {src} for {target}: {exc}")
        if not saved:
            fail.append(target)

    print(f"\nOK {len(ok)} FAIL {len(fail)}")
    if fail:
        print("missing:", ", ".join(fail))


if __name__ == "__main__":
    main()
