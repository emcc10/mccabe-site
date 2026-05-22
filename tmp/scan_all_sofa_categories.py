#!/usr/bin/env python3
import re
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}

CATS = [
    "/category-s/139.htm",
    "/category-s/135.htm",
    "/category-s/132.htm",
    "/category-s/177.htm",
    "/category-s/187.htm",
    "/category-s/188.htm",
    "/category-s/157.htm",
    "/category-s/178.htm",
    "/category-s/176.htm",
    "/category-s/179.htm",
    "/category-s/192.htm",
    "/category-s/147.htm",
    "/category-s/149.htm",
    "/category-s/186.htm",
    "/category-s/175.htm",
    "/category-s/191.htm",
    "/category-s/142.htm",
    "/category-s/181.htm",
]

LINK_RE = re.compile(
    r'<a href="(https://www\.mccabestheaterandliving\.com/[^"]+\.htm)"[^>]*class="[^"]*v-product__title',
    re.I,
)
PAGE_RE = re.compile(r"page=(\d+)", re.I)


def fetch(cat):
    req = urllib.request.Request(SITE + cat, headers=UA)
    return urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")


all_links = set()
for cat in CATS:
    try:
        html = fetch(cat)
    except Exception as e:
        print(cat, "ERR", e)
        continue
    links = set(LINK_RE.findall(html))
    pages = {int(m.group(1)) for m in PAGE_RE.finditer(html)}
    for p in sorted(pages):
        if p <= 1:
            continue
        sep = "&" if "?" in cat else "?"
        try:
            html2 = urllib.request.urlopen(
                urllib.request.Request(SITE + cat + sep + f"Page={p}", headers=UA),
                timeout=90,
            ).read().decode("utf-8", "replace")
            links |= set(LINK_RE.findall(html2))
        except Exception:
            pass
    sofa = [u for u in links if re.search(r"sofa|sectional|loveseat|-sc-", u, re.I)]
    print(f"{cat}: {len(links)} products, {len(sofa)} sofa/sec")
    all_links |= links

sofa_all = [u for u in all_links if re.search(r"sofa|sectional|loveseat|-sc-", u, re.I)]
print(f"\nTotal unique links: {len(all_links)}")
print(f"Total sofa/sectional links: {len(sofa_all)}")
