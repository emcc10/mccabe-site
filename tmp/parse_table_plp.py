import re
import urllib.request
from html import unescape

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

def parse_table_plp(html: str) -> list[dict]:
    """Parse nested v65-productDisplay table PLP (cat 157, 192)."""
    products = []
    # Split on inner product tables — each cell block with productnamecolor
    for m in re.finditer(
        r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*productnamecolor[^"]*"',
        html,
        re.I,
    ):
        href = m.group(1)
        if "productnamecolorsmall" in m.group(0).lower():
            continue
        chunk = html[max(0, m.start() - 2500) : m.end() + 200]
        title_m = re.search(r">([^<]{2,200})<", html[m.end() : m.end() + 120])
        title = unescape(title_m.group(1).strip()) if title_m else href
        img = ""
        for im in re.finditer(r'<img[^>]+src="([^"]+)"', chunk, re.I):
            src = im.group(1)
            if "nophoto" in src.lower() or "/photos/" in src.lower():
                img = src
                break
        photo = ""
        pm = re.search(r"/photos/([^\"'?]+\.(?:jpg|jpeg|png|gif))", img, re.I)
        if pm:
            photo = pm.group(1).lower()
        products.append({"title": title, "href": href, "photo": photo, "img_src": img})
    return products


for cat in ["/category-s/157.htm", "/category-s/192.htm", "/category-s/147.htm"]:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    items = parse_table_plp(html)
    print(f"\n{cat}: {len(items)} products (table parse)")
    photos = {}
    for it in items:
        photos.setdefault(it["photo"] or "(none)", []).append(it["title"][:50])
    for ph, titles in sorted(photos.items(), key=lambda x: -len(x[1])):
        if len(titles) > 1 or not ph or ph == "(none)" or "nophoto" in ph:
            print(f"  {ph}: {len(titles)} products — e.g. {titles[0]}")
