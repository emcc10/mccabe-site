import urllib.request

for slug in ["bb-nest.htm", "bb-faux-fur.htm"]:
    h = urllib.request.urlopen(
        urllib.request.Request(
            f"https://www.mccabestheaterandliving.com/product-p/{slug}",
            headers={"User-Agent": "x"},
        ),
        timeout=60,
    ).read().decode("utf-8", "replace")
    print(slug, 'id="options_table"' in h, "select count", h.lower().count("<select"))
