import json
import re
from pathlib import Path

import fitz


def strict_code(s: str) -> bool:
    s = s.strip()
    if not s or " " in s:
        return False
    if re.match(r"^\d{2}(?:/\d{2})+$", s):
        return True
    if re.match(r"^\d{2}/\d{2}/\d[A-Za-z]/\d{2}$", s):
        return True
    if re.match(r"^[A-Za-z]\d/\d{2}/[A-Za-z]\d$", s):
        return True
    if re.match(r"^\d(?:/[A-Za-z]\d){4,}$", s):
        return True
    if re.match(r"^[A-Za-z]\d(?:/[A-Za-z]?\d){2,}$", s):
        return True
    if re.match(r"^(?:[A-Z]\d|\d{1,2}[A-Z])(?:/(?:[A-Z]\d|\d{1,2}[A-Z]|\d{2})){2,}$", s):
        return True
    return False


def main() -> None:
    reg = json.loads(Path("sectional_styles_registry.json").read_text(encoding="utf-8"))
    for row in reg["styles"]:
        key = row["key"]
        p = Path("pdfs") / f"{key}.pdf"
        if not p.is_file():
            print(key, "NO_PDF")
            continue
        d = fitz.open(p.as_posix())
        lines: list[str] = []
        for i in range(len(d)):
            t = d[i].get_text("text") or ""
            if "POPULAR" not in t.upper():
                continue
            for ln in t.splitlines():
                s = ln.strip()
                if s:
                    lines.append(s)
        d.close()
        codes = [s.replace("/", "-") for s in lines if strict_code(s)]
        print(key, codes)


if __name__ == "__main__":
    main()
