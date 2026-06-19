#!/usr/bin/env python3
"""Probe and enrich SAVED_EXPORT_DB3G94DK88.csv."""
from __future__ import annotations

import csv
import json
import re
import urllib.request
from html import unescape
from pathlib import Path

SRC = Path(r"c:\Users\erink\Downloads\SAVED_EXPORT_DB3G94DK88.csv")
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def main() -> None:
    with SRC.open(newline="", encoding="cp1252") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)
    print("HEADER:", header)
    cat181 = [r[0] for r in rows if len(r) > 4 and r[4] == "181"]
    print("CAT181:", cat181)

    slugs = {
        "Burlington-Dining-Set": "burlington-dining-set",
        "Canova-Dining-Set": "canova-dining-set",
        "Grayson-Dining-Set": "grayson-dining-set",
        "Ramona-Dining-Set": "ramona-dining-set",
        "Molly-Olson-Dining-Set": "molly-olson-dining-set",
        "Karina-Sideboard": "karina-sideboard",
        "Adeline-Patio-Set": "adeline-patio-set",
        "Delilah-Patio-Chairs": "delilah-patio-chairs",
        "Fitzgerald-Coffee-Table": "fitzgerald-coffee-table",
        "Fitzgerald-End-Table": "fitzgerald-end-table",
        "Fortuna-Loveseat": "fortuna-loveseat",
        "Fortuna-Recliner": "fortuna-recliner",
        "Garcia-Bar": "garcia-bar",
        "Laurel-Sofa-Loveseat": "laurel-sofa-loveseat",
        "Level-Sofa": "level-sofa",
        "Natalia-Sofa-Loveseat": "natalia-sofa-loveseat",
        "Park-City-Sectional": "park-city-sectional",
        "Sapphire-Sleep-Cal-King": "sapphire-sleep-cal-king",
    }
    for code, slug in slugs.items():
        url = f"https://www.mccabestheaterandliving.com/product-p/{slug}.htm"
        try:
            html = fetch(url)
        except Exception as exc:
            print(code, "ERR", exc)
            continue
        imgs = re.findall(r"/v/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I)
        imgs = list(dict.fromkeys(imgs))
        title = re.search(r"<title>([^<]+)</title>", html, re.I)
        print(f"\n=== {code} ===")
        if title:
            print("title:", unescape(title.group(1).strip()))
        print("images:", imgs[:6])
        for m in re.finditer(r"application/ld\+json[^>]*>(.*?)</script>", html, re.S):
            try:
                data = json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict) and data.get("@type") == "Product":
                print("vendor desc:", (data.get("description") or "")[:200])
                print("weight:", data.get("weight"))


if __name__ == "__main__":
    main()
