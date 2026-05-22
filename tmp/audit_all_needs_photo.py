#!/usr/bin/env python3
"""Find sofas/sectionals needing stock photos: bean-bag image, NoPhoto, missing PLP thumb."""
from __future__ import annotations

import hashlib
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}

CATEGORIES = [
    "/category-s/177.htm",
    "/category-s/187.htm",
    "/category-s/188.htm",
    "/category-s/157.htm",
    "/category-s/178.htm",
    "/category-s/176.htm",
    "/category-s/179.htm",
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
BEAN_FILE_RE = re.compile(r"bb-|chinchilla|xl-chinchilla|nest-closeout", re.I)
CODE_RE = re.compile(r",\s*([^,\"]+)\s*\"?\s*$")


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


def bean_hashes() -> dict[str, str]:
    out: dict[str, str] = {}
    for name in ("bb-chinchilla-1.jpg", "xl-chinchilla-1.jpg", "bb-nest-closeout-1.jpg"):
        p = PHOTOS / name
        if p.is_file():
            out[md5(p.read_bytes())] = name
    return out


def parse_block(block: str) -> dict | None:
    tl = TITLE_LINK_RE.search(block)
    if not tl:
        return None
    href = tl.group(1)
    photo = ""
    im = IMG_RE.search(block)
    if im:
        pm = PHOTO_RE.search(im.group(1))
        if pm:
            photo = pm.group(1).lower()
    tt = TITLE_TEXT_RE.search(block)
    title = tt.group(1).strip() if tt else href
    code = ""
    tm = re.search(
        r'v-product__title[^"]*"[^>]*title="([^"]*)"',
        block,
        re.I,
    )
    if tm:
        cm = CODE_RE.search(tm.group(1))
        if cm:
            code = cm.group(1).strip()
    return {"title": title, "href": href, "photo": photo, "code": code}


def is_sofa_sectional(title: str, href: str) -> bool:
    t, h = title.lower(), href.lower()
    if "bean bag" in t or "/product-p/bb" in h:
        return False
    if any(w in t for w in ("ottoman", "chair", "chaise", "console", "swivel")):
        if not any(w in t for w in ("sofa", "sectional", "loveseat")):
            return False
    return any(w in t for w in ("sofa", "sectional", "loveseat")) or "-sc-" in h


def collect() -> dict[str, dict]:
    products: dict[str, dict] = {}
    for cat in CATEGORIES:
        try:
            html = fetch(SITE + cat)
        except Exception:
            continue
        pages = {int(m.group(1)) for m in PAGE_RE.finditer(html)}
        chunks = [html]
        sep = "&" if "?" in cat else "?"
        for p in sorted(pages):
            if p <= 1:
                continue
            try:
                chunks.append(fetch(f"{SITE}{cat}{sep}Page={p}"))
            except urllib.error.HTTPError:
                pass
        for block in BLOCK_RE.findall("\n".join(chunks)):
            item = parse_block(block)
            if not item or not is_sofa_sectional(item["title"], item["href"]):
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
    return (m.group(1) or m.group(2) or "").lower()


def hash_photo(photo: str, cache: dict[str, str]) -> str:
    if not photo or "nophoto" in photo:
        return ""
    if photo in cache:
        return cache[photo]
    local = PHOTOS / photo
    if not local.is_file():
        local = PHOTOS / photo.lower()
    if local.is_file():
        cache[photo] = md5(local.read_bytes())
    else:
        try:
            cache[photo] = md5(fetch_bytes(f"{SITE}/v/vspfiles/photos/{photo}"))
        except Exception:
            cache[photo] = ""
    return cache[photo]


def main() -> None:
    beans = bean_hashes()
    cache: dict[str, str] = {}
    products = collect()
    need: list[dict] = []

    for href, p in sorted(products.items(), key=lambda x: x[1]["title"].lower()):
        reasons: list[str] = []
        plp = p.get("photo", "")
        pdp = pdp_photo(p["href"])

        if not plp or plp.startswith("{"):
            reasons.append("Missing PLP thumbnail")

        if plp and BEAN_FILE_RE.search(plp):
            reasons.append(f"PLP uses bean-bag file: {plp}")

        if plp:
            h = hash_photo(plp, cache)
            if h and h in beans:
                reasons.append(f"PLP shows white faux fur bean bag ({beans[h]})")

        if not pdp or "nophoto.gif" in pdp:
            reasons.append("PDP has no product photo (NoPhoto.gif)")
        elif BEAN_FILE_RE.search(pdp):
            reasons.append(f"PDP uses bean-bag file")
        else:
            pm = PHOTO_RE.search(pdp)
            if pm:
                dh = hash_photo(pm.group(1).lower(), cache)
                if dh and dh in beans:
                    reasons.append(f"PDP shows white faux fur bean bag ({beans[dh]})")

        if reasons:
            need.append(
                {
                    "title": p["title"],
                    "code": p.get("code", ""),
                    "href": p["href"],
                    "plp": plp or "(none)",
                    "pdp": pdp or "(none)",
                    "reasons": reasons,
                }
            )

    print(f"Audited {len(products)} sofa/sectional SKUs\n")
    print(f"=== Need stock photo ({len(need)}) ===\n")
    for i, r in enumerate(need, 1):
        print(f"{i}. {r['title']}")
        if r["code"]:
            print(f"   SKU/Code: {r['code']}")
        print(f"   {r['href']}")
        print(f"   PLP: {r['plp']}")
        print(f"   PDP: {r['pdp'][:120]}...")
        for reason in r["reasons"]:
            print(f"   - {reason}")
        print()


if __name__ == "__main__":
    main()
