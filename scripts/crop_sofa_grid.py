"""
Crop a 3x3 sofa swatch grid into transparent PNGs (sofa only, 800px wide)
and optional lifestyle-room composites.
"""
from __future__ import annotations

import argparse
import json
import os
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

SOFA_PRODUCT_WIDTH_PX = 800
WHITE_THRESHOLD = 248
# Sofa width as a fraction of the lifestyle room image width (tuned for rug scale).
ROOM_SOFA_WIDTH_RATIO = 0.48
ROOM_ANCHOR_X = 0.5
ROOM_ANCHOR_Y = 0.72


def open_image(path: Path) -> Image.Image:
    p = str(path.resolve())
    if len(p) > 260 and os.name == "nt":
        p = "\\\\?\\" + os.path.abspath(p)
    return Image.open(p)


def white_to_alpha(img: Image.Image, threshold: int = WHITE_THRESHOLD) -> Image.Image:
    rgba = img.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                px[x, y] = (255, 255, 255, 0)
    return rgba


def row_ink(im: Image.Image, y: int) -> int:
    w = im.size[0]
    px = im.load()
    count = 0
    for x in range(w):
        r, g, b, a = px[x, y]
        if a > 20 and (r + g + b) < 740:
            count += 1
    return count


def sofa_only_bbox(rgba: Image.Image) -> tuple[int, int, int, int] | None:
    """Crop box for sofa only (excludes swatch label text under the product)."""
    full = rgba.getbbox()
    if not full:
        return None
    crop = rgba.crop(full)
    w, h = crop.size
    y = h - 1
    while y > 0 and row_ink(crop, y) < w * 0.03:
        y -= 1
    while y > 0 and row_ink(crop, y) >= w * 0.08:
        y -= 1
    while y > 0 and row_ink(crop, y) < w * 0.03:
        y -= 1
    sofa_bottom = y + 1
    if sofa_bottom < h * 0.35:
        sofa_bottom = h
    return (full[0], full[1], full[2], full[1] + sofa_bottom)


def scale_sofa_to_width(sofa: Image.Image, target_width: int) -> Image.Image:
    w, h = sofa.size
    if w <= 0:
        return sofa
    scale = target_width / w
    nh = max(1, int(h * scale))
    return sofa.resize((target_width, nh), Image.Resampling.LANCZOS)


def extract_sofa_from_cell(cell: Image.Image, product_width: int) -> Image.Image | None:
    rgba = white_to_alpha(cell)
    bbox = sofa_only_bbox(rgba)
    if not bbox:
        return None
    sofa = rgba.crop(bbox)
    return scale_sofa_to_width(sofa, product_width)


def reference_sofa_width(ref_path: Path) -> int:
    ref = white_to_alpha(open_image(ref_path))
    bbox = ref.getbbox()
    if not bbox:
        return SOFA_PRODUCT_WIDTH_PX
    return bbox[2] - bbox[0]


def room_placement(room: Image.Image) -> dict[str, float | int]:
    rw, rh = room.size
    sofa_w = int(rw * ROOM_SOFA_WIDTH_RATIO)
    x = int(rw * ROOM_ANCHOR_X - sofa_w / 2)
    y = int(rh * ROOM_ANCHOR_Y)
    return {"room_width": rw, "room_height": rh, "sofa_width": sofa_w, "x": x, "y": y}


def composite_on_room(sofa: Image.Image, room: Image.Image) -> Image.Image:
    base = room.convert("RGBA")
    place = room_placement(room)
    scaled = scale_sofa_to_width(sofa, int(place["sofa_width"]))
    sw, sh = scaled.size
    x = int(place["x"])
    y = int(place["y"]) - sh
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(scaled, (x, y), scaled)
    return Image.alpha_composite(base, layer).convert("RGB")


def crop_grid(
    grid_path: Path,
    ref_path: Path,
    out_dir: Path,
    room_path: Path | None = None,
    product_width: int = SOFA_PRODUCT_WIDTH_PX,
) -> None:
    ref_w = reference_sofa_width(ref_path)
    if product_width <= 0:
        product_width = SOFA_PRODUCT_WIDTH_PX
    print(f"Reference sofa width: {ref_w}px -> exporting at {product_width}px wide")

    grid = open_image(grid_path).convert("RGB")
    gw, gh = grid.size
    cell_w = gw // 3
    cell_h = gh // 3

    out_dir.mkdir(parents=True, exist_ok=True)
    meta: dict[str, object] = {
        "productWidthPx": product_width,
        "referenceSofaWidthPx": ref_w,
        "files": {},
    }

    room: Image.Image | None = None
    in_room_dir: Path | None = None
    if room_path and room_path.is_file():
        room = open_image(room_path).convert("RGB")
        in_room_dir = out_dir / "in-room"
        in_room_dir.mkdir(parents=True, exist_ok=True)
        meta["room"] = {
            "path": str(room_path),
            **room_placement(room),
            "widthRatio": ROOM_SOFA_WIDTH_RATIO,
        }

    for slug, row, col in LABELS:
        left = col * cell_w
        top = row * cell_h
        right = left + cell_w if col < 2 else gw
        bottom = top + cell_h if row < 2 else gh
        cell = grid.crop((left, top, right, bottom))
        sofa = extract_sofa_from_cell(cell, product_width)
        if sofa is None:
            print(f"Skip {slug}: no sofa detected")
            continue

        dest = out_dir / f"{slug}.png"
        sofa.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest} ({sofa.size[0]}x{sofa.size[1]}, RGBA)")

        entry: dict[str, int] = {"width": sofa.size[0], "height": sofa.size[1]}
        if room is not None and in_room_dir is not None:
            preview = composite_on_room(sofa, room)
            preview_path = in_room_dir / f"{slug}.jpg"
            preview.save(preview_path, format="JPEG", quality=92)
            print(f"Wrote {preview_path}")
            entry["inRoomPreview"] = preview_path.name
        meta["files"][slug] = entry

    meta_path = out_dir / "placement.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {meta_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crop 3x3 sofa grid to transparent 800px-wide sofa PNGs."
    )
    parser.add_argument("--grid", type=Path, required=True, help="3x3 grid source image")
    parser.add_argument(
        "--reference",
        type=Path,
        required=True,
        help="Single-sofa reference (used to verify target width)",
    )
    parser.add_argument(
        "--room",
        type=Path,
        default=None,
        help="Lifestyle room backdrop for in-room preview composites",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=SOFA_PRODUCT_WIDTH_PX,
        help="Sofa width in pixels on transparent PNG (default: 800)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("vspfiles/images/sofa-swatches"),
        help="Output directory",
    )
    args = parser.parse_args()
    crop_grid(
        args.grid.resolve(),
        args.reference.resolve(),
        args.out_dir.resolve(),
        args.room.resolve() if args.room else None,
        args.width,
    )


if __name__ == "__main__":
    main()
