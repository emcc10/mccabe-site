"""
Crop a 3x3 sofa swatch grid into individual product images matching a reference canvas size.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from PIL import Image

LABELS = [
    ("bali-silk", 0, 0),
    ("evoque-mist", 0, 1),
    ("evoque-ardesia", 0, 2),
    ("evoque-frost", 1, 0),
    ("evoque-atlantic", 1, 1),
    ("bali-spider", 1, 2),
    ("bali-currant", 2, 0),
    ("bali-marble", 2, 1),
    ("bali-harvest", 2, 2),
]

# Fraction of canvas used for product art (matched to reference single-sofa framing).
CONTENT_SCALE = 0.88


def content_bbox(img: Image.Image, threshold: int = 248) -> tuple[int, int, int, int]:
    """Bounding box of non-white pixels (sofa + label)."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    pixels = rgb.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r < threshold or g < threshold or b < threshold:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return 0, 0, w, h
    pad = 4
    return (
        max(0, min_x - pad),
        max(0, min_y - pad),
        min(w, max_x + pad + 1),
        min(h, max_y + pad + 1),
    )


def reference_content_scale(ref: Image.Image) -> float:
    """How much of the reference canvas the product occupies (for consistent framing)."""
    bbox = content_bbox(ref)
    cw = bbox[2] - bbox[0]
    ch = bbox[3] - bbox[1]
    rw, rh = ref.size
    return min(cw / rw, ch / rh)


def cell_to_canvas(cell: Image.Image, out_w: int, out_h: int, target_fill: float) -> Image.Image:
    trimmed = cell.crop(content_bbox(cell))
    tw, th = trimmed.size
    max_w = int(out_w * target_fill)
    max_h = int(out_h * target_fill)
    scale = min(max_w / tw, max_h / th)
    nw = max(1, int(tw * scale))
    nh = max(1, int(th * scale))
    resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (out_w, out_h), (255, 255, 255))
    ox = (out_w - nw) // 2
    oy = (out_h - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def crop_grid(grid_path: Path, ref_path: Path, out_dir: Path) -> None:
    ref = Image.open(ref_path).convert("RGB")
    out_w, out_h = ref.size
    target_fill = reference_content_scale(ref) * CONTENT_SCALE

    grid = Image.open(grid_path).convert("RGB")
    gw, gh = grid.size
    cell_w = gw // 3
    cell_h = gh // 3

    out_dir.mkdir(parents=True, exist_ok=True)

    for slug, row, col in LABELS:
        left = col * cell_w
        top = row * cell_h
        right = left + cell_w if col < 2 else gw
        bottom = top + cell_h if row < 2 else gh
        cell = grid.crop((left, top, right, bottom))
        out = cell_to_canvas(cell, out_w, out_h, target_fill)
        dest = out_dir / f"{slug}.png"
        out.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest} ({out_w}x{out_h})")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop 3x3 sofa grid to reference-sized PNGs.")
    parser.add_argument("--grid", type=Path, required=True, help="3x3 grid source image")
    parser.add_argument("--reference", type=Path, required=True, help="Single-sofa reference for canvas size")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("vspfiles/images/sofa-swatches"),
        help="Output directory (default: vspfiles/images/sofa-swatches)",
    )
    args = parser.parse_args()
    crop_grid(args.grid.resolve(), args.reference.resolve(), args.out_dir.resolve())


if __name__ == "__main__":
    main()
