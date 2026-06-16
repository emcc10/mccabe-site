import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
print("ProductCode", re.search(r'name="ProductCode" value="([^"]+)"', html))
print("options_table", 'id="options_table"' in html)
for m in re.finditer(r'name="(SELECT___[^"]+)"', html):
    print("select", m.group(1))
for m in re.finditer(r'<option[^>]*value="(\d+)"[^>]*>([^<]+)</option>', html):
    print(" opt", m.group(1), m.group(2).strip())
# swatch photos
for m in re.finditer(r'SAR-LUSH-MINI[^"\']*\.jpg', html):
    print("img", m.group(0)[:80])
