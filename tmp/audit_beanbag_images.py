#!/usr/bin/env python3
"""Find sofa/sectional products whose PLP or PDP image matches the bean-bag placeholder."""
from __future__ import annotations

import hashlib
import re
import urllib.error
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (beanbag audit)"}

CATEGORIES = [
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

BLOCK_RE = re.compile(
    r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>',
    re.I | re.S,
)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
TITLE_LINK_RE = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*v-product__title',
    re.I,
)
TITLE_TEXT_RE = re.compile(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", re.I | re.S)
PHOTO_RE = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png))", re.I)
PAGE_RE = re.compile(r"page=(\d+)", re.I)
PDP_PHOTO_RE = re.compile(
    r'id="product_photo"[^>]*src="([^"]+)"|src="([^"]+)"[^>]*id="product_photo"',
    re.I,
)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def parse_block(block: str) -> dict | None:
    tl = TITLE_LINK_RE.search(block)
    im = IMG_RE.search(block)
    if not tl:
        return None
    href = tl.group(1)
    photo = ""
    if im:
        pm = PHOTO_RE.search(im.group(1))
        if pm:
            photo = pm.group(1).lower()
    tt = TITLE_TEXT_RE.search(block)
    title = tt.group(1).strip() if tt else href
    return {"title": title, "href": href, "photo": photo}


def is_target(title: str, href: str) -> bool:
    t = title.lower()
    h = href.lower()
    if "bean bag" in t or "/product-p/bb" in h:
        return False
    if any(w in t for w in ("ottoman", "chair", "chaise", "console", "swivel")):
        if not any(w in t for w in ("sofa", "sectional", "loveseat")):
            return False
    return any(w in t for w in ("sofa", "sectional", "loveseat")) or "-sc-" in h


def collect_products() -> dict[str, dict]:
    products: dict[str, dict] = {}
    for cat in CATEGORIES:
        try:
            html = fetch(SITE + cat)
        except Exception as exc:
            print(f"skip {cat}: {exc}", file=sys.stderr)
            continue
        pages = {1}
        for m in PAGE_RE.finditer(html):
            pages.add(int(m.group(1)))
        html_all = html
        sep = "&" if "?" in cat else "?"
        for p in sorted(pages):
            if p <= 1:
                continue
            try:
                html_all += fetch(f"{SITE}{cat}{sep}Page={p}")
            except urllib.error.HTTPError:
                pass
        for block in BLOCK_RE.findall(html_all):
            item = parse_block(block)
            if not item or not is_target(item["title"], item["href"]):
                continue
            key = item["href"].lower()
            if key not in products:
                products[key] = {**item, "categories": set()}
            products[key]["categories"].add(cat)
            if item["photo"]:
                products[key]["photo"] = item["photo"]
    return products


def pdp_photo(href: str) -> str:
    try:
        html = fetch(href)
    except Exception:
        return ""
    m = PDP_PHOTO_RE.search(html)
    if not m:
        return ""
    src = m.group(1) or m.group(2) or ""
    pm = PHOTO_RE.search(src)
    return pm.group(1).lower() if pm else ""


def main() -> int:
    import sys
    from pathlib import Path

    ref_path = Path(__file__).resolve().parents[1] / "vspfiles" / "photos" / "bb-chinchilla-1.jpg"
    ref_hash = md5(ref_path.read_bytes())
    ref_hashes = {ref_hash: "bb-chinchilla-1.jpg (white faux fur bean bag)"}
    for name in ("xl-chinchilla-1.jpg", "bb-nest-closeout-1.jpg"):
        p = ref_path.parent / name
        if p.is_file():
            ref_hashes[md5(p.read_bytes())] = name

    cache: dict[str, str] = {}
    products = collect_products()
    hits: list[dict] = []
    no_photo: list[dict] = []

    for href, p in sorted(products.items(), key=lambda x: x[1]["title"].lower()):
        photos_to_check: list[tuple[str, str]] = []
        if p.get("photo"):
            photos_to_check.append(("PLP", p["photo"]))
        if not p.get("photo") or p["photo"].startswith("{"):
            no_photo.append(p)
        pdp = pdp_photo(p["href"])
        if pdp and pdp != p.get("photo"):
            photos_to_check.append(("PDP", pdp))
        elif pdp:
            photos_to_check.append(("PDP", pdp))

        matched = []
        for where, photo in photos_to_check:
            if photo not in cache:
                try:
                    cache[photo] = md5(
                        fetch_bytes(f"{SITE}/v/vspfiles/photos/{photo}")
                    )
                except Exception:
                    cache[photo] = ""
            h = cache[photo]
            if h and h in ref_hashes:
                matched.append(f"{where}: {photo} = {ref_hashes[h]}")

        if matched:
            hits.append({**p, "matched": matched, "pdp_photo": pdp})

    print(f"Scanned {len(products)} sofa/sectional products")
    print(f"Bean-bag image match: {len(hits)}")
    print(f"Missing/broken PLP photo token: {len(no_photo)}\n")

    if hits:
        print("=== Uses bean-bag placeholder image ===\n")
        for row in hits:
            print(f"- {row['title']}")
            for m in row["matched"]:
                print(f"  • {m}")
            print(f"  URL: {row['href']}")
            print()

    if no_photo:
        print("=== No PLP thumbnail (Volusion {CODE}-1.jpg) ===\n")
        for row in no_photo:
            print(f"- {row['title']}")
            print(f"  URL: {row['href']}")
            print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
