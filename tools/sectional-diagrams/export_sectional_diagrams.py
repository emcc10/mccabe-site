#!/usr/bin/env python3
"""
One-shot Palliser spec PDF → sectional diagram PNGs for the site.

- Reads configuration codes from vspfiles/js/sectional-configs.js.
- Downloads the Product Summary PDF (same URL pattern as Palliser: …/specsheet/en/{model}%20{STYLE}.pdf).
- Locates the POPULAR CONFIGURATIONS page and each kit code (07/15 style in the PDF).
- Crops a generous block per configuration: title + vector diagram + code + imperial/metric lines
  (union of text in that grid cell + padded bounds — not a tight icon-only crop).
- Renders at catalog “dpi” (default 300). Optional frame trim shaves outer PDF rule pixels.

  pip install -r requirements.txt
  python export_sectional_diagrams.py --publish

Optional: --skip-fetch when PDFs already exist under pdfs/.
Optional: --full-page rasterize whole page (no Popular block crop).
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

    dash_parts = [p for p in code.split("-") if p]
    if len(dash_parts) >= 2:
        joined_slash = "/".join(dash_parts)
        if joined_slash in page_text:
            return True
        if joined_slash.upper() in page_text.upper():
            return True

    return False


def normalize_config_code_key(code: str) -> str:
    return str(code or "").strip().lower().replace("/", "-")


def find_pages_for_code(doc: fitz.Document, code: str) -> list[int]:
    hits: list[int] = []
    for i in range(len(doc)):
        try:
            text = doc[i].get_text("text") or ""
        except Exception:
            text = ""
        if page_has_code_hint(text, code):
            hits.append(i + 1)
    if not hits:
        return hits

    def sort_key(p: int) -> tuple:
        page = doc[p - 1]
        popular = 1 if is_popular_configurations_page(page) else 0
        labeled = 1 if find_label_anchor_rect(page, code) else 0
        return (popular, labeled, -p)

    return sorted(hits, key=sort_key, reverse=True)


def is_popular_configurations_page(page: fitz.Page) -> bool:
    t = page.get_text("text") or ""
    return "POPULAR CONFIGURATIONS" in t.upper()


def popular_grid_vertical_bounds(page: fitz.Page) -> tuple[float, float] | None:
    """Content band between the Popular header and the footer disclaimer (page coords)."""
    pr = page.rect
    pop = page.search_for("POPULAR CONFIGURATIONS")
    if not pop:
        return None
    y_top = min(r.y1 for r in pop) + 2.0
    y_bot = pr.y1 - 28.0
    foot = page.search_for("Dimensions shown as Width x Depth x Height")
    if foot:
        y_bot = min(y_bot, foot[0].y0 - 10.0)
    if y_bot <= y_top + 40.0:
        return None
    return (y_top, y_bot)


def anchor_search_needles(code: str) -> list[str]:
    """Label text drawn in Palliser PDFs uses slashes instead of dashes (optionally W2 in the SKU)."""
    c = str(code or "").strip().replace(" ", "")
    if not c:
        return []
    return [c.replace("-", "/")]


def find_label_anchor_rect(page: fitz.Page, code: str) -> fitz.Rect | None:
    """
    Anchor the Popular cell for this kit code. Some PDFs repeat the same code string in two
    different Popular cells (e.g. Creighton has two distinct 12/35 layouts); unioning all
    hits produced a spanning rect that merged multiple diagrams into one PNG crop.
    """
    vb = popular_grid_vertical_bounds(page)
    for needle in anchor_search_needles(code):
        try:
            hits = list(page.search_for(needle, quads=False) or [])
        except Exception:
            hits = []
        kept = []
        for r in hits:
            cy = (r.y0 + r.y1) * 0.5
            if vb and (cy < vb[0] - 6.0 or cy > vb[1] + 6.0):
                continue
            kept.append(r)
        if not kept:
            continue
        kept.sort(key=lambda r: (r.y0, r.x0))
        return kept[0]
    return None


def inflate_rect(rect: fitz.Rect, pad: float) -> fitz.Rect:
    return fitz.Rect(rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad)


def _rects_overlap_x(a: fitz.Rect, b: fitz.Rect) -> bool:
    return max(a.x0, b.x0) < min(a.x1, b.x1)


def _span_noise(t: str) -> bool:
    s = (t or "").strip()
    if not s:
        return True
    u = s.upper()
    if "POPULAR" in u:
        return True
    if s.startswith("*") or "Select pieces from this collection" in s:
        return True
    if "Dimensions shown as Width x Depth x Height" in s:
        return True
    if "Please allow up to" in s and "centimeter" in s.lower():
        return True
    return False


def _span_looks_dimension_line(t: str) -> bool:
    """Imperial / metric dimension lines beside Popular diagrams (often right of the render)."""
    s = (t or "").strip().replace("\u00d7", "x")
    if len(s) < 5:
        return False
    if '"' in s and re.search(r"\d", s) and re.search(r"\d+\s*\"\s*[xX]\s*\d+", s):
        return True
    if re.search(r"\b\d{2,3}\s*cm\b", s, re.I):
        return True
    if re.search(r"\bW\s*\d", s, re.I) and re.search(r"\bD\s*\d", s, re.I):
        return True
    return False


def iter_text_spans_with_text(page: fitz.Page) -> list[tuple[fitz.Rect, str]]:
    out: list[tuple[fitz.Rect, str]] = []
    try:
        d = page.get_text("dict")
    except Exception:
        return out
    for bl in d.get("blocks", []):
        if bl.get("type") != 0:
            continue
        for line in bl.get("lines", []):
            for sp in line.get("spans", []):
                bb = sp.get("bbox")
                if not bb:
                    continue
                out.append((fitz.Rect(bb), str(sp.get("text") or "")))
    return out


def select_largest_popular_diagram_image_in_cell(
    page: fitz.Page, cell: fitz.Rect, *, min_area: float = 8000.0
) -> fitz.Rect | None:
    """
    One Popular cell should show a single sectional render. Palliser sometimes embeds a second
    smaller bitmap in the same quadrant (e.g. Creighton) — unioning them produced “two graphics”.
    Keep the largest qualifying image in the cell.
    """
    hits: list[fitz.Rect] = []
    cell_a = max(cell.get_area(), 1.0)
    floor = max(3500.0, min(float(min_area), 0.02 * cell_a))
    try:
        infos = page.get_image_info(xrefs=True) or []
    except Exception:
        infos = []
    for info in infos:
        bb = fitz.Rect(info["bbox"])
        if bb.get_area() < floor:
            continue
        if not bb.intersects(cell):
            continue
        cx = (bb.x0 + bb.x1) * 0.5
        cy = (bb.y0 + bb.y1) * 0.5
        if not (cell.x0 - 3.0 <= cx <= cell.x1 + 3.0 and cell.y0 - 3.0 <= cy <= cell.y1 + 3.0):
            continue
        hits.append(bb)
    if not hits:
        return None
    return max(hits, key=lambda r: r.get_area())


def popular_row_vertical_bounds(
    vb: tuple[float, float],
    anchor: fitz.Rect,
    *,
    mid_y_ratio: float = 0.5,
    row_split: str = "halves",
) -> tuple[float, float]:
    """Within Popular vertical band, pick the row slice containing this anchor (2 or 3 rows)."""
    y_top, y_bot = vb
    h = y_bot - y_top
    if h < 40.0:
        return (y_top, y_bot)
    cy = (anchor.y0 + anchor.y1) * 0.5
    rs = (row_split or "halves").strip().lower()
    if rs == "thirds":
        seg = h / 3.0
        idx = int((cy - y_top) / seg)
        if idx < 0:
            idx = 0
        elif idx > 2:
            idx = 2
        return (y_top + idx * seg, y_top + (idx + 1) * seg)
    mid_y = y_top + h * float(mid_y_ratio)
    if cy < mid_y:
        return (y_top, mid_y)
    return (mid_y, y_bot)


def popular_configuration_block_clip(
    page: fitz.Page,
    anchor: fitz.Rect,
    *,
    mid_y_ratio: float = 0.5,
    column_slack_pt: float = 22.0,
    pad_pt: float = 12.0,
    frame_trim_pt: float = 2.0,
    bottom_right_extra_trim_pt: float = 0.0,
    min_image_area: float = 8000.0,
    row_split: str = "halves",
) -> fitz.Rect | None:
    """
    Popular grid (usually 2×2 at two row bands, or some styles 2 columns × three row slices).
    Column by page centerline; row band from halves (legacy) or thirds (Creighton-class PDFs).
    Union only this cell's diagram image + titles/code/dimensions, then clamp to row slice so
    neighbor rows cannot bleed into the raster.
    """
    pr = page.rect
    vb = popular_grid_vertical_bounds(page)
    if not vb:
        return None
    y_top, y_bot = vb
    band_h = y_bot - y_top
    if band_h < 80.0:
        return None

    mid_x = pr.x0 + pr.width * 0.5
    mid_y = y_top + band_h * float(mid_y_ratio)

    rs = (row_split or "halves").strip().lower()
    row_y0, row_y1 = popular_row_vertical_bounds(
        (y_top, y_bot),
        anchor,
        mid_y_ratio=mid_y_ratio,
        row_split=row_split,
    )
    y0 = row_y0 + 1.0
    y1 = row_y1 - 2.0

    if (anchor.x0 + anchor.x1) * 0.5 < mid_x:
        x0 = pr.x0 + 6.0
        x1 = mid_x + 5.0
    else:
        x0 = mid_x - 5.0
        x1 = pr.x1 - 6.0

    cell = fitz.Rect(x0, y0, x1, y1)
    col_lo = cell.x0 - column_slack_pt
    col_hi = cell.x1 + column_slack_pt

    text_u: fitz.Rect | None = None
    row_tol_lo = row_y0 - 18.0
    row_tol_hi = row_y1 + 30.0
    for r, raw in iter_text_spans_with_text(page):
        if _span_noise(raw):
            continue
        cy = (r.y0 + r.y1) * 0.5
        if cy < y_top - 8.0 or cy > y_bot + 8.0:
            continue
        cx = (r.x0 + r.x1) * 0.5
        dim = _span_looks_dimension_line(raw)
        col_lo_x = col_lo - (18.0 if dim else 0.0)
        col_hi_x = col_hi + (72.0 if dim else 0.0)
        if cx < col_lo_x or cx > col_hi_x:
            continue
        if not _rects_overlap_x(r, cell):
            continue
        if cy < row_tol_lo or cy > row_tol_hi:
            continue
        text_u = r if text_u is None else (text_u | r)

    img_u = select_largest_popular_diagram_image_in_cell(page, cell, min_area=min_image_area)

    u: fitz.Rect | None = None
    if img_u is not None:
        u = fitz.Rect(img_u)
    if text_u is not None:
        u = text_u if u is None else (u | text_u)
    if u is None:
        u = fitz.Rect(anchor)
    else:
        u |= anchor

    if img_u is not None:
        u.y0 = min(u.y0, img_u.y0 - 6.0)
        u.y1 = max(u.y1, img_u.y1 + 10.0)
    u.y1 = min(y_bot - 3.0, max(u.y1, anchor.y1 + 14.0))

    # Clamp to column × row slice (Creighton Popular uses three rows — prevents next row's titles).
    row_cell_cap = inflate_rect(cell, 10.0)
    u &= row_cell_cap

    right_col = (anchor.x0 + anchor.x1) * 0.5 >= mid_x
    anchor_cy = (anchor.y0 + anchor.y1) * 0.5
    if rs == "thirds":
        bottom_row = anchor_cy >= y_top + 2 * band_h / 3.0 - 4.0
    else:
        bottom_row = anchor_cy >= mid_y
    if right_col and bottom_row and bottom_right_extra_trim_pt > 0.0:
        u.y1 = max(u.y0 + 72.0, u.y1 - float(bottom_right_extra_trim_pt))

    u = inflate_rect(u, pad_pt)
    u = u & pr
    u = fitz.Rect(
        max(pr.x0, u.x0 + frame_trim_pt),
        max(pr.y0, u.y0 + frame_trim_pt),
        min(pr.x1, u.x1 - frame_trim_pt),
        min(pr.y1, u.y1 - frame_trim_pt),
    )
    if u.width < 40.0 or u.height < 40.0:
        return None
    return u


def rasterize_page_from_doc(
    doc: fitz.Document,
    page_1based: int,
    out_path: Path,
    dpi: int,
    clip: fitz.Rect | None = None,
) -> None:
    if page_1based < 1 or page_1based > len(doc):
        raise ValueError(f"page {page_1based} out of range (1–{len(doc)})")
    page = doc[page_1based - 1]
    z = dpi / 72.0
    mat = fitz.Matrix(z, z)
    tgt = clip
    if tgt is not None:
        tgt = tgt & page.rect
    pix = page.get_pixmap(matrix=mat, clip=tgt, alpha=False)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pix.save(out_path.as_posix())


def popular_clip_kwargs_from_catalog(cat: dict, style_info: dict) -> dict:
    """Merge global catalog.json Popular-crop keys with optional per-style overrides on palliser.{Style}."""
    inf = style_info if isinstance(style_info, dict) else {}

    def gv(key: str, dflt: float) -> float:
        v = inf.get(key)
        if v is not None and str(v).strip() != "":
            return float(v)
        v2 = cat.get(key)
        if v2 is not None and str(v2).strip() != "":
            return float(v2)
        return float(dflt)

    def gs(key: str, dflt: str) -> str:
        v = inf.get(key)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
        v2 = cat.get(key)
        if v2 is not None and str(v2).strip() != "":
            return str(v2).strip()
        return dflt

    return {
        "mid_y_ratio": gv("popularMidYRatio", 0.5),
        "column_slack_pt": gv("popularColumnSlackPt", 22.0),
        "pad_pt": gv("popularCropPadPt", 12.0),
        "frame_trim_pt": gv("popularFrameTrimPt", 2.0),
        "bottom_right_extra_trim_pt": gv("popularBottomRightExtraTrimPt", 18.0),
        "min_image_area": gv("popularImageMinAreaPt2", 8000.0),
        "row_split": gs("popularRowSplit", "halves"),
    }


def cmd_publish(
    cat: dict,
    pdf_dir: Path,
    out_root: Path,
    configs_js: Path,
    skip_fetch: bool,
    grid_clip: bool,
    only_styles: set[str] | None,
) -> int:
    dpi = int(cat.get("dpi") or 300)
    pall = cat.get("palliser") or {}

    try:
        style_codes = parse_sectional_configs_js(configs_js)
    except Exception as e:
        print(f"FAILED to parse sectional-configs.js: {e}", file=sys.stderr)
        return 1

    ec = 0
    for style, codes in style_codes.items():
        if only_styles and style.upper() not in only_styles:
            continue
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

        source_pdf_map_raw = info.get("exportCodeSourcePdf") or {}
        source_pdf_map = {
            normalize_config_code_key(k): str(v).strip() for k, v in source_pdf_map_raw.items() if str(v).strip()
        }

        doc = fitz.open(pdf_path)
        try:
            np = len(doc)
            for code in codes:
                if not str(code).strip():
                    continue
                raw_code = str(code).strip()
                aliases = info.get("exportCodeAliases") or {}
                alias_key = normalize_config_code_key(raw_code)
                lookup = str(
                    aliases.get(raw_code)
                    or aliases.get(raw_code.replace("-", "/"))
                    or aliases.get(alias_key)
                    or raw_code
                ).strip()
                alt_pdf_name = source_pdf_map.get(alias_key)
                doc_use = doc
                doc_use_owned = False
                if alt_pdf_name:
                    alt_path = pdf_dir / alt_pdf_name
                    if not alt_path.is_file():
                        print(
                            f"FAIL {style} config “{code}”: exportCodeSourcePdf points to missing {alt_path}",
                            file=sys.stderr,
                        )
                        ec = 1
                        continue
                    doc_use = fitz.open(alt_path)
                    doc_use_owned = True
                    np = len(doc_use)
                try:
                    pages = find_pages_for_code(doc_use, lookup)
                    if not pages:
                        print(
                            f"FAIL {style} config “{code}”: no PDF page mentions this code ({np} pages). "
                            "If specs are diagram-only with no searchable text, we need OCR or a Palliser-provided SVG — not wired here.",
                            file=sys.stderr,
                        )
                        ec = 1
                        continue
                    page_use = pages[0]
                    if len(pages) > 1:
                        print(
                            f"Note {style} “{code}”: multiple PDF page hits {pages}; using best page ({page_use})."
                        )
                    pg = doc_use[page_use - 1]

                    clip: fitz.Rect | None = None
                    if grid_clip and is_popular_configurations_page(pg):
                        anch = find_label_anchor_rect(pg, lookup)
                        if anch:
                            ck = popular_clip_kwargs_from_catalog(cat, info)
                            clip = popular_configuration_block_clip(pg, anch, **ck)
                        if clip is None:
                            print(
                                f"Note {style} “{code}”: Popular page but could not derive block clip — using full page."
                            )

                    safe = str(code).replace("/", "-").replace("\\", "-")
                    out_name = f"{style}-SC-{safe}.png"
                    out_path = out_root / out_name
                    rel = out_path.relative_to(repo_root())
                    rasterize_page_from_doc(doc_use, page_use, out_path, dpi, clip)
                    lbl = "popular-block" if clip else "full page"
                    src_note = f", source {alt_pdf_name}" if alt_pdf_name else ""
                    print(f"OK {rel}  (PDF page {page_use}, {lbl}{src_note})")
                finally:
                    if doc_use_owned:
                        doc_use.close()
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
    ap.add_argument(
        "--full-page",
        action="store_true",
        help="Disable Popular Configurations quadrant crops (export full page raster for every match).",
    )
    ap.add_argument(
        "--only-style",
        metavar="STYLE",
        action="append",
        default=None,
        help=(
            "Only export diagram PNGs for this style key from sectional-configs.js "
            "(repeat flag for multiple). Example: --only-style Creighton"
        ),
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
    grid_clip = cat.get("clipPopularConfigurationsGrid")
    if grid_clip is False:
        use_grid = False
    else:
        use_grid = not args.full_page

    rel_js = Path(str(cat.get("configsJs") or "../../vspfiles/js/sectional-configs.js"))
    configs_js = (tool_dir() / rel_js).resolve()
    pdf_dir = tool_dir() / "pdfs"
    out_root = repo_root() / "vspfiles" / "sectional-diagrams"

    if not configs_js.is_file():
        print(f"configsJs not found: {configs_js}", file=sys.stderr)
        return 1

    only: set[str] | None = None
    if args.only_style:
        only = {str(s).strip().upper() for s in args.only_style if str(s).strip()}

    return cmd_publish(cat, pdf_dir, out_root, configs_js, args.skip_fetch, use_grid, only)


if __name__ == "__main__":
    raise SystemExit(main())
