#!/usr/bin/env python3
"""Scrape Annie accent chairs + Conroe power recliners → Volusion import + images.

Columns match prior McCabe Volusion packs only:
productcode, productname, productprice, productweight, freeshipping,
availability, productdescription, techspecs
"""
from __future__ import annotations

import csv
import json
import re
import time
import urllib.request
from html import unescape
from pathlib import Path

try:
    from openpyxl import Workbook
except ImportError:  # pragma: no cover
    import subprocess
    import sys

    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"])
    from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIR = ROOT / "vspfiles" / "photos"
OUT_DIRS = [
    ROOT / "docs" / "imports" / "steve-silver-volusion",
    ROOT / "vspfiles" / "imports" / "steve-silver-volusion",
]
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,*/*",
}

# Annie chairs from https://stevesilver.com/new-2/ plus Conroe power recliners.
# Optional productcode overrides numeric vendor SKUs to McCabe-style names.
PRODUCTS = [
    {
        "url": "https://stevesilver.com/product/annie-cotton-barrel-chair-w-casters/",
        "image_tokens": ["ANE500NS"],
    },
    {
        "url": "https://stevesilver.com/product/annie-cotton-barrel-chair-w-casters-2/",
        "image_tokens": ["ANE500WS"],
    },
    {
        "url": "https://stevesilver.com/product/annie-gray-velvet-barrel-chair-w-casters/",
        "image_tokens": ["ANE500GS"],
    },
    {
        "url": "https://stevesilver.com/product/conroe-power-recliner/",
        "productcode": "SS-CONROE-PWR-RECL",
        "image_tokens": ["3165612", "conroe_3165612"],
    },
    {
        "url": "https://stevesilver.com/product/conroe-dual-power-recliner-gray/",
        "productcode": "SS-CONROE-GRAY-PWR-RECL",
        "image_tokens": [
            "3165922",
            "conroegrayrecliner",
            "conroe_recliner_gray",
            "conroe_recliner_grey",
        ],
    },
]

COLUMNS = [
    "productcode",
    "productname",
    "productprice",
    "productweight",
    "freeshipping",
    "availability",
    "productdescription",
    "techspecs",
]


def get(url: str, retries: int = 6) -> tuple[str, str]:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=55) as r:
                return r.read().decode("utf-8", "replace"), r.geturl()
        except Exception as e:
            print(" fetch fail", url, e)
            time.sleep(1.5 + i * 2)
    return "", url


def clean_text(s: str) -> str:
    s = unescape(s or "")
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p\s*>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    for src, dst in (
        ("\u2033", '"'),
        ("\u2032", "'"),
        ("\u201d", '"'),
        ("\u201c", '"'),
        ("\u2019", "'"),
        ("\u2018", "'"),
        ("\u2014", "-"),
        ("\u2013", "-"),
        ("\u2022", "*"),
        ("\xa0", " "),
        ("\ufeff", ""),
        ("\ufffd", ""),
    ):
        s = s.replace(src, dst)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def volusion_code(sku: str) -> str:
    sku = (sku or "").strip().upper().replace(" ", "-")
    sku = re.sub(r"[^A-Z0-9_-]", "-", sku)
    sku = re.sub(r"-{2,}", "-", sku).strip("-")
    if not sku.startswith("SS-"):
        sku = "SS-" + sku
    return sku


def extract_images(html: str, tokens: list[str]) -> list[str]:
    raw: list[str] = []
    for pat in (
        r'data-large_image="([^"]+)"',
        r'woocommerce-product-gallery__image[\s\S]{0,500}?href="([^"]+)"',
        r"(https://stevesilver\.com/wp-content/uploads/\d{4}/\d{2}/[^\"'\s]+\.(?:jpe?g|png|webp))",
    ):
        raw.extend(re.findall(pat, html, re.I))

    tokens_l = [t.lower() for t in tokens if t]
    out: list[str] = []
    seen: set[str] = set()
    for u in raw:
        if not u.startswith("http"):
            continue
        u = u.split("?")[0]
        if re.search(r"-\d+x\d+\.(?:jpe?g|png|webp)$", u, re.I):
            continue
        base = u.rsplit("/", 1)[-1]
        bl = base.lower().replace("-", "").replace("_", "")
        if base in seen:
            continue
        if any(x in base.lower() for x in ("swatch", "swch", "logo", "favicon")):
            continue
        if tokens_l and not any(
            t.replace("-", "").replace("_", "") in bl for t in tokens_l
        ):
            continue
        seen.add(base)
        out.append(u)

    def rank(u: str) -> tuple:
        b = u.lower()
        score = 0
        if re.search(r"_ls1\b|_ls1\.|ls1\.", b) or b.endswith("reclinerls.jpg"):
            score -= 200
        elif re.search(r"_ls\d|ls\d", b):
            score -= 150
        elif re.search(r"_ws1\b|_ws1\.", b):
            score -= 120
        elif re.search(r"_ws\d|whitesweep", b):
            score -= 80
        elif re.search(r"_dtl|_vg", b):
            score -= 40
        return (score, u)

    return sorted(out, key=rank)


def extract_product(url: str, html: str, *, productcode: str = "", image_tokens: list[str] | None = None) -> dict:
    title_m = re.search(
        r'<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)', html, re.I
    )
    name = clean_text(title_m.group(1) if title_m else "")

    sku = ""
    for pat in [
        r'"sku"\s*:\s*"([^"]+)"',
        r'data-product_sku="([^"]+)"',
        r'<span class="sku">([^<]+)',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            sku = m.group(1).strip()
            break

    short = ""
    for block in re.findall(
        r'<script type="application/ld\+json"[^>]*>([\s\S]*?)</script>', html, re.I
    ):
        try:
            data = json.loads(block)
        except Exception:
            continue
        nodes = data.get("@graph", [data]) if isinstance(data, dict) else data
        if not isinstance(nodes, list):
            nodes = [nodes]
        for n in nodes:
            if isinstance(n, dict) and n.get("@type") == "Product" and n.get("description"):
                short = clean_text(n["description"])
                break
        if short:
            break

    bullets: list[str] = []
    tab = re.search(r'id="tab-description"([\s\S]*?)(?:id="tab-|$)', html, re.I)
    scope = tab.group(1) if tab else html
    for li in re.findall(r"<li[^>]*>([\s\S]*?)</li>", scope, re.I):
        t = clean_text(li)
        if len(t) < 12 or t.startswith("{") or "application/ld+json" in t:
            continue
        bullets.append(t)
    tech = "\n".join(f"* {b}" for b in bullets)

    availability = "Available"
    m_cls = re.search(
        r'<div[^>]+id="product-\d+"[^>]*class="([^"]+)"', html, re.I
    ) or re.search(r'class="(product type-product[^"]+)"', html, re.I)
    main_cls = m_cls.group(1).lower() if m_cls else ""
    if "outofstock" in main_cls:
        availability = "Out of Stock"
    elif "instock" in main_cls or re.search(r'class="stock in-stock"', html, re.I):
        availability = "Available"
    elif re.search(r'class="stock out-of-stock"', html, re.I):
        availability = "Out of Stock"

    code = productcode.strip() if productcode else (volusion_code(sku) if sku else "")
    tokens = list(image_tokens or [])
    if sku and sku not in tokens:
        tokens.insert(0, sku)

    return {
        "productcode": code,
        "productname": name,
        "productprice": "",
        "productweight": "",
        "freeshipping": "N",
        "availability": availability,
        "productdescription": short,
        "techspecs": tech,
        "vendor_sku": sku,
        "image_urls": extract_images(html, tokens),
    }


def download_images(code: str, urls: list[str]) -> list[str]:
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    saved: list[str] = []
    for idx, url in enumerate(urls[:12]):
        names = (
            [f"{code}-1.jpg", f"{code}-1T.jpg", f"{code}-2.jpg", f"{code}-2T.jpg"]
            if idx == 0
            else [f"{code}-altview{idx}.jpg"]
        )
        data = None
        for attempt in range(5):
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = r.read()
                if len(data) < 800:
                    raise ValueError("tiny")
                break
            except Exception as e:
                print("  img fail", url, e)
                data = None
                time.sleep(1 + attempt)
        if not data:
            continue
        for name in names:
            (PHOTO_DIR / name).write_bytes(data)
            saved.append(name)
            print(f"  wrote {name} ({len(data)} bytes)")
        time.sleep(0.3)
    return saved


def main() -> None:
    products: list[dict] = []
    upload_names: list[str] = []
    for i, spec in enumerate(PRODUCTS, 1):
        url = spec["url"]
        print(f"[{i}/{len(PRODUCTS)}] {url}")
        html, final = get(url)
        if not html:
            print("  FAIL")
            continue
        p = extract_product(
            final,
            html,
            productcode=spec.get("productcode", ""),
            image_tokens=spec.get("image_tokens", []),
        )
        print(
            " ",
            p["productcode"],
            p["productname"],
            p["availability"],
            "imgs",
            len(p["image_urls"]),
        )
        for u in p["image_urls"]:
            print("   ", u.rsplit("/", 1)[-1])
        imgs = download_images(p["productcode"], p["image_urls"])
        upload_names.extend(imgs)
        products.append(p)

    products = [p for p in products if p["availability"] == "Available"]
    rows = [{k: p.get(k, "") for k in COLUMNS} for p in products]

    for out_dir in OUT_DIRS:
        out_dir.mkdir(parents=True, exist_ok=True)
        csv_path = out_dir / "steve_silver_accent_chairs_import.csv"
        xlsx_path = out_dir / "steve_silver_accent_chairs_import.xlsx"
        with csv_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        wb = Workbook()
        ws = wb.active
        ws.title = "Accent Chairs"
        ws.append(COLUMNS)
        for row in rows:
            ws.append([row[k] for k in COLUMNS])
        wb.save(xlsx_path)
        print("wrote", csv_path)
        print("wrote", xlsx_path)

    seen: set[str] = set()
    uniq: list[str] = []
    for n in upload_names:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    list_path = PHOTO_DIR / ".ss-accent-chairs-upload.txt"
    list_path.write_text("\n".join(uniq) + "\n", encoding="utf-8")
    print("upload list", list_path, len(uniq), "products", len(rows))


if __name__ == "__main__":
    main()
