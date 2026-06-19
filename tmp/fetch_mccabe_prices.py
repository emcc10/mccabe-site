#!/usr/bin/env python3
"""Fetch live McCabe productprice from PDP HTML for Volusion product codes."""
from __future__ import annotations

import csv
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "catalog" / "steve-silver-active" / "SAVED_EXPORT_DB3G94DK88_enriched.csv"
UA = {"User-Agent": "Mozilla/5.0 (McCabe price probe)"}


def fetch_price(code: str) -> tuple[str, str] | None:
    url = f"https://www.mccabestheaterandliving.com/product-p/{code.lower()}.htm"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode(
            "utf-8", "replace"
        )
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise
    if re.search(r"product not found|page not found", html, re.I):
        return None
    # Volusion often embeds listprice in script blocks
    for pat in (
        r"listprice\s*=\s*['\"]([\d.]+)['\"]",
        r"productprice\s*=\s*['\"]([\d.]+)['\"]",
        r"AddToCart\([^,]+,\s*([\d.]+)",
    ):
        m = re.search(pat, html, re.I)
        if m:
            val = m.group(1).replace(",", "")
            if float(val) > 0:
                return val, val
    # Visible retail price in pricebox
    box = re.search(r"colors_pricebox[\s\S]{0,2500}", html, re.I)
    if box:
        nums = re.findall(r"\$\s*([\d,]+(?:\.\d{2})?)", box.group(0))
        parsed = []
        for n in nums:
            try:
                v = float(n.replace(",", ""))
                if v >= 50:
                    parsed.append(v)
            except ValueError:
                pass
        if parsed:
            top = str(int(max(parsed))) if max(parsed) == int(max(parsed)) else str(max(parsed))
            return top, top
    return None


def main() -> int:
    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        codes = [r["productcode"] for r in csv.DictReader(fh)]

    found = 0
    for i, code in enumerate(codes):
        if not code.startswith("SS-"):
            continue
        prices = fetch_price(code)
        if prices:
            found += 1
            print(f"{code}\t{prices[0]}")
        if i % 20 == 19:
            time.sleep(0.5)
    print(f"found {found} live prices", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
