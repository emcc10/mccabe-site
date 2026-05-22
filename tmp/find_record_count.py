import re
import urllib.request

UA = {"User-Agent": "x"}
for cat in ["/category-s/177.htm", "/category-s/175.htm", "/category-s/192.htm"]:
    html = urllib.request.urlopen(
        urllib.request.Request(
            "https://www.mccabestheaterandliving.com" + cat, headers=UA
        ),
        timeout=90,
    ).read().decode("utf-8", "replace")
    for pat in [
        r"(\d+)\s*(?:items?|products?|results?)",
        r"Total[^0-9]*(\d+)",
        r"Page\s+\d+\s+of\s+(\d+)",
        r"Records\s+\d+\s+to\s+\d+\s+of\s+(\d+)",
    ]:
        m = re.search(pat, html, re.I)
        if m:
            print(cat, pat[:30], m.group(0)[:80])
