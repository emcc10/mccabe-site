import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")
# all img tags in product area
for m in re.finditer(r'<img[^>]+>', html, re.I):
    tag = m.group(0)
    if any(x in tag.lower() for x in ["swatch", "blossom", "color", "lush", "saranoni", "1069"]):
        print(tag[:200])
# scripts with swatch
for m in re.finditer(r'.{0,40}swatch.{0,80}', html, re.I):
    if 'css' not in m.group(0).lower()[:20]:
        print(m.group(0)[:120])
