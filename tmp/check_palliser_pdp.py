import re
import urllib.request

UA = {"User-Agent": "x"}
url = "https://www.mccabestheaterandliving.com/Palliser-Asher-Power-Reclining-Sofa-p/asher%2041065.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode(
    "utf-8", "replace"
)
print("len", len(html))
for pat in [
    r'id="product_photo"[^>]*src="([^"]+)"',
    r'src="([^"]+)"[^>]*id="product_photo"',
    r'product_photo',
    r'NoPhoto',
    r'faux fur',
]:
    m = re.search(pat, html, re.I)
    print(pat, "->", (m.group(1)[:80] if m and m.lastindex else bool(m)))
