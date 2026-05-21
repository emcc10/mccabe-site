#!/usr/bin/env python3
"""List sofa/sectional PLP products using bean-bag placeholder images."""
from __future__ import annotations

import hashlib
import io
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe photo audit)"}

CATEGORIES = [
    "/category-s/139.htm",
    "/category-s/135.htm",
    "/category-s/132.htm",
    "/category-s/177.htm",
    "/category-s/187.htm",
    "/category-s/188.htm",
    "/category-s/157.htm",
    "/category-s/178.htm",
    "/category-s/176.htm",
    "/category-s/179.htm",
    "/category-s/192.htm",
]

CARD_RE = re.compile(
    r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>',
    re.I | re.S,
)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
TITLE_LINK_RE = re.compile(
    r'<a href="([^"]+)"[^>]*class="[^"]*v-product__title[^"]*"[^>]*title="([^"]*)"',
    re.I,
)
PAGE_RE = re.compile(r"page=(\d+)", re.I)
PHOTO_RE = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)

sys.path.insert(0, str(ROOT / "scripts"))
from plp_sofa_bounds import detect_sofa_bounds  # noqa: E402

from PIL import Image  # noqa: E402


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def parse_cards(html: str) -> list[dict]:
    cards: list[dict] = []
    for block in CARD_RE.findall(html):
        im = IMG_RE.search(block)
        tl = TITLE_LINK_RE.search(block)
        if not im or not tl:
            continue
        src = im.group(1)
        pm = PHOTO_RE.search(src)
        photo = pm.group(1).lower() if pm else ""
        href, title_attr = tl.group(1), tl.group(2)
        tm = re.search(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", block, re.I | re.S)
        title = tm.group(1).strip() if tm else title_attr.split(",")[0].strip()
        code_m = re.search(r",\s*([^,\"]+)\s*\"?\s*$", title_attr)
        code = code_m.group(1).strip() if code_m else ""
        sku_m = re.search(r"/product-p/([^./]+)\.htm", href, re.I)
        slug = sku_m.group(1) if sku_m else ""
        cards.append({"title": title, "href": href, "code": code or slug, "photo": photo})
    return cards


def all_pages(cat: str) -> list[tuple[int, str]]:
    base = SITE + cat
    sep = "&" if "?" in cat else "?"
    html0 = fetch(base)
    pages = {1}
    for m in PAGE_RE.finditer(html0):
        pages.add(int(m.group(1)))
    out: list[tuple[int, str]] = [(1, html0)]
    for p in sorted(pages):
        if p == 1:
            continue
        try:
            out.append((p, fetch(f"{base}{sep}Page={p}")))
        except urllib.error.HTTPError:
            pass
    return out


def is_sofa_or_sectional(title: str, href: str, code: str) -> bool:
    tlow = title.lower()
    href_low = href.lower()
    if "bean bag" in tlow or "/product-p/bb" in href_low:
        return False
    if any(x in tlow for x in ("ottoman", "chair", "recliner", "chaise", "console", "swivel")):
        if not any(x in tlow for x in ("sofa", "sectional", "loveseat")) and "-sc-" not in href_low:
            return False
    return (
        "sofa" in tlow
        or "sectional" in tlow
        or "loveseat" in tlow
        or "-sc-" in href_low
        or bool(re.search(r"\b(17[0-9]|40[0-9]{3}|41[0-9]{3}|42[0-9]{3}|43[0-9]{3}|77[0-9]{3}|776[0-9]{2})\b", code))
    )


def main() -> int:
    ref_hashes: dict[str, str] = {}
    for name in ("bb-chinchilla-1.jpg", "bb-nest-closeout-1.jpg", "xl-chinchilla-1.jpg", "bb-nest-1.png"):
        p = PHOTOS / name
        if p.is_file():
            ref_hashes[name] = md5_hex(p.read_bytes())

    products: dict[str, dict] = {}
    for cat in CATEGORIES:
        try:
            pages = all_pages(cat)
        except Exception as exc:
            print(f"SKIP {cat}: {exc}", file=sys.stderr)
            continue
        for _pg, html in pages:
            for c in parse_cards(html):
                key = c["href"].lower()
                if key not in products:
                    products[key] = {**c, "categories": set()}
                products[key]["categories"].add(cat)

    bean_patterns = re.compile(r"bb-|chinchilla|bean|nest-closeout|xl-chinchilla", re.I)
    photo_cache: dict[str, dict] = {}
    missing: list[tuple[str, str, str, str, list[str]]] = []

    for href, p in sorted(products.items(), key=lambda x: x[1]["title"].lower()):
        if not is_sofa_or_sectional(p["title"], href, p["code"]):
            continue

        photo = p["photo"]
        title = p["title"]
        code = p["code"]
        reason: str | None = None

        if not photo:
            reason = "no photo"
        elif bean_patterns.search(photo):
            reason = "bean-bag filename"
        elif photo.startswith("{"):
            reason = "Volusion placeholder token"
        else:
            if photo not in photo_cache:
                url = f"{SITE}/v/vspfiles/photos/{photo}"
                try:
                    data = fetch_bytes(url)
                    photo_cache[photo] = {"md5": md5_hex(data), "bytes": data}
                except Exception as exc:
                    photo_cache[photo] = {"err": str(exc)}
            pc = photo_cache[photo]
            if "err" in pc:
                reason = "photo fetch failed"
            else:
                h = pc["md5"]
                for rname, rh in ref_hashes.items():
                    if h == rh:
                        reason = f"matches {rname}"
                        break
                if not reason:
                    try:
                        img = Image.open(io.BytesIO(pc["bytes"]))
                        b = detect_sofa_bounds(img)
                        if b and b.visible_h >= 195 and b.min_y <= 30 and "-sc-" not in photo.lower():
                            reason = f"tall blob (visibleH={b.visible_h})"
                    except Exception:
                        pass
                if not reason and re.match(r"^\d", code or ""):
                    stem = photo.rsplit(".", 1)[0].lower()
                    if not stem.startswith(code.lower()) and code.lower() not in stem:
                        if re.match(r"^\d{5}-1\.jpg$", photo):
                            reason = "generic numeric -1.jpg thumb"

        if reason:
            missing.append((title, code, photo, reason, sorted(p["categories"])))

    print(f"Sofa/sectional products checked: {len(products)}")
    print(f"Missing stock photo: {len(missing)}\n")
    for title, code, photo, reason, cats in missing:
        href = next(v["href"] for v in products.values() if v["title"] == title)
        print(f"- {title}")
        print(f"  Code: {code or '(n/a)'} | Photo: {photo or '(none)'} | Why: {reason}")
        print(f"  PLP categories: {', '.join(cats)}")
        print(f"  URL: {href}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
