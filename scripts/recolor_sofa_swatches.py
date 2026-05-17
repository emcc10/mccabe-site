"""
Build sofa swatches by recoloring the high-quality reference sofa (full feet + shadow),
using fabric colors sampled from the 3x3 grid.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter, ImageOps

# Sampled from grid fabric regions (see sample_colors_from_grid).
SWATCH_COLORS: dict[str, tuple[int, int, int]] = {
    "bali-silk": (187, 178, 169),
    "evoque-mist": (170, 170, 170),
    "evoque-ardesia": (73, 66, 63),
    "evoque-frost": (182, 182, 182),
    "evoque-atlantic": (25, 31, 41),
    "bali-spider": (20, 20, 20),
    "bali-currant": (50, 18, 17),
    "bali-marble": (45, 36, 27),
    "bali-harvest": (110, 91, 70),
}

SOFA_PRODUCT_WIDTH_PX = 800
WORK_WIDTH_PX = 1200  # Process larger, then downscale for smoother edges.
WHITE_THRESHOLD = 250
ROOM_SOFA_WIDTH_RATIO = 0.48
ROOM_ANCHOR_X = 0.5
ROOM_ANCHOR_Y = 0.72


def rgb_to_hsl(r: float, g: float, b: float) -> tuple[float, float, float]:
    r, g, b = r / 255.0, g / 255.0, b / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2.0
    if mx == mn:
        return 0.0, l, 0.0
    d = mx - mn
    s = d / (2.0 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = ((g - b) / d + (6 if g < b else 0)) / 6.0
    elif mx == g:
        h = ((b - r) / d + 2) / 6.0
    else:
        h = ((r - g) / d + 4) / 6.0
    return h, l, s


def hsl_to_rgb(h: float, l: float, s: float) -> tuple[int, int, int]:
    if s == 0:
        v = int(round(l * 255))
        return v, v, v

    def hue_to_rgb(p: float, q: float, t: float) -> float:
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1 / 6:
            return p + (q - p) * 6 * t
        if t < 1 / 2:
            return q
        if t < 2 / 3:
            return p + (q - p) * (2 / 3 - t) * 6
        return p

    q = l * (1 + s) if l < 0.5 else l + s - l * s
    p = 2 * l - q
    r = hue_to_rgb(p, q, h + 1 / 3)
    g = hue_to_rgb(p, q, h)
    b = hue_to_rgb(p, q, h - 1 / 3)
    return int(round(r * 255)), int(round(g * 255)), int(round(b * 255))


def reference_to_rgba(ref: Image.Image) -> Image.Image:
    """Full sofa including feet. Shadow is added only in room composites, not on the PNG."""
    rgb = ref.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
                continue
            # Drop faint floor shadow / white fringe (added in-room via drop_shadow_layer).
            if r >= 236 and g >= 236 and b >= 236:
                continue
            opx[x, y] = (r, g, b, 255)

    return out


def is_leg_pixel(r: int, g: int, b: int) -> bool:
    return max(r, g, b) < 72 and (r + g + b) < 160


def desaturate_rgb(rgb: Image.Image) -> Image.Image:
    """Remove original leather hue so seams recolor cleanly."""
    out = rgb.copy()
    px = out.load()
    for y in range(out.size[1]):
        for x in range(out.size[0]):
            r, g, b = px[x, y]
            if is_leg_pixel(r, g, b):
                continue
            h, l, _s = rgb_to_hsl(r, g, b)
            px[x, y] = hsl_to_rgb(h, l, 0.0)
    return out


def recolor_rgba(sofa: Image.Image, target_rgb: tuple[int, int, int]) -> Image.Image:
    """Map original shading through target fabric tones (keeps leather folds realistic)."""
    alpha = sofa.split()[3]
    rgb = desaturate_rgb(sofa.convert("RGB"))
    lum = ImageOps.grayscale(rgb)
    shadow = tuple(max(0, int(c * 0.5)) for c in target_rgb)
    highlight = tuple(min(255, int(c * 1.14 + 10)) for c in target_rgb)
    colored = ImageOps.colorize(lum, black=shadow, white=highlight, mid=target_rgb)

    src_px = sofa.load()
    out_px = colored.load()
    w, h = sofa.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src_px[x, y]
            if is_leg_pixel(r, g, b):
                out_px[x, y] = (r, g, b)

    colored.putalpha(alpha)
    out_px = colored.load()
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            a = apx[x, y]
            if a < 20:
                out_px[x, y] = (0, 0, 0, 0)
    return defringe(colored)


def soften_alpha(img: Image.Image, radius: float = 0.45) -> Image.Image:
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(radius))
    return Image.merge("RGBA", (r, g, b, a))


def defringe(img: Image.Image) -> Image.Image:
    """Remove warm halos on semi-transparent edge pixels."""
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= 240:
                continue
            if a < 8:
                px[x, y] = (0, 0, 0, 0)
                continue
            # Pull fringe toward neutral gray for this luminance.
            lum = int(0.299 * r + 0.587 * g + 0.114 * b)
            px[x, y] = (lum, lum, lum, a)
    return img


def scale_to_width(img: Image.Image, width: int) -> Image.Image:
    w, h = img.size
    if w == width:
        return img
    nh = max(1, int(h * width / w))
    return img.resize((width, nh), Image.Resampling.LANCZOS)


def trim_transparent(img: Image.Image, pad: int = 2) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            bbox[2] + pad,
            bbox[3] + pad,
        )
    )


def sample_colors_from_grid(grid_path: Path) -> dict[str, tuple[int, int, int]]:
    grid = Image.open(grid_path).convert("RGB")
    gw, gh = grid.size
    cw, ch = gw // 3, gh // 3
    colors: dict[str, tuple[int, int, int]] = {}

    for idx, slug in enumerate(SWATCH_COLORS):
        row, col = divmod(idx, 3)
        left = col * cw
        top = row * ch
        right = left + cw if col < 2 else gw
        bottom = top + ch if row < 2 else gh
        cell = grid.crop((left, top, right, bottom))
        w, h = cell.size
        px = cell.load()
        rs: list[int] = []
        gs: list[int] = []
        bs: list[int] = []
        for y in range(int(h * 0.25), int(h * 0.72)):
            for x in range(int(w * 0.15), int(w * 0.85)):
                r, g, b = px[x, y]
                if r < 245 and g < 245 and b < 245 and r + g + b < 720:
                    rs.append(r)
                    gs.append(g)
                    bs.append(b)
        if rs:
            colors[slug] = (int(median(rs)), int(median(gs)), int(median(bs)))
    return colors


def room_placement(room: Image.Image) -> dict[str, int]:
    rw, rh = room.size
    sofa_w = int(rw * ROOM_SOFA_WIDTH_RATIO)
    return {
        "room_width": rw,
        "room_height": rh,
        "sofa_width": sofa_w,
        "x": int(rw * ROOM_ANCHOR_X - sofa_w / 2),
        "y": int(rh * ROOM_ANCHOR_Y),
    }


def drop_shadow_layer(size: tuple[int, int], sofa: Image.Image, x: int, y: int) -> Image.Image:
    """Soft shadow under sofa for room composite."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    alpha = sofa.split()[3]
    sw, sh = sofa.size
    shadow = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    shadow_rgb = Image.new("RGBA", (sw, sh), (12, 10, 8, 0))
    shadow = ImageChops.multiply(shadow, shadow_rgb)
    sa = shadow.split()[3]
    sa = sa.point(lambda p: int(p * 0.38) if p else 0)
    shadow.putalpha(sa)
    layer.paste(shadow, (x + 12, y + 14), shadow)
    return layer


def composite_on_room(sofa: Image.Image, room: Image.Image) -> Image.Image:
    base = room.convert("RGBA")
    place = room_placement(room)
    scaled = scale_to_width(sofa, place["sofa_width"])
    sw, sh = scaled.size
    x, y = place["x"], place["y"] - sh

    layer = drop_shadow_layer(base.size, scaled, x, y)
    layer.paste(scaled, (x, y), scaled)
    return Image.alpha_composite(base, layer).convert("RGB")


def build_swatches(
    reference_path: Path,
    grid_path: Path | None,
    out_dir: Path,
    room_path: Path | None,
    product_width: int,
) -> None:
    ref = Image.open(reference_path).convert("RGB")
    base_sofa = reference_to_rgba(ref)
    bbox = base_sofa.getbbox()
    if bbox:
        base_sofa = base_sofa.crop(bbox)
    base_sofa = scale_to_width(base_sofa, WORK_WIDTH_PX)
    base_sofa = soften_alpha(base_sofa, 0.45)

    colors = dict(SWATCH_COLORS)
    if grid_path and grid_path.is_file():
        colors.update(sample_colors_from_grid(grid_path))

    out_dir.mkdir(parents=True, exist_ok=True)
    in_room_dir = out_dir / "in-room"
    room = Image.open(room_path).convert("RGB") if room_path and room_path.is_file() else None
    if room is not None:
        in_room_dir.mkdir(parents=True, exist_ok=True)

    meta: dict = {
        "method": "reference-recolor",
        "productWidthPx": product_width,
        "colors": {k: list(v) for k, v in colors.items()},
        "files": {},
    }
    if room is not None:
        meta["room"] = {**room_placement(room), "widthRatio": ROOM_SOFA_WIDTH_RATIO}

    for slug, target in colors.items():
        recolored = recolor_rgba(base_sofa, target)
        recolored = soften_alpha(recolored, 0.45)
        recolored = trim_transparent(recolored, pad=6)
        recolored = scale_to_width(recolored, product_width)

        dest = out_dir / f"{slug}.png"
        recolored.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest} ({recolored.size[0]}x{recolored.size[1]})")

        entry = {"width": recolored.size[0], "height": recolored.size[1], "rgb": list(target)}
        if room is not None:
            preview = composite_on_room(recolored, room)
            preview_path = in_room_dir / f"{slug}.jpg"
            preview.save(preview_path, format="JPEG", quality=93)
            print(f"Wrote {preview_path}")
            entry["inRoomPreview"] = preview_path.name
        meta["files"][slug] = entry

    ref_copy = trim_transparent(base_sofa, pad=4)
    ref_copy.save(out_dir / "traditional-reference.png", format="PNG", optimize=True)

    (out_dir / "placement.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {out_dir / 'placement.json'}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Recolor reference sofa into swatch PNGs.")
    parser.add_argument(
        "--reference",
        type=Path,
        default=Path("vspfiles/images/_crop-src/sofa-reference.png"),
    )
    parser.add_argument(
        "--grid",
        type=Path,
        default=Path("vspfiles/images/_crop-src/sofa-grid.png"),
        help="Optional grid to re-sample fabric colors",
    )
    parser.add_argument(
        "--room",
        type=Path,
        default=Path("vspfiles/images/lifestyle/timeless-traditional-room.png"),
    )
    parser.add_argument("--width", type=int, default=SOFA_PRODUCT_WIDTH_PX)
    parser.add_argument("--out-dir", type=Path, default=Path("vspfiles/images/sofa-swatches"))
    args = parser.parse_args()

    build_swatches(
        args.reference.resolve(),
        args.grid.resolve() if args.grid else None,
        args.out_dir.resolve(),
        args.room.resolve() if args.room else None,
        args.width,
    )


if __name__ == "__main__":
    main()
