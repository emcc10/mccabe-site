#!/usr/bin/env python3
"""Fetch Steve Silver vendor data for McCabe placeholder products."""
from __future__ import annotations

import json
import re
import urllib.request
from html import unescape

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}

PRODUCT_PAGES: dict[str, list[str]] = {
    "Burlington-Dining-Set": [
        "https://stevesilver.com/product/burlington-52-inch-round-table/",
    ],
    "Canova-Dining-Set": [
        "https://stevesilver.com/product/canova-round-gray-marble-top-dining-table/",
    ],
    "Grayson-Dining-Set": [
        "https://stevesilver.com/product/grayson-5-piece-marble-top-counter-storage-dining-set/",
    ],
    "Ramona-Dining-Set": [
        "https://stevesilver.com/product/ramona-white-marble-top-rounddining-table/",
    ],
    "Molly-Olson-Dining-Set": [
        "https://stevesilver.com/product/molly-round-dining-table/",
    ],
    "Karina-Sideboard": [
        "https://stevesilver.com/product/karina-server-white-marble-top/",
        "https://stevesilver.com/product/karina-server/",
    ],
    "Adeline-Patio-Set": [
        "https://stevesilver.com/product/adeline-3-piece-outdoor-set/",
        "https://stevesilver.com/product/adeline-swivel-chair/",
    ],
    "Delilah-Patio-Chairs": [
        "https://stevesilver.com/product/dalilah-patio-arm-chair/",
    ],
    "Fitzgerald-Coffee-Table": [
        "https://stevesilver.com/product/fitzgerald-cocktail-table/",
    ],
    "Fitzgerald-End-Table": [
        "https://stevesilver.com/product/fitzgerald-end-table/",
    ],
    "Fortuna-Loveseat": [
        "https://stevesilver.com/product/fortuna-dual-power-reclining-console-loveseat-coffee/",
    ],
    "Fortuna-Recliner": [
        "https://stevesilver.com/product/fortuna-dual-power-recliner-coffee/",
    ],
    "Garcia-Bar": [
        "https://stevesilver.com/product/garcia-bar/",
    ],
    "Laurel-Sofa-Loveseat": [
        "https://stevesilver.com/product/laurel-pwr-pwr-console-loveseatgrey/",
    ],
    "Level-Sofa": [
        "https://stevesilver.com/product/lovell-sofa/",
    ],
    "Natalia-Sofa-Loveseat": [
        "https://stevesilver.com/product/natalia-power-reclining-console-loveseat/",
    ],
    "Park-City-Sectional": [
        "https://stevesilver.com/product/park-city-6-piece-dual-power-sectional/",
    ],
    "Sapphire-Sleep-Cal-King": [
        "https://stevesilver.com/product/sapphire-sleep-14-inch-california-king-mattress/",
    ],
}


def strip_html(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return " ".join(text.split())


def parse_page(html: str) -> dict:
    out: dict = {"bullets": [], "attrs": [], "images": []}
    for block in re.findall(r'application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = data.get("@graph", [data]) if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = [items]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "Product":
                out["name"] = item.get("name")
                out["description"] = strip_html(str(item.get("description") or ""))
                out["weight"] = item.get("weight")
    m = re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S)
    if m:
        for li in re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.I | re.S):
            text = strip_html(li)
            if text and text.lower() != "description":
                out["bullets"].append(text)
    m = re.search(
        r'Additional information.*?<table class="woocommerce-product-attributes[^"]*"[^>]*>(.*?)</table>',
        html,
        re.I | re.S,
    )
    if m:
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.I | re.S):
            th = re.search(r"<th[^>]*>(.*?)</th>", row, re.I | re.S)
            td = re.search(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
            if th and td:
                k = strip_html(th.group(1))
                v = strip_html(td.group(1))
                if k and v:
                    out["attrs"].append(f"{k}: {v}")
    imgs = re.findall(
        r"https://stevesilver\.com/wp-content/uploads/[^\"']+\.(?:jpg|jpeg|png|webp)",
        html,
        re.I,
    )
    out["images"] = [
        u
        for u in dict.fromkeys(imgs)
        if not re.search(r"-\d+x\d+\.", u, re.I)
        and "logo" not in u.lower()
        and "bar-logo" not in u.lower()
    ]
    return out


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "replace")


def main() -> None:
    for code, urls in PRODUCT_PAGES.items():
        print(f"\n===== {code} =====")
        merged: dict = {"bullets": [], "attrs": [], "images": []}
        for url in urls:
            try:
                data = parse_page(fetch(url))
            except Exception as exc:
                print("  FAIL", url, exc)
                continue
            print("  OK", url.split("/")[-2])
            for key in ("name", "description", "weight"):
                if data.get(key) and not merged.get(key):
                    merged[key] = data[key]
            merged["bullets"].extend(b for b in data["bullets"] if b not in merged["bullets"])
            merged["attrs"].extend(a for a in data["attrs"] if a not in merged["attrs"])
            merged["images"].extend(u for u in data["images"] if u not in merged["images"])
        print("name:", merged.get("name"))
        print("desc:", (merged.get("description") or "")[:220])
        print("weight:", merged.get("weight"))
        print("bullets:", merged["bullets"][:6])
        print("attrs:", merged["attrs"][:4])
        for u in merged["images"][:4]:
            print(" img:", u.rsplit("/", 1)[-1])


if __name__ == "__main__":
    main()
