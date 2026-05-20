#!/usr/bin/env python3
"""Normalize PLP sofa photos by visible silhouette bounds (not full canvas).

Crops to detected sofa, scales to a uniform visible width, pads, and centers on a
fixed canvas. Optional debug images show the detected bounds in red.

Examples:
  py -3 scripts/normalize_plp_photos.py --input-dir vspfiles/photos --dry-run
  py -3 scripts/normalize_plp_photos.py --input-dir vspfiles/photos --in-place
  py -3 scripts/normalize_plp_photos.py --input-dir vspfiles/photos --debug-dir tmp/plp-debug
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from plp_sofa_bounds import SofaBounds, detect_sofa_bounds  # noqa: E402

try:
    from replace_plp_photo_mats import replace_mat_background  # noqa: E402
except ImportError:
    replace_mat_background = None  # type: ignore[misc, assignment]

DEFAULT_TARGET_SOFA_W = 300
DEFAULT_CANVAS = (420, 260)
DEFAULT_PAD = (60, 24, 60, 24)  # left, top, right, bottom → 300×212 inner box


def _parse_canvas(s: str) -> tuple[int, int]:
    w, h = s.lower().replace("x", " ").split()
    return int(w), int(h)


def _parse_pad(s: str) -> tuple[int, int, int, int]:
    parts = [int(p) for p in s.replace(",", " ").split()]
    if len(parts) == 1:
        p = parts[0]
        return p, p, p, p
    if len(parts) == 2:
        h, v = parts
        return h, v, h, v
    if len(parts) == 4:
        return tuple(parts)  # type: ignore[return-value]
    raise ValueError("padding: one number, two (h v), or four (left top right bottom)")


def draw_bounds_debug(img: Image.Image, bounds: SofaBounds, color: tuple[int, int, int, int] = (255, 0, 0, 255)) -> Image.Image:
    out = img.convert("RGBA")
    draw = ImageDraw.Draw(out)
    draw.rectangle(
        [bounds.min_x, bounds.min_y, bounds.max_x - 1, bounds.max_y - 1],
        outline=color,
        width=max(2, min(out.size) // 200),
    )
    return out


def is_sectional_filename(name: str) -> bool:
    n = name.lower()
    return "-sc-" in n or n.startswith("sc-")


def is_loveseat_filename(name: str) -> bool:
    """Stationary loveseat PLP thumbs (*-03-1.jpg), e.g. category 157."""
    n = name.lower()
    if "-sc-" in n:
        return False
    return bool(re.search(r"-03-1\.(jpe?g|png)$", n))


def use_sofa_plp_contain_fit(name: str) -> bool:
    """Sectionals and loveseats: fit full product in frame at sofa-like visible height."""
    return is_sectional_filename(name) or is_loveseat_filename(name)


def normalize_sofa_image(
    img: Image.Image,
    bounds: SofaBounds,
    *,
    target_sofa_width: int = DEFAULT_TARGET_SOFA_W,
    canvas_size: tuple[int, int] = DEFAULT_CANVAS,
    pad: tuple[int, int, int, int] = DEFAULT_PAD,
    bg: tuple[int, int, int, int] = (255, 255, 255, 255),
    fill_inner_height: bool = False,
) -> tuple[Image.Image, dict]:
    """Return normalized RGBA canvas and placement metadata."""
    pad_l, pad_t, pad_r, pad_b = pad
    canvas_w, canvas_h = canvas_size
    inner_w = canvas_w - pad_l - pad_r
    inner_h = canvas_h - pad_t - pad_b
    if inner_w < 8 or inner_h < 8:
        raise ValueError("padding too large for canvas")

    crop = img.crop((bounds.min_x, bounds.min_y, bounds.max_x, bounds.max_y)).convert("RGBA")

    if fill_inner_height:
        # Fit full sectional in inner box (no side crop). Prefer sofa height near stationary PLP.
        ref_h = min(inner_h, round(inner_h * 126 / 212))
        scale = min(inner_w / bounds.visible_w, ref_h / bounds.visible_h)
        scaled_w = max(1, round(bounds.visible_w * scale))
        scaled_h = max(1, round(bounds.visible_h * scale))
    else:
        scale = target_sofa_width / bounds.visible_w
        scaled_w = max(1, round(bounds.visible_w * scale))
        scaled_h = max(1, round(bounds.visible_h * scale))
        if scaled_h > inner_h:
            scale *= inner_h / scaled_h
            scaled_w = max(1, round(bounds.visible_w * scale))
            scaled_h = max(1, round(bounds.visible_h * scale))
        if scaled_w > inner_w:
            scale *= inner_w / scaled_w
            scaled_w = max(1, round(bounds.visible_w * scale))
            scaled_h = max(1, round(bounds.visible_h * scale))

    sofa = crop.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", canvas_size, bg)
    x = pad_l + (inner_w - scaled_w) // 2
    y = pad_t + (inner_h - scaled_h) // 2
    canvas.paste(sofa, (x, y), sofa)
    if replace_mat_background is not None:
        canvas, _mat = replace_mat_background(canvas)

    meta = {
        "sourceSize": [bounds.img_w, bounds.img_h],
        "bounds": bounds.as_dict(),
        "targetSofaWidth": target_sofa_width,
        "fillInnerHeight": fill_inner_height,
        "scaledSize": [scaled_w, scaled_h],
        "placement": {"x": x, "y": y, "w": scaled_w, "h": scaled_h},
        "canvas": list(canvas_size),
        "padding": list(pad),
    }
    return canvas, meta


def save_image(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() == ".png":
        img.save(path, format="PNG", optimize=True)
    else:
        img.convert("RGB").save(path, format="JPEG", quality=92)


def process_file(
    path: Path,
    *,
    target_sofa_width: int,
    canvas_size: tuple[int, int],
    pad: tuple[int, int, int, int],
    dry_run: bool,
    debug_dir: Path | None,
) -> tuple[Image.Image | None, dict | None]:
    img = Image.open(path)
    bounds = detect_sofa_bounds(img)
    if not bounds:
        print(f"{path.name}: SKIP (no sofa pixels detected)")
        return None, None

    print(
        f"{path.name}: bounds {bounds.visible_w}x{bounds.visible_h} "
        f"@ ({bounds.min_x},{bounds.min_y}) in {bounds.img_w}x{bounds.img_h}"
    )

    if dry_run:
        return None, {"bounds": bounds.as_dict()}

    fill_h = use_sofa_plp_contain_fit(path.name)
    norm, meta = normalize_sofa_image(
        img,
        bounds,
        target_sofa_width=target_sofa_width,
        canvas_size=canvas_size,
        pad=pad,
        fill_inner_height=fill_h,
    )

    if debug_dir:
        debug_dir.mkdir(parents=True, exist_ok=True)
        stem = path.stem
        draw_bounds_debug(img, bounds).save(debug_dir / f"{stem}_bounds-src.png")
        dbg = norm.copy()
        pl = meta["placement"]
        ImageDraw.Draw(dbg).rectangle(
            [pl["x"], pl["y"], pl["x"] + pl["w"] - 1, pl["y"] + pl["h"] - 1],
            outline=(255, 0, 0, 255),
            width=2,
        )
        dbg.save(debug_dir / f"{stem}_bounds-out.png")
        norm.save(debug_dir / f"{stem}_normalized.png")

    return norm, meta


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize PLP photos by visible sofa bounds.")
    parser.add_argument("--input-dir", type=Path, default=ROOT / "vspfiles" / "photos")
    parser.add_argument("--output-dir", type=Path, help="Write normalized files here")
    parser.add_argument("--in-place", action="store_true", help="Overwrite files in --input-dir")
    parser.add_argument("--debug-dir", type=Path, help="Write bounds overlay debug PNGs")
    parser.add_argument("--target-width", type=int, default=DEFAULT_TARGET_SOFA_W)
    parser.add_argument("--canvas", type=_parse_canvas, default="420x260")
    parser.add_argument("--padding", type=_parse_pad, default="60,24,60,24")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--manifest", type=Path, help="Write JSON manifest of placements")
    parser.add_argument("--file", action="append", dest="files", help="Process only these filenames")
    args = parser.parse_args()

    if args.in_place and args.output_dir:
        print("Use either --in-place or --output-dir, not both.", file=sys.stderr)
        return 1

    input_dir: Path = args.input_dir
    if not input_dir.is_dir():
        print(f"Missing input dir: {input_dir}", file=sys.stderr)
        return 1

    files = sorted(
        p
        for p in input_dir.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    )
    if args.files:
        want = {f.lower() for f in args.files}
        files = [p for p in files if p.name.lower() in want]
    if not files:
        print("No images found.", file=sys.stderr)
        return 1

    out_dir = args.output_dir
    if args.in_place:
        out_dir = input_dir
    elif not out_dir:
        out_dir = ROOT / "vspfiles" / "photos-normalized"

    manifest: dict[str, dict] = {}
    ok = 0
    for path in files:
        norm, meta = process_file(
            path,
            target_sofa_width=args.target_width,
            canvas_size=args.canvas,
            pad=args.padding,
            dry_run=args.dry_run,
            debug_dir=args.debug_dir,
        )
        if meta:
            manifest[path.name] = meta
            ok += 1
        if norm is None:
            continue
        dest = out_dir / path.name
        save_image(norm, dest)
        print(f"  -> {dest} ({args.canvas[0]}x{args.canvas[1]})")

    print(f"Normalized {ok}/{len(files)} image(s)")
    if args.manifest and not args.dry_run:
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"Manifest → {args.manifest}")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
