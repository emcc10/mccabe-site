import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

def first_title(html):
    m = re.search(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", html, re.I | re.S)
    if m:
        return m.group(1).strip()
    m = re.search(
        r'class="[^"]*productnamecolor[^"]*"[^>]*>\s*([^<]+)',
        html,
        re.I | re.S,
    )
    return m.group(1).strip() if m else None

def all_titles_grid(html):
    return [
        t.strip()
        for t in re.findall(r"v-product__title[^>]*>\s*([^<]+?)\s*</a>", html, re.I | re.S)
    ]

for cat in ["/category-s/175.htm", "/category-s/177.htm", "/category-s/186.htm"]:
    seen_pages = []
    for p in range(1, 15):
        url = SITE + cat + (f"?Page={p}" if p > 1 else "")
        html = urllib.request.urlopen(
            urllib.request.Request(url, headers=UA), timeout=90
        ).read().decode("utf-8", "replace")
        titles = all_titles_grid(html)
        key = tuple(titles[:3])
        if p > 1 and key == seen_pages[-1][1]:
            print(f"{cat}: duplicate at page {p} (same first 3 as page {p-1})")
            break
        seen_pages.append((p, key, len(titles)))
    print(f"{cat}: real pages = {len(seen_pages)}")
    for p, key, n in seen_pages:
        print(f"  p{p}: {n} products, first={key[0] if key else '?'}")
