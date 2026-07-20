#!/usr/bin/env python3
"""Build official The Mahjong House descriptions for Volusion TMH products.

Reads Shopify product JSON (tmp/all-products.json), matches live Volusion
product names/codes, and writes:

  - catalog/tmh-imports/tmh_product_descriptions.json
  - catalog/tmh-imports/Products_Description_Import.csv  (Volusion admin import)
  - vspfiles/js/mc-tmh-product-descriptions.js           (PDP accordion override)

Run:
  python3 scripts/build_tmh_descriptions.py
"""
from __future__ import annotations

import csv
import json
import os
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOPIFY_JSON = ROOT / "tmp" / "all-products.json"
OUT_DIR = ROOT / "catalog" / "tmh-imports"
JS_PATH = ROOT / "vspfiles" / "js" / "mc-tmh-product-descriptions.js"

# Volusion title (normalized) -> Shopify title (normalized)
TITLE_ALIASES = {
    "tortoise and cream mod mahjong tiles": "tortoise and cream mod tiles",
    "celebration jokers pink": "celebration jokers",
    "celebration jokers white": "celebration jokers",
    "island travel mahjong tiles bright blue": "island travel mahjong tiles",
    "island travel mahjong tiles royal blue": "island travel mahjong tiles",
    "island travel mahjong tiles green": "island travel mahjong tiles",
    "island travel mahjong tiles salmon": "island travel mahjong tiles",
    "texas travel mahjong tiles hot pink": "texas travel mahjong tiles",
    "texas travel mahjong tiles olive": "texas travel mahjong tiles",
    "texas travel mahjong tiles pink": "texas travel mahjong tiles",
    "texas travel mahjong tiles turquoise": "texas travel mahjong tiles",
    "pale violet travel mahjong set as featured on oprah s o list": "pale violet travel mahjong set",
    "purple red and green double sided mahjong mat": "purple and red flower border mahjong mat",
    "purple red and green double sided travel mahjong mat": "purple and red flower border mahjong mat",
}


def norm(s: str) -> str:
    s = unescape(s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def clean_body(html: str) -> str:
    """Normalize Shopify body_html into simple <p> blocks for the PDP accordion."""
    if not html:
        return ""
    html = unescape(html)
    html = re.sub(r"(?is)<meta[^>]*>", "", html)
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", "", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", "", html)
    html = re.sub(r"(?i)<br\s*/?>", " ", html)

    def flatten_text(chunk: str) -> str:
        text = re.sub(r"(?is)</?(?:div|span|font)[^>]*>", " ", chunk)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).replace("\xa0", " ").strip()

    blocks = re.findall(r"(?is)<p[^>]*>(.*?)</p>", html)
    out: list[str] = []
    for b in blocks:
        b = re.sub(r"(?is)</?(?:span|font|div|meta)[^>]*>", "", b)
        b = re.sub(r'\sstyle="[^"]*"', "", b)
        b = re.sub(r"(?is)</?(?!strong\b|b\b|em\b|i\b)[a-z][a-z0-9]*\b[^>]*>", "", b)
        b = re.sub(r"\s+", " ", b).replace("\xa0", " ").strip()
        if re.fullmatch(
            r"(?i)<(?:strong|b)>\s*product details\s*</(?:strong|b)>|product details",
            b,
        ):
            continue
        if b:
            out.append(f"<p>{b}</p>")
    if out:
        return "\n".join(out)

    # Many mats wrap copy in nested <div>/<span> with empty trailing <p>&nbsp;</p>.
    text = flatten_text(html)
    return f"<p>{text}</p>" if text else ""


def find_shop(title: str, shop_by_norm: dict):
    n = norm(title)
    if n in shop_by_norm:
        return shop_by_norm[n]
    if n in TITLE_ALIASES and TITLE_ALIASES[n] in shop_by_norm:
        return shop_by_norm[TITLE_ALIASES[n]]
    n2 = re.sub(r"\s*\(.*\)\s*", " ", n).strip()
    n2 = re.sub(r"\s+", " ", n2)
    if n2 in shop_by_norm:
        return shop_by_norm[n2]
    if n2 in TITLE_ALIASES and TITLE_ALIASES[n2] in shop_by_norm:
        return shop_by_norm[TITLE_ALIASES[n2]]
    if " - " in title:
        base = norm(title.split(" - ")[0])
        if base in shop_by_norm:
            return shop_by_norm[base]
        if base in TITLE_ALIASES and TITLE_ALIASES[base] in shop_by_norm:
            return shop_by_norm[TITLE_ALIASES[base]]
    return None


def fetch_live(code: str):
    url = f"https://www.mccabestheaterandliving.com/product-p/{code.lower()}.htm"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=35).read().decode("utf-8", "ignore")
    except Exception:
        return None
    cm = re.search(
        r'name=["\']ProductCode["\'][^>]*value=["\']([^"\']+)', html, re.I
    )
    if not cm or cm.group(1).upper() != code.upper():
        return None
    nm = re.search(
        r'<span[^>]*itemprop=["\']name["\'][^>]*>([^<]{2,160})</span>', html, re.I
    )
    name = nm.group(1).strip() if nm else ""
    if not name or name.startswith("(function"):
        return None
    return {"code": code, "name": name}


def discover_codes() -> list[str]:
    codes: set[str] = set()
    photos = ROOT / "vspfiles" / "photos"
    if photos.is_dir():
        for fn in os.listdir(photos):
            m = re.match(r"(TMH-[A-Z0-9-]+)-\d", fn)
            if m:
                codes.add(m.group(1))
    codes.add("TMH-TILE-GRN-WHT-HOUSE")
    return sorted(codes)


def main() -> int:
    with SHOPIFY_JSON.open(encoding="utf-8") as f:
        shop_products = json.load(f)["products"]

    shop_by_norm: dict = {}
    for p in shop_products:
        shop_by_norm[norm(p["title"])] = p
        shop_by_norm[norm(p["title"].replace("Mahjong", ""))] = p

    codes = discover_codes()
    live: list[dict] = []
    with ThreadPoolExecutor(18) as ex:
        futs = [ex.submit(fetch_live, c) for c in codes]
        for fut in as_completed(futs):
            row = fut.result()
            if row:
                live.append(row)

    desc_map: dict = {}
    unmatched: list = []
    for row in sorted(live, key=lambda x: x["code"]):
        sp = find_shop(row["name"], shop_by_norm)
        if not sp:
            unmatched.append({**row, "reason": "no shopify match"})
            continue
        cleaned = clean_body(sp.get("body_html") or "")
        plain = re.sub(r"<[^>]+>", " ", cleaned)
        plain = re.sub(r"\s+", " ", plain).strip()
        if len(plain) < 40:
            unmatched.append({**row, "reason": "thin description"})
            continue
        desc_map[row["code"]] = {
            "title": row["name"],
            "shopifyTitle": sp["title"],
            "shopifyHandle": sp["handle"],
            "html": cleaned,
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "tmh_product_descriptions.json").write_text(
        json.dumps(desc_map, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    csv_path = OUT_DIR / "Products_Description_Import.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["productcode", "productdescription"])
        w.writeheader()
        for code, meta in sorted(desc_map.items()):
            w.writerow(
                {"productcode": code, "productdescription": meta["html"]}
            )

    runtime = {k: v["html"] for k, v in desc_map.items()}
    js = (
        "/* mc-tmh-product-descriptions.js — official themahjonghouse.com copy for TMH PDPs */\n"
        "/* Generated by scripts/build_tmh_descriptions.py; shown in Product Details accordion. */\n"
        "(function (g) {\n"
        '  "use strict";\n'
        "  g.MC_TMH_PRODUCT_DESCRIPTIONS = "
        + json.dumps(runtime, ensure_ascii=False)
        + ";\n"
        "})(typeof window !== \"undefined\" ? window : this);\n"
    )
    JS_PATH.write_text(js, encoding="utf-8")

    readme = OUT_DIR / "README.md"
    readme.write_text(
        "# The Mahjong House product descriptions\n\n"
        "Official copy sourced from [themahjonghouse.com](https://themahjonghouse.com) "
        "(Shopify `body_html`), matched to Volusion `TMH-*` product codes.\n\n"
        "## Live PDP override\n\n"
        "`vspfiles/js/mc-tmh-product-descriptions.js` is loaded on Mahjong House PDPs and "
        "writes the official description into the **Product Details** accordion.\n\n"
        "## Permanent catalog import (optional)\n\n"
        "In Volusion admin → Inventory → Import/Export → Products, import "
        "`Products_Description_Import.csv` (update existing products by product code).\n\n"
        f"Current map: **{len(desc_map)}** products. Unmatched: **{len(unmatched)}**.\n\n"
        "Regenerate:\n\n```bash\npython3 scripts/build_tmh_descriptions.py\n```\n",
        encoding="utf-8",
    )

    print(f"Live TMH products: {len(live)}")
    print(f"Matched descriptions: {len(desc_map)}")
    print(f"Unmatched: {len(unmatched)}")
    for u in unmatched:
        print(f"  {u['code']}: {u.get('name')} ({u.get('reason')})")
    print(f"Wrote {OUT_DIR / 'tmh_product_descriptions.json'}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {JS_PATH} ({JS_PATH.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
