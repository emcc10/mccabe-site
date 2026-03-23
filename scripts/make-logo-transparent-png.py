"""
Convert a flat white-background logo PNG to transparent PNG.

Usage (from repo root):
  py -3 scripts/make-logo-transparent-png.py path/to/your-logo.png

Writes: vspfiles/images/mccabe-logo.png

Requires: pip install Pillow
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: py -3 -m pip install Pillow", file=sys.stderr)
    sys.exit(1)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "vspfiles", "images", "mccabe-logo.png")

# Pixels at or above this (per channel) are treated as background
THRESHOLD = 238


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        sys.exit(1)
    src = os.path.abspath(sys.argv[1])
    if not os.path.isfile(src):
        print(f"Not found: {src}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img = Image.open(src).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD:
                px[x, y] = (r, g, b, 0)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({w}x{h})")


if __name__ == "__main__":
    main()
