#!/usr/bin/env python3
"""Flag sofa/sectional PLP thumbs by silhouette (bean-bag vs sofa vs sectional diagram)."""
from __future__ import annotations

import io
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}
sys.path.insert(0, str(ROOT / "scripts"))

from plp_sofa_bounds import detect_sofa_bounds  # noqa: E402
from PIL import Image  # noqa: E402

# Import product collector from beanbag audit
exec((ROOT / "tmp" / "audit_beanbag_images.py").read_text(encoding="utf-8").split("def main")[0])


def classify_shape(photo: str, bounds) -> str | None:
    n = photo.lower()
    if "-sc-" in n:
        return None  # sectional diagram is OK
    if bounds.visible_h >= 190 and bounds.min_y <= 35:
        return "bean-bag-shaped (tall round)"
    if bounds.visible_h <= 90 and bounds.visible_w >= 250:
        return "suspicious flat thumb"
    return None


def main() -> int:
    products = collect_products()
    issues = []
    for href, p in sorted(products.items(), key=lambda x: x[1]["title"].lower()):
        photo = p.get("photo", "")
        if not photo or photo.startswith("{"):
            issues.append({**p, "reason": "missing PLP photo"})
            continue
        path = ROOT / "vspfiles" / "photos" / photo
        if path.is_file():
            data = path.read_bytes()
        else:
            try:
                data = urllib.request.urlopen(
                    urllib.request.Request(
                        f"{SITE}/v/vspfiles/photos/{photo}", headers=UA
                    ),
                    timeout=60,
                ).read()
            except Exception:
                issues.append({**p, "reason": "photo not found"})
                continue
        b = detect_sofa_bounds(Image.open(io.BytesIO(data)))
        if not b:
            issues.append({**p, "reason": "empty image"})
            continue
        reason = classify_shape(photo, b)
        if reason:
            issues.append({**p, "reason": reason, "bounds": b.as_dict()})
    print(f"Checked {len(products)} products; flagged {len(issues)}\n")
    for row in issues:
        print(f"- {row['title']}")
        print(f"  Photo: {row.get('photo') or '(none)'} | {row['reason']}")
        if row.get("bounds"):
            b = row["bounds"]
            print(f"  Bounds: {b['visibleW']}x{b['visibleH']} @ y={b['minY']}")
        print(f"  URL: {row['href']}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
