#!/usr/bin/env python3
"""
Scan ALL pages of ALL sofa/sectional category PLPs for missing stock photos.

Volusion serves paginated grids at:
  /searchresults.asp?cat={categoryId}&page={n}
(category-s/...?Page=N repeats page 1 — do not use for pagination)

Also parses table-layout PLPs (e.g. loveseats 157) from category-s HTML.

Usage:
  py -3 scripts/audit_plp_missing_stock_photos.py
  py -3 scripts/audit_plp_missing_stock_photos.py --json tmp/plp-missing-stock.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "vspfiles" / "photos"
PATHS_FILE = ROOT / "scripts" / "plp_category_paths.txt"
SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP stock-photo audit v2)"}

BLOCK_RE = re.compile(
    r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>',
    re.I | re.S,
)
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
TITLE_LINK_RE = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*v-product__title',
    re.I,
)
TITLE_ATTR_RE = re.compile(
    r'class="[^"]*v-product__title[^"]*"[^>]*title="([^"]*)"',
    re.I,
)
TITLE_TEXT_RE = re.compile(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", re.I | re.S)
PHOTO_RE = re.compile(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png|gif))", re.I)
CAT_ID_RE = re.compile(r"/category-s/(\d+)\.htm", re.I)
CODE_FROM_TITLE_RE = re.compile(r",\s*([^,\"]+)\s*\"?\s*$")
BEAN_FILE_RE = re.compile(r"bb-|chinchilla|xl-chinchilla|nest-closeout", re.I)
PRODUCTNAME_RE = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*productnamecolor',
    re.I,
)

# Sofa / sectional category IDs from site nav (SOFAS & SECTIONALS tree)
SOFA_CAT_IDS = {
    "132", "135", "139", "147", "157", "175", "176", "177", "178", "179",
    "181", "186", "187", "188", "191", "192",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read().decode("utf-8", "replace")


def fetch_bytes(url: str) -> bytes | None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def md5_hex(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def load_category_entries(extra_discover: bool) -> list[tuple[str, str]]:
    """Return list of (path, category_id)."""
    entries: list[tuple[str, str]] = []
    seen_paths: set[str] = set()

    def add(path: str) -> None:
        path = path.split("?")[0]
        if not path.startswith("/"):
            path = "/" + path
        m = CAT_ID_RE.search(path)
        if not m:
            return
        cid = m.group(1)
        if path not in seen_paths:
            seen_paths.add(path)
            entries.append((path, cid))

    if PATHS_FILE.is_file():
        for line in PATHS_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                add(line)

    if extra_discover:
        for seed in ["/category-s/139.htm", "/category-s/135.htm"]:
            try:
                html = fetch(SITE + seed)
            except Exception:
                continue
            for m in CAT_ID_RE.finditer(html):
                add(f"/category-s/{m.group(1)}.htm")

    return entries


def parse_grid_blocks(html: str) -> list[dict]:
    items: list[dict] = []
    for block in BLOCK_RE.findall(html):
        tl = TITLE_LINK_RE.search(block)
        if not tl:
            continue
        href = tl.group(1)
        img_src = ""
        im = IMG_RE.search(block)
        photo_file = ""
        if im:
            img_src = im.group(1).strip()
            pm = PHOTO_RE.search(img_src)
            if pm:
                photo_file = pm.group(1).lower()
        tt = TITLE_TEXT_RE.search(block)
        title = tt.group(1).strip() if tt else ""
        code = ""
        ta = TITLE_ATTR_RE.search(block)
        if ta:
            cm = CODE_FROM_TITLE_RE.search(ta.group(1))
            if cm:
                code = cm.group(1).strip()
        if not title and ta:
            title = ta.group(1).split(",")[0].strip()
        items.append(
            {
                "title": title or href,
                "href": href,
                "img_src": img_src,
                "photo_file": photo_file,
                "code": code,
            }
        )
    return items


def parse_table_plp(html: str) -> list[dict]:
    items: list[dict] = []
    for m in PRODUCTNAME_RE.finditer(html):
        if "productnamecolorsmall" in m.group(0).lower():
            continue
        href = m.group(1)
        chunk = html[max(0, m.start() - 3000) : m.end() + 200]
        title_m = re.search(r">([^<]{2,200})<", html[m.end() : m.end() + 150])
        title = unescape(title_m.group(1).strip()) if title_m else href
        img_src = ""
        photo_file = ""
        for im in re.finditer(r'<img[^>]+src="([^"]+)"', chunk, re.I):
            src = im.group(1)
            if "nophoto" in src.lower() or "/photos/" in src.lower():
                img_src = src
                pm = PHOTO_RE.search(src)
                if pm:
                    photo_file = pm.group(1).lower()
                break
        items.append(
            {
                "title": title,
                "href": href,
                "img_src": img_src,
                "photo_file": photo_file,
                "code": "",
            }
        )
    return items


def fetch_searchresults_pages(cat_id: str) -> list[tuple[int, str]]:
    """Paginate via searchresults.asp until no new products."""
    pages: list[tuple[int, str]] = []
    seen_first: list[str] = []
    for page in range(1, 50):
        url = f"{SITE}/searchresults.asp?cat={cat_id}&page={page}"
        try:
            html = fetch(url)
        except urllib.error.HTTPError:
            break
        titles = [
            t.strip()
            for t in TITLE_TEXT_RE.findall(html)
            if t.strip()
        ]
        if not titles:
            break
        first3 = titles[:3]
        if page > 1 and first3 == seen_first[-1]:
            break
        seen_first.append(first3)
        pages.append((page, html))
    return pages


def collect_category(cat_path: str, cat_id: str) -> tuple[list[dict], int]:
    """All products from searchresults pages + table-only extras on category-s."""
    by_href: dict[str, dict] = {}

    sr_pages = fetch_searchresults_pages(cat_id)
    if not sr_pages and cat_id == "192":
        try:
            html_pl = fetch(f"{SITE}/productslist.asp?CategoryID={cat_id}")
            sr_pages = [(1, html_pl)]
        except Exception:
            pass
    n_sr_pages = len(sr_pages)
    for page_num, html in sr_pages:
        for item in parse_grid_blocks(html):
            key = item["href"].lower()
            if key not in by_href:
                item["sources"] = []
            else:
                item = {**by_href[key], **{k: v for k, v in item.items() if v}}
            item.setdefault("sources", []).append(f"searchresults p{page_num}")
            item["cat_path"] = cat_path
            item["cat_id"] = cat_id
            by_href[key] = item

    # category-s page 1: table layout products not always in searchresults
    try:
        html_cat = fetch(SITE + cat_path)
    except Exception:
        return list(by_href.values()), n_sr_pages

    grid_on_cat = parse_grid_blocks(html_cat)
    table_on_cat = parse_table_plp(html_cat)

    for item in grid_on_cat + table_on_cat:
        key = item["href"].lower()
        if key in by_href:
            if not by_href[key].get("photo_file") and item.get("photo_file"):
                by_href[key]["photo_file"] = item["photo_file"]
                by_href[key]["img_src"] = item.get("img_src", "")
            continue
        item["sources"] = ["category-s table/grid"]
        item["cat_path"] = cat_path
        item["cat_id"] = cat_id
        by_href[key] = item

    return list(by_href.values()), n_sr_pages


def bean_hashes() -> dict[str, str]:
    out: dict[str, str] = {}
    for name in (
        "bb-chinchilla-1.jpg",
        "xl-chinchilla-1.jpg",
        "bb-nest-closeout-1.jpg",
        "bb-nest-1.png",
    ):
        p = PHOTOS / name
        if p.is_file():
            out[md5_hex(p.read_bytes())] = name
    return out


def is_sofa_or_sectional(title: str, href: str, cat_id: str) -> bool:
    t, h = title.lower(), href.lower()
    if "bean bag" in t and "sofa" not in t and "sectional" not in t:
        return False
    if not (any(w in t for w in ("sofa", "sectional", "loveseat")) or "-sc-" in h):
        return False
    # Recliner SKUs in recliner categories are not sofas (even if cat is under Sofas nav)
    if re.search(r"\brecliner\b", t) and "sofa" not in t and "loveseat" not in t:
        return False
    if any(w in t for w in ("ottoman", "chair", "chaise", "console", "swivel")):
        if not any(w in t for w in ("sofa", "sectional", "loveseat")):
            return False
    return True


def classify_plp(item: dict, beans: dict[str, str], hash_cache: dict[str, str]) -> list[str]:
    reasons: list[str] = []
    src = item.get("img_src", "")
    photo = item.get("photo_file", "")

    if not src:
        reasons.append("no image on PLP")
    elif "nophoto" in src.lower():
        reasons.append("PLP uses NoPhoto.gif")
    elif "{" in src and "code" in src.lower():
        reasons.append("PLP Volusion {CODE} template")
    elif not photo and "templates/" in src.lower():
        reasons.append("PLP template placeholder (not product photo)")

    if photo and BEAN_FILE_RE.search(photo):
        reasons.append(f"PLP bean-bag image file: {photo}")

    if photo and "nophoto" not in photo.lower():
        h = hash_cache.get(photo)
        if h is None:
            local = PHOTOS / photo
            if not local.is_file():
                local = PHOTOS / photo.replace("%20", " ")
            if local.is_file():
                h = md5_hex(local.read_bytes())
            else:
                data = fetch_bytes(f"{SITE}/v/vspfiles/photos/{photo}")
                if data is None:
                    reasons.append(f"PLP photo 404: {photo}")
                    h = ""
                elif len(data) < 100:
                    reasons.append(f"PLP photo empty/tiny: {photo}")
                    h = ""
                else:
                    h = md5_hex(data)
            hash_cache[photo] = h or ""
        if h and h in beans:
            reasons.append(f"PLP is white faux fur bean bag ({beans[h]})")

    return reasons


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, help="Write JSON results")
    parser.add_argument("--no-discover", action="store_true")
    args = parser.parse_args()

    entries = load_category_entries(extra_discover=not args.no_discover)
    # Focus on sofa/sectional category IDs only
    entries = [(p, c) for p, c in entries if c in SOFA_CAT_IDS]

    print(f"Scanning {len(entries)} sofa/sectional categories (searchresults pagination)", file=sys.stderr)

    beans = bean_hashes()
    hash_cache: dict[str, str] = {}
    all_products: dict[str, dict] = {}
    page_totals: dict[str, int] = {}

    for cat_path, cat_id in entries:
        try:
            items, sr_count = collect_category(cat_path, cat_id)
        except Exception as exc:
            print(f"SKIP {cat_path}: {exc}", file=sys.stderr)
            continue
        page_totals[cat_path] = sr_count
        print(
            f"  {cat_path} (id {cat_id}): {sr_count} searchresults page(s), "
            f"{len(items)} unique product(s)",
            file=sys.stderr,
        )
        for item in items:
            key = item["href"].lower()
            if key not in all_products:
                all_products[key] = item
            else:
                all_products[key].setdefault("also_in", []).append(cat_path)

    missing_sofa: list[dict] = []
    for href, p in sorted(all_products.items(), key=lambda x: x[1]["title"].lower()):
        if not is_sofa_or_sectional(p["title"], href, p.get("cat_id", "")):
            continue
        reasons = classify_plp(p, beans, hash_cache)
        if reasons:
            missing_sofa.append(
                {
                    "title": p["title"],
                    "code": p.get("code", ""),
                    "href": p["href"],
                    "photo_file": p.get("photo_file", ""),
                    "reasons": reasons,
                    "category": p.get("cat_path", ""),
                    "sources": p.get("sources", []),
                }
            )

    total_pages = sum(page_totals.values())
    print(file=sys.stderr)
    print(
        f"Total: ~{total_pages} searchresults pages, {len(all_products)} unique URLs, "
        f"{len(missing_sofa)} sofas/sectionals need stock photo\n",
        file=sys.stderr,
    )

    print("=" * 70)
    print(f"SOFAS & SECTIONALS — NEED STOCK PHOTO ({len(missing_sofa)})")
    print("=" * 70)
    for i, row in enumerate(missing_sofa, 1):
        print(f"\n{i}. {row['title']}")
        if row["code"]:
            print(f"   Code: {row['code']}")
        print(f"   {row['href']}")
        if row["photo_file"]:
            print(f"   PLP file: {row['photo_file']}")
        print(f"   Category: {row['category']}")
        for r in row["reasons"]:
            print(f"   - {r}")

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps(
                {
                    "page_totals": page_totals,
                    "total_products": len(all_products),
                    "missing_sofa_sectional": missing_sofa,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        print(f"\nJSON: {args.json}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
