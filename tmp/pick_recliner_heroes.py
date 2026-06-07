#!/usr/bin/env python3
"""Scrape SOS product pages and score front-angle studio photos by color."""
from __future__ import annotations

import re
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from replace_plp_photo_mats import near_mat_color, replace_mat_background  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0"}
SOS = "https://images.sofasandsectionals.com/images/photos"

PAGES = {
    "42002": "https://www.sofasandsectionals.com/theo-42002-recliner-by-palliser-furniture",
    "42306": "https://www.sofasandsectionals.com/pinecrest-42306-recliner-by-palliser-furniture",
    "43003": "https://www.sofasandsectionals.com/denali-43003-recliner-by-palliser-furniture",
    "41043": "https://www.sofasandsectionals.com/tundra-41043-recliner-50-fabrics-by-palliser-furniture",
    "41094": "https://www.sofasandsectionals.com/regent-41094-recliner-50-fabrics-by-palliser-furniture",
    "41051": "https://www.sofasandsectionals.com/henry-41051-power-headrest-power-wall-hugger-recliner-50-fabrics-by-palliser-furniture",
    "41049": "https://www.sofasandsectionals.com/oakwood-41049-recliner-50-fabrics-by-palliser-furniture",
}


def fetch(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()


def photo_ids(html: str) -> list[str]:
    ids = re.findall(r"images/photos/(\d+\.original\.(?:jpg|png|webp))", html)
    seen: set[str] = set()
    out: list[str] = []
    for pid in ids:
        if pid not in seen:
            seen.add(pid)
            out.append(pid)
    return out


def avg_rgb(img: Image.Image, box: tuple[int, int, int, int]) -> tuple[float, float, float]:
    crop = img.crop(box).convert("RGB")
    px = list(crop.getdata())
    if not px:
        return 128.0, 128.0, 128.0
    r = sum(p[0] for p in px) / len(px)
    g = sum(p[1] for p in px) / len(px)
    b = sum(p[2] for p in px) / len(px)
    return r, g, b


def score_image(data: bytes) -> dict | None:
    try:
        img = Image.open(BytesIO(data)).convert("RGB")
    except Exception:
        return None
    w, h = img.size
    if w < 450 or h < 350 or len(data) < 20_000:
        return None
    ratio = w / h
    if 0.97 <= ratio <= 1.03 and w < 900:
        return None

    rgba, _ = replace_mat_background(img.convert("RGBA"), global_pass=True)
    rgb = rgba.convert("RGB")
    w, h = rgb.size

    # Chair region: center 55% width, 15–92% height (ignore floor shadow)
    cx0, cx1 = int(w * 0.225), int(w * 0.775)
    cy0, cy1 = int(h * 0.08), int(h * 0.88)
    chair = avg_rgb(rgb, (cx0, cy0, cx1, cy1))

    # Left vs right halves — side profiles have very asymmetric mass
    left = avg_rgb(rgb, (cx0, cy0, (cx0 + cx1) // 2, cy1))
    right = avg_rgb(rgb, ((cx0 + cx1) // 2, cy0, cx1, cy1))
    lr_delta = sum(abs(a - b) for a, b in zip(left, right))

    # Side profile: narrow silhouette, high LR asymmetry, often wide aspect
    aspect = w / h
    side_penalty = 0.0
    if lr_delta > 55:
        side_penalty += 40
    if aspect > 1.55 and lr_delta > 35:
        side_penalty += 30
    if aspect > 1.85:
        side_penalty += 20

    # Prefer front or front 3/4: moderate asymmetry, not pure side
    front_bonus = 0.0
    if 15 <= lr_delta <= 45:
        front_bonus += 25
    if 1.05 <= aspect <= 1.45:
        front_bonus += 10

    # White-ish corners
    corners = [rgb.getpixel((0, 0)), rgb.getpixel((w - 1, 0)), rgb.getpixel((0, h - 1)), rgb.getpixel((w - 1, h - 1))]
    white_corners = sum(1 for r, g, b in corners if r > 235 and g > 235 and b > 235)

    score = front_bonus + white_corners * 8 - side_penalty
    if side_penalty >= 40:
        return None  # reject obvious side profile

    return {
        "score": score,
        "size": (w, h),
        "aspect": round(aspect, 2),
        "lr_delta": round(lr_delta, 1),
        "color": tuple(round(c) for c in chair),
        "bytes": len(data),
    }


def pick_diverse(candidates: list[tuple[str, dict]], n: int) -> list[str]:
    """Pick n photos with maximally different chair colors."""
    if not candidates:
        return []
    candidates = sorted(candidates, key=lambda x: -x[1]["score"])
    picked: list[tuple[str, dict]] = [candidates[0]]
    remaining = candidates[1:]
    while len(picked) < n and remaining:
        best_i, best_dist = 0, -1.0
        for i, (_, meta) in enumerate(remaining):
            c = meta["color"]
            min_dist = min(
                sum((a - b) ** 2 for a, b in zip(c, p[1]["color"])) ** 0.5 for p in picked
            )
            combined = min_dist + meta["score"] * 0.05
            if combined > best_dist:
                best_dist = combined
                best_i = i
        picked.append(remaining.pop(best_i))
    return [pid for pid, _ in picked]


def main() -> None:
    out_dir = ROOT / "tmp" / "recliner_picks"
    out_dir.mkdir(parents=True, exist_ok=True)

    for style, page in PAGES.items():
        print(f"\n=== {style} ===")
        try:
            html = fetch(page).decode("utf-8", "replace")
        except Exception as exc:
            print(f"  page fail: {exc}")
            continue
        ids = photo_ids(html)
        print(f"  {len(ids)} photos on page")
        scored: list[tuple[str, dict]] = []
        for pid in ids:
            for ext in ("jpg", "png", "webp"):
                if not pid.endswith(f".original.{ext}"):
                    continue
                url = f"{SOS}/{pid}"
                try:
                    data = fetch(url)
                except Exception:
                    break
                meta = score_image(data)
                if meta:
                    scored.append((pid, meta))
                    (out_dir / f"{style}_{pid.split('.')[0]}.jpg").write_bytes(data[:0] or data)
                break
        scored.sort(key=lambda x: -x[1]["score"])
        for pid, meta in scored[:8]:
            print(
                f"  {pid.split('.')[0]} score={meta['score']} aspect={meta['aspect']} "
                f"lr={meta['lr_delta']} color={meta['color']}"
            )
        picks = pick_diverse(scored, 8)
        print(f"  PICKS: {[p.split('.')[0] for p in picks]}")


if __name__ == "__main__":
    main()
