#!/usr/bin/env python3
"""Extract configuration code strings from Palliser Product Summary PDF Popular page(s)."""
from __future__ import annotations

import re
import sys
import urllib.request
from urllib.parse import quote

try:
    import fitz  # PyMuPDF
except ImportError:
    print("pip install pymupdf", file=sys.stderr)
    raise SystemExit(1)

BASE = "https://images.palliser.com/specsheet/en/"
UA = "McCabeSite-SectionalDiagramExport/1.1"


def fetch_pdf(model: str, style_caps: str) -> bytes:
    url = BASE + quote(f"{model.strip()} {style_caps.strip()}") + ".pdf"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def popular_text(doc: fitz.Document) -> str:
    parts: list[str] = []
    for i in range(len(doc)):
        t = doc[i].get_text("text") or ""
        if "POPULAR CONFIGURATIONS" in t.upper():
            parts.append(t)
    return "\n".join(parts)


def extract_codes(text: str) -> list[str]:
    if not text:
        return []
    u = text
    found: set[str] = set()
    patterns = [
        r"\b\d{2}/\d{2}/\d{2}/\d{2}/\d{2}\b",  # 47/10/09/10/46
        r"\b\d{2}/\d{2}/\d{2}/\d{2}\b",
        r"\b\d{2}/\d{2}/\d{2}\b",
        r"\b\d{2}/\d{2}\b",
        r"\b\d/[A-Za-z]\d/[A-Za-z]\d/[A-Za-z]\d\b",  # 5W/1W/1L/S2/4W
        r"\b[A-Za-z]\d/[A-Za-z]\d/[A-Za-z]\d\b",  # E3/90/E4
        r"\b[A-Za-z]\d/\d{2}/[A-Za-z]\d\b",
        r"\b\d{2}/\d{2}/[A-Za-z]{1,3}/\d{2}\b",  # 07/9W/08
        r"\b\d{2}/\d{2}/\d[A-Za-z]/\d{2}\b",  # 67/10/9X/10/66
    ]
    for pat in patterns:
        for m in re.findall(pat, u, flags=re.I):
            s = m.strip()
            if len(s) < 3:
                continue
            found.add(s)
    out = sorted(found, key=lambda x: (-len(x), x))
    return out


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract_popular_codes.py MODEL STYLE_CAPS", file=sys.stderr)
        return 2
    model, style = sys.argv[1], sys.argv[2]
    blob = fetch_pdf(model, style)
    doc = fitz.open(stream=blob, filetype="pdf")
    try:
        t = popular_text(doc)
        codes = extract_codes(t)
        for c in codes:
            dash = c.replace("/", "-")
            print(f"{c}\t{dash}")
    finally:
        doc.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
