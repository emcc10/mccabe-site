#!/usr/bin/env python3
"""Fetch product names and descriptions from stevesilver.com by internal SKU."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from html import unescape
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}


@dataclass
class VendorCopy:
    sku: str
    productname: str
    productiondescription: str
    techspecs: str
    source_url: str = ""


def strip_html(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return " ".join(text.split())


def fetch_text(url: str, *, retries: int = 3) -> str:
    last_exc: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code in {429, 503} and attempt + 1 < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError(f"fetch failed: {url}")


def parse_json_ld_product(html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for block in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.I | re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        items = data.get("@graph", [data]) if isinstance(data, dict) else data
        if not isinstance(items, list):
            items = [items]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "Product":
                out["name"] = str(item.get("name") or "").strip()
                out["description"] = strip_html(str(item.get("description") or ""))
                out["sku"] = str(item.get("sku") or "").strip()
                break
        if out:
            break
    return out


def parse_bullets(html: str) -> list[str]:
    m = re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S)
    if not m:
        return []
    bullets: list[str] = []
    for li in re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.I | re.S):
        text = strip_html(li)
        if text and text.lower() != "description":
            bullets.append(text)
    return bullets


def parse_attributes(html: str) -> list[str]:
    m = re.search(
        r'Additional information.*?<table class="woocommerce-product-attributes[^"]*"[^>]*>(.*?)</table>',
        html,
        re.I | re.S,
    )
    if not m:
        return []
    lines: list[str] = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.I | re.S):
        th = re.search(r"<th[^>]*>(.*?)</th>", row, re.I | re.S)
        td = re.search(r"<td[^>]*>(.*?)</td>", row, re.I | re.S)
        if th and td:
            key = strip_html(th.group(1))
            value = strip_html(td.group(1))
            if key and value:
                lines.append(f"{key}: {value}")
    sku_m = re.search(r"SKU</th>\s*<td[^>]*>([^<]+)</td>", html, re.I | re.S)
    if sku_m:
        lines.append(f"SKU: {strip_html(sku_m.group(1))}")
    return lines


def page_has_sku(html: str, sku: str) -> bool:
    info = parse_json_ld_product(html)
    page_sku = (info.get("sku") or "").upper()
    if sku.upper() == page_sku or sku.upper() in page_sku.split(","):
        return True
    if re.search(rf"SKU</th>\s*<td[^>]*>\s*{re.escape(sku)}\s*</td>", html, re.I | re.S):
        return True
    return sku.upper() in html.upper()


def find_product_url(sku: str) -> str | None:
    for search_url in (
        f"https://stevesilver.com/?s={sku}&post_type=product",
        f"https://stevesilver.com/?s={sku}",
    ):
        html = fetch_text(search_url)
        links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
        for link in links:
            page = fetch_text(link)
            if page_has_sku(page, sku):
                return link
            time.sleep(0.4)
    return None


def vendor_short_name(full_name: str) -> str:
    return full_name.split(",")[0].strip()


def normalize_dimensions(size_value: str) -> str:
    text = size_value.strip()
    text = re.sub(r"\s*x\s*", " x ", text, flags=re.I)
    text = re.sub(r"\s*in\.?\b", " in", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    if not re.search(r"\b(inW|inD|inH|inL)\b", text, re.I):
        nums = re.findall(r"[\d.]+", text)
        if len(nums) == 3:
            return f"{nums[0]} inW x {nums[1]} inD x {nums[2]} inH"
        if len(nums) == 2:
            return f"{nums[0]} inW x {nums[1]} inD"
    return text


def dimensions_from_attrs(attrs: list[str]) -> str | None:
    for line in attrs:
        key, _, value = line.partition(":")
        if key.strip().lower() in {"size", "dimensions"}:
            return normalize_dimensions(value.strip())
    return None


def bullets_to_techspecs(bullets: list[str]) -> str:
    return "\n".join(f"• {b}" for b in bullets[:6])


def build_production_description(
    name: str,
    description: str,
    bullets: list[str],
    attrs: list[str],
) -> tuple[str, str]:
    dims = dimensions_from_attrs(attrs)
    parts = [f"{name} by Steve Silver."]
    if dims:
        parts.append(f"Dimensions: {dims}")
    if description:
        parts.append(description)
    if bullets:
        parts.append("Features: " + "; ".join(bullets))
    production = " ".join(parts)

    techspec_bullets: list[str] = []
    if dims:
        techspec_bullets.append(dims)
    techspec_bullets.extend(bullets[:6] if bullets else ([description[:180]] if description else []))
    return production, bullets_to_techspecs(techspec_bullets)

def fetch_vendor_copy(sku: str) -> VendorCopy | None:
    url = find_product_url(sku)
    if not url:
        return None
    html = fetch_text(url)
    info = parse_json_ld_product(html)
    bullets = parse_bullets(html)
    attrs = parse_attributes(html)
    full_name = info.get("name") or ""
    if not full_name:
        return None
    short_name = vendor_short_name(full_name)
    production, techspecs = build_production_description(
        short_name,
        info.get("description", ""),
        bullets,
        attrs,
    )
    return VendorCopy(
        sku=sku.upper(),
        productname=short_name,
        productiondescription=production,
        techspecs=techspecs,
        source_url=url,
    )


def load_cache(path: Path) -> dict[str, dict[str, str]]:
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, dict) else {}


def save_cache(path: Path, cache: dict[str, dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(cache, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def get_vendor_copy(sku: str, cache: dict[str, dict[str, str]], *, refresh: bool = False) -> VendorCopy | None:
    key = sku.upper()
    if not refresh and key in cache:
        return VendorCopy(**cache[key])
    copy = fetch_vendor_copy(key)
    if copy:
        cache[key] = asdict(copy)
    return copy


def adapt_finish_variant(copy: VendorCopy, sku: str) -> VendorCopy:
    """Reuse sibling vendor copy when only finish suffix differs (KAC vs NAC, etc.)."""
    if copy.sku == sku.upper():
        return copy
    name = copy.productname
    production = copy.productiondescription
    if sku.upper().endswith("NAC") and copy.sku.endswith("KAC"):
        name = re.sub(r"\bBlack\b", "Natural", name, flags=re.I)
        production = production.replace("black wood", "natural wood").replace("Black Wood", "Natural Wood")
    return VendorCopy(
        sku=sku.upper(),
        productname=name,
        productiondescription=production,
        techspecs=copy.techspecs,
        source_url=copy.source_url,
    )
