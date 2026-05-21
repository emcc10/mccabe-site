#!/usr/bin/env python3
"""Audit sofa/sectional products for bean-bag placeholder images (PLP + PDP)."""
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
UA = {"User-Agent": "Mozilla/5.0 (McCabe photo audit v2)"}

# All sofa/sectional-related category PLPs
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
    "/category-s/147.htm",
    "/category-s/149.htm",
    "/category-s/186.htm",
    "/category-s/175.htm",
    "/category-s/191.htm",
    "/category-s/142.htm",
    "/category-s/181.htm",
]

PRODUCT_LINK_RE = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*v-product__img[^"]*"',
    re.I,
)
TITLE_RE = re.compile(
    r'class="[^"]*v-product__title[^"]*"[^>]*title="([^"]*)"',
    re.I,
)
TITLE_TEXT_RE = re.compile(
    r'v-product__title[^>]*>\s*([^<]+?)\s*</a>',
    re.I | re.S,
)
IMG_IN_BLOCK_RE = re.compile(
    r'(<div class="v-product">.*?</div>\s*</div>\s*</div>)',
    re.I | re.S,
)
PHOTO_RE = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
PAGE_RE = re.compile(r"page=(\d+)", re.I)
PDP_IMG_RE = re.compile(
    r'id="product_photo"|name="product_photo"|product_photo[^>]+src="([^"]+)"',
    re.I,
)
FAUX_RE = re.compile(r"faux\s*fur|bean\s*bag|chinchilla|cordaroys", re.I)

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


def parse_products(html: str) -> list[dict]:
    items: list[dict] = []
    for block in IMG_IN_BLOCK_RE.findall(html):
        link_m = PRODUCT_LINK_RE.search(block)
        if not link_m:
            continue
        href = link_m.group(1)
        im = re.search(r"<img[^>]+src=\"([^\"]+)\"", block, re.I)
        photo = ""
        if im:
            pm = PHOTO_RE.search(im.group(1))
            if pm:
                photo = pm.group(1).lower()
        tm = TITLE_RE.search(block)
        title_attr = tm.group(1) if tm else ""
        ttext = TITLE_TEXT_RE.search(block)
        title = ttext.group(1).strip() if ttext else title_attr.split(",")[0].strip()
        code_m = re.search(r",\s*([^,\"]+)\s*\"?\s*$", title_attr)
        code = code_m.group(1).strip() if code_m else ""
        sku_m = re.search(r"/product-p/([^./]+)\.htm", href, re.I)
        if not code and sku_m:
            code = sku_m.group(1)
        items.append({"title": title, "href": href, "code": code, "photo": photo})
    return items


def all_pages(cat: str) -> str:
    base = SITE + cat
    sep = "&" if "?" in cat else "?"
    chunks = [fetch(base)]
    pages = {int(m.group(1)) for m in PAGE_RE.finditer(chunks[0])}
    for p in sorted(pages):
        if p <= 1:
            continue
        try:
            chunks.append(fetch(f"{base}{sep}Page={p}"))
        except urllib.error.HTTPError:
            pass
    return "\n".join(chunks)


def is_sofa_or_sectional(title: str, href: str) -> bool:
    tlow = title.lower()
    href_low = href.lower()
    if "bean bag" in tlow or "/product-p/bb" in href_low:
        return False
    skip_words = ("ottoman", "chair", "recliner", "chaise", "console", "swivel", "promo")
    if any(w in tlow for w in skip_words):
        if not any(w in tlow for w in ("sofa", "sectional", "loveseat")):
            return False
    return any(w in tlow for w in ("sofa", "sectional", "loveseat")) or "-sc-" in href_low


def classify_photo(photo: str, code: str, cache: dict, ref_hashes: dict) -> str | None:
    if not photo or photo.startswith("{"):
        return "no PLP photo (Volusion {CODE} token)"
    if re.search(r"bb-|chinchilla|bean|nest-closeout|xl-chinchilla", photo, re.I):
        return "bean-bag filename"

    if photo not in cache:
        url = f"{SITE}/v/vspfiles/photos/{photo}"
        try:
            data = fetch_bytes(url)
            cache[photo] = {"md5": md5_hex(data), "bytes": data}
        except Exception as exc:
            cache[photo] = {"err": str(exc)}
    pc = cache[photo]
    if "err" in pc:
        return "photo missing on server"

    h = pc["md5"]
    for rname, rh in ref_hashes.items():
        if h == rh:
            return f"same image as {rname}"

    # Known wrong default used on reclining sectionals (bean-bag-like flat blob in bounds map)
    if photo == "77675-1.jpg":
        return "77675-1.jpg placeholder (not product-specific stock)"

    try:
        img = Image.open(io.BytesIO(pc["bytes"]))
        b = detect_sofa_bounds(img)
        if b:
            # Bean-bag / round tall product on PLP canvas
            if b.visible_h >= 195 and b.min_y <= 30 and "-sc-" not in photo.lower():
                return f"tall round silhouette (visibleH={b.visible_h}) — likely bean bag"
            # Very flat blob — often wrong default thumb
            if b.visible_h <= 85 and b.visible_w >= 280 and "-sc-" not in photo.lower():
                if code and code.lower() not in photo.lower().replace(".jpg", ""):
                    return f"flat generic thumb (visibleH={b.visible_h}) — likely placeholder"
    except Exception:
        pass

    return None


def pdp_has_bean_placeholder(href: str) -> tuple[str | None, str | None]:
    try:
        html = fetch(href)
    except Exception:
        return None, None
    content = html
    for marker in ("content_area", "v65-product-parent"):
        m = re.search(rf'id="{marker}"[^>]*>(.*)', html, re.I | re.S)
        if m:
            content = m.group(1)[:120000]
            break
    if FAUX_RE.search(content[:80000]):
        return "PDP copy mentions faux fur / bean bag", None
    # main product image
    for pat in (
        r'product_photo.*?<img[^>]+src="([^"]+)"',
        r'<img[^>]+id="product_photo"[^>]+src="([^"]+)"',
        r'name="product_photo"[^>]*src="([^"]+)"',
    ):
        m = re.search(pat, html, re.I | re.S)
        if m:
            pm = PHOTO_RE.search(m.group(1))
            if pm:
                return None, pm.group(1).lower()
    return None, None


def main() -> int:
    ref_hashes: dict[str, str] = {}
    for name in ("bb-chinchilla-1.jpg", "bb-nest-closeout-1.jpg", "xl-chinchilla-1.jpg"):
        p = PHOTOS / name
        if p.is_file():
            ref_hashes[name] = md5_hex(p.read_bytes())
    # include live 77675 if present
    try:
        data = fetch_bytes(f"{SITE}/v/vspfiles/photos/77675-1.jpg")
        ref_hashes["77675-1.jpg"] = md5_hex(data)
    except Exception:
        pass

    products: dict[str, dict] = {}
    for cat in CATEGORIES:
        try:
            html = all_pages(cat)
        except Exception as exc:
            print(f"SKIP {cat}: {exc}", file=sys.stderr)
            continue
        for item in parse_products(html):
            if not is_sofa_or_sectional(item["title"], item["href"]):
                continue
            key = item["href"].lower()
            if key not in products:
                products[key] = {**item, "categories": set()}
            products[key]["categories"].add(cat)
            if item["photo"] and not products[key]["photo"]:
                products[key]["photo"] = item["photo"]

    cache: dict[str, dict] = {}
    missing: list[dict] = []

    for href, p in sorted(products.items(), key=lambda x: x[1]["title"].lower()):
        reasons: list[str] = []
        plp_reason = classify_photo(p.get("photo", ""), p.get("code", ""), cache, ref_hashes)
        if plp_reason:
            reasons.append(f"PLP: {plp_reason}")

        pdp_text, pdp_photo = pdp_has_bean_placeholder(p["href"])
        if pdp_text:
            reasons.append(pdp_text)
        if pdp_photo:
            pdp_class = classify_photo(pdp_photo, p.get("code", ""), cache, ref_hashes)
            if pdp_class:
                reasons.append(f"PDP image: {pdp_class}")

        if reasons:
            missing.append(
                {
                    "title": p["title"],
                    "code": p.get("code", ""),
                    "photo": p.get("photo", ""),
                    "href": p["href"],
                    "categories": sorted(p["categories"]),
                    "reasons": reasons,
                }
            )

    print(f"Sofa/sectional SKUs found: {len(products)}")
    print(f"Need stock photo: {len(missing)}\n")
    for row in missing:
        print(f"- {row['title']}")
        print(f"  Code: {row['code'] or '(n/a)'} | PLP photo: {row['photo'] or '(none)'}")
        for r in row["reasons"]:
            print(f"  • {r}")
        print(f"  Categories: {', '.join(row['categories'])}")
        print(f"  URL: {row['href']}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
