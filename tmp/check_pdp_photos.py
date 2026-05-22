import re
import urllib.request

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "x"}


def check(slug: str) -> None:
    html = urllib.request.urlopen(
        urllib.request.Request(f"{SITE}/product-p/{slug}.htm", headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    m = re.search(r'id="product_photo"[^>]*src="([^"]+)"', html, re.I) or re.search(
        r'src="([^"]+)"[^>]*id="product_photo"', html, re.I
    )
    print(slug, m.group(1) if m else "NO PHOTO")
    start = html.find("content_area")
    chunk = html[start : start + 80000].lower() if start >= 0 else ""
    print("  faux fur in PDP content:", "faux fur" in chunk)


for s in ["77743-91", "77752-91", "77427-01", "77180-01"]:
    check(s)
