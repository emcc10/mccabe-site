import re
import urllib.request

for slug in ["sar-dbl-rch-fx-fur.htm", "bb-faux-fur.htm"]:
    url = f"https://www.mccabestheaterandliving.com/product-p/{slug}"
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60
    ).read().decode("utf-8", "replace")
    print("===", slug, "===")
    for m in re.finditer(r'<select[^>]+name="([^"]+)"', html, re.I):
        if "___" in m.group(1):
            print(m.group(1))
