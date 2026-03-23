"""
Convert a flat white-background logo PNG to transparent PNG with soft edges.

Uses 2x supersampling + distance-from-white alpha + light alpha blur so edges
look smooth on dark video (reduces jaggies and light halos).

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

    try:
        _LANCZOS = Image.Resampling.LANCZOS
    except AttributeError:
        _LANCZOS = Image.LANCZOS
except ImportError:
    print("Install Pillow: py -3 -m pip install Pillow", file=sys.stderr)
    sys.exit(1)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(REPO, "vspfiles", "images", "mccabe-logo.png")

# Pixels with distance-from-white d >= RAMP_FULL are fully opaque (logo body).
# Pixels with d in (0, RAMP_FULL) fade out (anti-alias / paper edge). Wider = softer edge.
RAMP_FULL = 56


def smooth_alpha(r: int, g: int, b: int) -> int:
    """More transparent as max(R,G,B) approaches 255 (white background)."""
    m = max(r, g, b)
    d = 255 - m
    if d >= RAMP_FULL:
        return 255
    if d <= 0:
        return 0
    return int(round(255 * d / RAMP_FULL))


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
    w0, h0 = img.size

    # Process at 2x so anti-alias survives downscale
    scale = 2
    w, h = w0 * scale, h0 * scale
    big = img.resize((w, h), _LANCZOS)
    px = big.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = smooth_alpha(r, g, b)
            px[x, y] = (r, g, b, a)

    r, g, b, a = big.split()
    # Blur at 2x resolution (radius in high-res pixels)
    a = a.filter(ImageFilter.GaussianBlur(radius=0.85))
    big = Image.merge("RGBA", (r, g, b, a))

    out = big.resize((w0, h0), _LANCZOS)
    r, g, b, a = out.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.35))
    out = Image.merge("RGBA", (r, g, b, a))

    out.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({w0}x{h0})")


if __name__ == "__main__":
    main()
