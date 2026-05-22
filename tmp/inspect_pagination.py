import re
import urllib.request

UA = {"User-Agent": "x"}
SITE = "https://www.mccabestheaterandliving.com"

for cat in ["/category-s/175.htm", "/category-s/186.htm", "/category-s/177.htm", "/category-s/135.htm"]:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    cards = len(re.findall(r'class="v-product"', html, re.I))
    pages = set(re.findall(r"(?:Page|page)=(\d+)", html, re.I))
    page_of = re.findall(r"Page\s+(\d+)\s+of\s+(\d+)", html, re.I)
    next_link = re.findall(r'href="[^"]*(?:Page|page)=\d+[^"]*"', html, re.I)[:5]
    cats = len(re.findall(r"/category-s/\d+\.htm", html))
    print(f"\n{cat}: {cards} v-product, page links={sorted(pages)}, page_of={page_of}")
    print(f"  subcat links: {cats}")
    if next_link:
        print("  sample:", next_link[0][:120])
