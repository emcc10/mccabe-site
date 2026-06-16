import re
import urllib.request

slugs = [
    "bb-faux-fur.htm",
    "bb-faux-leather.htm",
    "bb-cord.htm",
    "bb-micro.htm",
    "bb-nest.htm",
]

for slug in slugs:
    url = f"https://www.mccabestheaterandliving.com/product-p/{slug}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    except Exception as e:
        print(slug, "ERR", e)
        continue
    selects = re.findall(r'name="(SELECT___[^"]+)"', html)
    print(slug, "options_table" in html, len(selects))
    for s in selects:
        print(" ", s)
    for m in re.finditer(
        r'<option[^>]*value="(\d+)"[^>]*>([^<]+)</option>', html
    ):
        val, label = m.group(1), m.group(2).strip()
        if "Full" in label or "Queen" in label or "King" in label or "Faux" in label:
            print(f"   opt {val}: {label}")
