import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"


def grid_snippet(path: str) -> None:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + path, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    m = re.search(r"(<ul[^>]*v-product-grid[^>]*>.*?</ul>)", html, re.I | re.S)
    if not m:
        print(path, "no grid")
        return
    g = m.group(1)[:2500]
    print(f"\n{path} grid classes/styles:")
    for pat in [
        r"background[^;\"']{0,80}",
        r"colors_background",
        r"mc-plp",
        r"height:\s*[0-9]+px",
        r"v-product__img",
    ]:
        hits = re.findall(pat, g, re.I)
        if hits:
            print(f"  {pat}: {set(list(hits)[:8])}")
