#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
TARGETS = """
77176-A4-1.jpg 77176-AE-1.jpg 77176-AS-1.jpg
77651-01-1.jpg 77651-A1-1.jpg 77651-D1-1.jpg
77656-01-1.jpg 77656-A1-1.jpg 77656-D1-1.jpg
77658-01-1.jpg 77658-A1-1.jpg 77658-D1-1.jpg
77743-01-1.jpg 77743-A1-1.jpg 77743-D1-1.jpg
77752-01-1.jpg 77752-A1-1.jpg 77752-D1-1.jpg
77768-91-1.jpg
43003-38-1.jpg 43003-33-1.jpg 77111-G3-1.jpg
42306-31-1.jpg 42306-32-1.jpg 42306-34-1.jpg 42306-33-1.jpg 42306-35-1.jpg
41094-39-1.jpg 41094-32-1.jpg 41094-35-1.jpg
77119-J2-1.jpg 77119-M2-1.jpg
42002-39-1.jpg 42002-32-1.jpg 42002-34-1.jpg 42002-33-1.jpg 42002-35-1.jpg
41043-39-1.jpg 41043-35-1.jpg 41089-42-1.jpg
""".split()

small = []
for name in TARGETS:
    p = PHOTOS / name
    if not p.is_file():
        print("MISSING", name)
        continue
    n = p.stat().st_size
    flag = " SMALL" if n < 15000 else ""
    if n < 15000:
        small.append((name, n))
    print(f"{name:22} {n:8}{flag}")

print(f"\n{len(TARGETS)} targets, {len(small)} under 15KB")
