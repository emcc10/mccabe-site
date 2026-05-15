import re
import fitz
from pathlib import Path

CODE_RX = re.compile(
    r"\b\d{2}-\d{2}(?:-\d{2})*\b|\b\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\b"
)


def codes_in_text(t: str) -> list[str]:
    return list(dict.fromkeys(m.group(0) for m in CODE_RX.finditer(t or "")))


p = Path(__file__).parent / "pdfs" / "Alula.pdf"
doc = fitz.open(p)
for i in range(len(doc)):
    t = doc[i].get_text("text") or ""
    c = codes_in_text(t)
    if c:
        print(f"page {i+1}: {c}")
doc.close()
