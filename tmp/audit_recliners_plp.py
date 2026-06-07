#!/usr/bin/env python3
import re
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
ROOT = Path(__file__).resolve().parents[1] / "vspfiles" / "photos"


def audit_page(page: int) -> None:
    url = f"{SITE}/searchresults.asp?cat=186&page={page}"
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    blocks = re.findall(
        r'<div class="v-product">(.*?)</div>\s*</div>\s*</div>', html, re.I | re.S
    )
    print(f"=== page {page} ({len(blocks)} products) ===")
    for block in blocks:
        title = re.search(r'title="([^"]*)"', block)
        href = re.search(r'href="([^"]*product-p[^"]*)"', block, re.I)
        img = re.search(r'<img[^>]+src="([^"]+)"', block, re.I)
        t = (title.group(1) if title else "?").strip()
        i = (img.group(1) if img else "no img").split("/")[-1]
        sku = ""
        if href:
            m = re.search(r"product-p/([^\.]+)", href.group(1), re.I)
            sku = m.group(1).upper() if m else ""
        want = f"{sku}-1.jpg" if sku else ""
        has_local = (ROOT / want).is_file() if want else False
        flag = ""
        if "NoPhoto" in i or "nophoto" in i.lower():
            flag = " MISSING" + (" (file exists locally)" if has_local else "")
        elif has_local and want.lower() != i.lower():
            flag = f" WRONG_IMG want={want}"
        print(f"{t[:52]:52} | {i[:28]:28} | local={has_local}{flag}")


if __name__ == "__main__":
    for p in (1, 2, 3):
        audit_page(p)
