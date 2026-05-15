#!/usr/bin/env python3
"""
One-shot Palliser spec PDF → sectional diagram PNGs for the site.

- Reads configuration *codes* from vspfiles/js/sectional-configs.js (no duplicate list).
- Uses catalog.json only for Palliser CDN model/style + pdf filename per style name.
- Finds the correct PDF page automatically by scanning page text for each configuration code (no manual page picking).
- Writes vspfiles/sectional-diagrams/{Style}-SC-{code}.png matching existing image URLs.

  pip install -r requirements.txt
  python export_sectional_diagrams.py --publish

Optional: --skip-fetch when PDFs already exist under pdfs/.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing PyMuPDF. Run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)

PALLISER_SPEC_BASE = "https://images.palliser.com/specsheet/en/"
USER_AGENT = "McCabeSite-SectionalDiagramExport/1.1"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def tool_dir() -> Path:
    return Path(__file__).resolve().parent


def load_catalog(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if not str(k).startswith("_")}


def extract_braced_block(txt: str, open_brace_idx: int) -> tuple[str, int]:
    if open_brace_idx < 0 or open_brace_idx >= len(txt) or txt[open_brace_idx] != "{":
        raise ValueError("expected '{'")
    depth = 0
    j = open_brace_idx
    while j < len(txt):
        c = txt[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return txt[open_brace_idx + 1 : j], j + 1
        j += 1
    raise ValueError("unbalanced braces in JS object")


def extract_square_block(txt: str, open_square_idx: int) -> tuple[str, int]:
    if open_square_idx < 0 or open_square_idx >= len(txt) or txt[open_square_idx] != "[":
        raise ValueError("expected '['")
    depth = 0
    j = open_square_idx
    while j < len(txt):
        c = txt[j]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return txt[open_square_idx + 1 : j], j + 1
        j += 1
    raise ValueError("unbalanced brackets")


def parse_sectional_configs_js(path: Path) -> dict[str, list[str]]:
    """Return { StyleName: [code, ...] } from window.MTL_SECTIONAL_CONFIGS = { ... }."""
    txt = path.read_text(encoding="utf-8")
    m = re.search(r"MTL_SECTIONAL_CONFIGS\s*=\s*\{", txt)
    if not m:
        raise ValueError(f"MTL_SECTIONAL_CONFIGS not found in {path}")
    open_pos = m.end() - 1
    inner, _end = extract_braced_block(txt, open_pos)

    styles: dict[str, list[str]] = {}
    i = 0
    rx = re.compile(r"([A-Za-z][A-Za-z0-9_]*)\s*:\s*\[")
    while True:
        mm = rx.search(inner, i)
        if not mm:
            break
        style_key = mm.group(1)
        sq = mm.end() - 1
        arr_txt, ni = extract_square_block(inner, sq)
        codes = re.findall(r"\bcode\s*:\s*\"([^\"]+)\"", arr_txt)
        style_key_fixed = (
            style_key[:1].upper() + style_key[1:]
            if len(style_key) > 1
            else style_key.upper()
        )
        styles[style_key_fixed] = codes
        i = ni
    if not styles:
        raise ValueError(f"No style arrays parsed from {path}")
    return styles


def palliser_pdf_url(model: str, style_caps: str) -> str:
    from urllib.parse import quote

    m = str(model or "").strip()
    s = str(style_caps or "").strip().upper()
    return PALLISER_SPEC_BASE + quote(f"{m} {s}") + ".pdf"


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=180) as resp:
        blob = resp.read()
    if len(blob) < 16 or not blob.startswith(b"%PDF"):
        raise RuntimeError(f"Not a PDF from {url}")
    dest.write_bytes(blob)


def code_text_variants(code: str) -> list[str]:
    c = code.strip()
    out = [
        c,
        c.upper(),
        c.replace("-", "/"),
        c.replace("-", "/").upper(),
        c.replace("-", "–"),
        c.replace("-", "—"),
    ]
    collapsed = "".join(ch for ch in c if not ch.isspace())
    if collapsed != c:
        out.append(collapsed)
    digits = "".join(ch for ch in c if ch.isdigit())
    if len(digits) >= 8:
        out.append(digits)
    dedup = []
    seen = set()
    for x in out:
        xs = x.strip()
        if not xs or xs in seen:
            continue
        seen.add(xs)
        dedup.append(xs)
    return dedup


def page_has_code_hint(page_text: str, code: str) -> bool:
    if not page_text or not code:
        return False
    variants = code_text_variants(code)
    t_lo = page_text
    for v in variants:
        if len(v) < 3:
            continue
        if v in page_text:
            return True
        if v.upper() in t_lo.upper():
            return True

    dotted = "".join(part for part in code.split("-") if part)
    digits_code = "".join(ch for ch in code if ch.isdigit())
    t_digits = "".join(ch for ch in page_text if ch.isdigit())
    if len(digits_code) >= 10 and digits_code in t_digits:
        return True
    compact = "".join(ch for ch in code if ch.isalnum()).upper()
    if len(compact) >= 12:
        collapsed_t = "".join(ch for ch in page_text.upper() if ch.isalnum())
        if compact in collapsed_t:
            return True

    dash_parts = code.split("-")
    if len(dash_parts) >= 3:
        head = dash_parts[:3]
        if all(p in page_text for p in head if len(p) >= 2):
            return True
    return False


def find_pages_for_code(doc: fitz.Document, code: str) -> list[int]:
    hits: list[int] = []
    for i in range(len(doc)):
        try:
            text = doc[i].get_text("text") or ""
        except Exception:
            text = ""
        if page_has_code_hint(text, code):
            hits.append(i + 1)
    return hits


def rasterize_page_from_doc(
    doc: fitz.Document,
    page_1based: int,
    out_path: Path,
    dpi: int,
) -> None:
    if page_1based < 1 or page_1based > len(doc):
        raise ValueError(f"page {page_1based} out of range (1–{len(doc)})")
    page = doc[page_1based - 1]
    z = dpi / 72.0
    mat = fitz.Matrix(z, z)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out_path.as_posix())


def cmd_publish(cat: dict, pdf_dir: Path, out_root: Path, configs_js: Path, skip_fetch: bool) -> int:
    dpi = int(cat.get("dpi") or 200)
    pall = cat.get("palliser") or {}

    try:
        style_codes = parse_sectional_configs_js(configs_js)
    except Exception as e:
        print(f"FAILED to parse sectional-configs.js: {e}", file=sys.stderr)
        return 1

    ec = 0
    for style, codes in style_codes.items():
        info = pall.get(style) or pall.get(style.capitalize())
        if not isinstance(info, dict):
            print(
                f"Style “{style}” has configs but no palliser entry in catalog.json — add PDF to pdfs/{style}.pdf or add palliser.{style}",
                file=sys.stderr,
            )
            ec = 1
            continue
        pdf_name = str(info.get("pdf") or f"{style}.pdf").strip()
        pdf_path = pdf_dir / pdf_name
        if not pdf_path.is_file():
            if skip_fetch:
                print(f"Missing PDF {pdf_path}; cannot --skip-fetch", file=sys.stderr)
                ec = 1
                continue
            model = str(info.get("model") or "").strip()
            stok = str(info.get("style") or style).strip()
            url = palliser_pdf_url(model, stok)
            print(f"Download {style}: {url}")
            try:
                download_file(url, pdf_path)
            except Exception as e:
                print(f"  DOWNLOAD FAIL: {e}", file=sys.stderr)
                ec = 1
                continue

        doc = fitz.open(pdf_path)
        try:
            np = len(doc)
            for code in codes:
                if not str(code).strip():
                    continue
                pages = find_pages_for_code(doc, str(code).strip())
                if not pages:
                    print(
                        f"FAIL {style} config “{code}”: no PDF page mentions this code ({np} pages). "
                        "If specs are diagram-only with no searchable text, we need OCR or a Palliser-provided SVG — not wired here.",
                        file=sys.stderr,
                    )
                    ec = 1
                    continue
                if len(pages) > 1:
                    print(
                        f"Note {style} “{code}”: multiple hits {pages}; using first page ({pages[0]})."
                    )
                page_use = pages[0]
                safe = str(code).replace("/", "-").replace("\\", "-")
                out_name = f"{style}-SC-{safe}.png"
                out_path = out_root / out_name
                rel = out_path.relative_to(repo_root())
                rasterize_page_from_doc(doc, page_use, out_path, dpi)
                print(f"OK {rel}  (PDF page {page_use})")
        finally:
            doc.close()

    return ec


def main() -> int:
    ap = argparse.ArgumentParser(description="Batch-export sectional diagram PNGs from Palliser specs.")
    ap.add_argument("--catalog", type=Path, default=tool_dir() / "catalog.json")
    ap.add_argument(
        "--publish",
        action="store_true",
        help="Fetch PDFs (if missing) + export all diagrams from sectional-configs.js",
    )
    ap.add_argument(
        "--skip-fetch",
        action="store_true",
        help="With --publish, do not download; require PDFs already in pdfs/",
    )
    args = ap.parse_args()

    if not args.publish:
        print(
            "Use: python export_sectional_diagrams.py --publish\n"
            "     (Parses sectional-configs.js; auto-finds diagram pages via PDF text; writes vspfiles/sectional-diagrams/.)",
            file=sys.stderr,
        )
        return 1

    cat = load_catalog(args.catalog)
    rel_js = Path(str(cat.get("configsJs") or "../../vspfiles/js/sectional-configs.js"))
    configs_js = (tool_dir() / rel_js).resolve()
    pdf_dir = tool_dir() / "pdfs"
    out_root = repo_root() / "vspfiles" / "sectional-diagrams"

    if not configs_js.is_file():
        print(f"configsJs not found: {configs_js}", file=sys.stderr)
        return 1

    return cmd_publish(cat, pdf_dir, out_root, configs_js, args.skip_fetch)


if __name__ == "__main__":
    raise SystemExit(main())
