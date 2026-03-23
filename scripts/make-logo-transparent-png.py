"""
Convert a flat white-background logo PNG to transparent PNG with soft edges.

Uses a smooth alpha ramp (not hard threshold) + light blur on the alpha channel
to reduce jagged edges on the video background.

Usage (from repo root):
  py -3 scripts/make-logo-transparent-png.py path/to/your-logo.png

Writes: vspfiles/images/mccabe-logo.png

Requires: pip install Pillow
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image, ImageFilter
except ImportError:
    print("Install Pillow: py -3 -m pip install Pillow", file=sys.stderr)
    sys.exit(1)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "vspfiles", "images", "mccabe-logo.png")

# max(R,G,B) at or above this → fully transparent (background)
HI = 252
# max(R,G,B) at or below this → fully opaque (logo + dark edge pixels)
LO = 188


def smooth_alpha(r: int, g: int, b: int) -> int:
    m = max(r, g, b)
    if m >= HI:
        return 0
    if m <= LO:
        return 255
    # Linear blend across the anti-alias band
    return int(round(255 * (HI - m) / (HI - LO)))


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
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = smooth_alpha(r, g, b)
            px[x, y] = (r, g, b, a)

    # Soften alpha edges slightly (reduces stair-stepping on dark video)
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.45))
    img = Image.merge("RGBA", (r, g, b, a))

    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({w}x{h})")


if __name__ == "__main__":
    main()
