import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")
# images
imgs = set(re.findall(r'(?:src|href)=["\']([^"\']+\.(?:jpg|jpeg|png|gif))["\']', html, re.I))
for i in sorted(imgs):
    if any(x in i.lower() for x in ["swatch", "lush", "saranoni", "1069", "blossom", "photos/sar"]):
        print(i)
print("--- tech specs ---")
m = re.search(r'id="ProductDetail_TechSpecs_div"[^>]*>(.*?)</div>', html, re.S | re.I)
if m:
    print(m.group(1)[:1500])
print("--- description ---")
m2 = re.search(r'id="ProductDetail_ProductDetails_div"[^>]*>(.*?)</div>', html, re.S | re.I)
if m2:
    print(m2.group(1)[:800])
