import urllib.request, re

def scan(slug):
    url = f"https://www.mccabestheaterandliving.com/product-p/{slug}.htm"
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
    ).read().decode("utf-8", "replace")
    # Only in v65-product-parent chunk
    m = re.search(r'id="v65-product-parent"(.*?)</form>', html, re.I | re.S)
    chunk = m.group(1) if m else html[:50000]
    real_selects = re.findall(r'<select\s[^>]*>', chunk, re.I)
    print(slug, "real selects in form", len(real_selects))
    for s in real_selects[:5]:
        print(" ", s[:120])
    print(" options_table id in chunk", 'id="options_table"' in chunk)

for slug in ["bb-faux-fur", "bb-nest", "bb-corduroy"]:
    scan(slug)
