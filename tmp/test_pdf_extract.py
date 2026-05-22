#!/usr/bin/env python3
import urllib.request
from urllib.parse import quote

import fitz

UA = {"User-Agent": "Mozilla/5.0"}


def extract(pdf_bytes: bytes) -> list[tuple[int, int, int]]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    out = []
    for pi, page in enumerate(doc):
        for img in page.get_images(full=True):
            xref = img[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < 150 or pix.height < 150:
                    continue
                area = pix.width * pix.height
                out.append((area, pi, pix.width, pix.height))
            except Exception:
                pass
    return sorted(out, reverse=True)[:5]


for model, style in [
    ("42306", "PINECREST"),
    ("42002", "THEO"),
    ("77651", "MADISON"),
    ("41094", "REGENT"),
]:
    url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
    data = urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=60
    ).read()
    tops = extract(data)
    print(model, style, "pages", fitz.open(stream=data, filetype="pdf").page_count, tops)
