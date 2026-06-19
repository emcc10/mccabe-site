import json
import re
import urllib.request
from html import unescape

UA = {"User-Agent": "Mozilla/5.0 (McCabe Steve Silver bed catalog)"}


def strip_html(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return " ".join(text.split())


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_product(html: str) -> dict:
    out: dict = {}
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
                out["sku"] = str(item.get("sku") or "").strip()
                out["description"] = strip_html(str(item.get("description") or ""))
                break
    m = re.search(r'id="tab-description"[^>]*>(.*?)</div>\s*<div', html, re.I | re.S)
    if m:
        out["bullets"] = [
            strip_html(li)
            for li in re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.I | re.S)
            if strip_html(li) and strip_html(li).lower() != "description"
        ]
    sku_m = re.search(r"SKU</th>\s*<td[^>]*>([^<]+)</td>", html, re.I | re.S)
    if sku_m:
        out["sku_html"] = strip_html(sku_m.group(1))
    return out


def find_product_url(sku: str) -> str | None:
    for url in (
        f"https://stevesilver.com/?s={sku}&post_type=product",
        f"https://stevesilver.com/?s={sku}",
    ):
        html = fetch_text(url)
        links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
        for link in links:
            page = fetch_text(link)
            info = parse_product(page)
            page_sku = (info.get("sku") or info.get("sku_html") or "").upper()
            if sku.upper() in page_sku or sku.upper() in page.upper():
                return link
    return None


for sku in ["HEL850NAC", "HEL850KAC"]:
    link = find_product_url(sku)
    print(sku, "->", link)

# search helen pages
html = fetch_text("https://stevesilver.com/?s=helen+accent+chair")
links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver.com/product/[^"]+)"', html)))
print("helen links", links)

for sku in ["GAB4848T", "COL500NSV", "CNT500PT", "AUB100KC"]:
    link = find_product_url(sku)
    print(sku, "->", link)
    if link:
        info = parse_product(fetch_text(link))
        print("  name:", info.get("name"))
        print("  sku:", info.get("sku") or info.get("sku_html"))
        print("  desc:", (info.get("description") or "")[:200])
        print("  bullets:", info.get("bullets", [])[:3])
