"""Detect visible sofa silhouette bounds in PLP product photos (ignore white/transparent)."""
from __future__ import annotations

from dataclasses import dataclass

from PIL import Image


@dataclass(frozen=True)
class SofaBounds:
    min_x: int
    min_y: int
    max_x: int  # exclusive
    max_y: int  # exclusive
    img_w: int
    img_h: int

    @property
    def visible_w(self) -> int:
        return self.max_x - self.min_x

    @property
    def visible_h(self) -> int:
        return self.max_y - self.min_y

    def as_dict(self) -> dict:
        return {
            "visibleW": self.visible_w,
            "visibleH": self.visible_h,
            "minX": self.min_x,
            "minY": self.min_y,
            "maxX": self.max_x,
            "maxY": self.max_y,
            "nw": self.img_w,
            "nh": self.img_h,
        }


def is_background_pixel(r: int, g: int, b: int, a: int) -> bool:
    if a < 20:
        return True
    if r > 235 and g > 235 and b > 235:
        return True
    hi = max(r, g, b)
    lo = min(r, g, b)
    if hi - lo < 18 and hi > 192:
        return True
    return False


def detect_sofa_bounds(img: Image.Image) -> SofaBounds | None:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background_pixel(r, g, b, a):
                continue
            found = True
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if not found:
        return None
    return SofaBounds(
        min_x=min_x,
        min_y=min_y,
        max_x=max_x + 1,
        max_y=max_y + 1,
        img_w=w,
        img_h=h,
    )
