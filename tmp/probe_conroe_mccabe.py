import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe)"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/ss-conroe-pwr-chaise-sect.htm",
        headers=UA,
    ),
    timeout=45,
).read().decode("utf-8", "replace")
for pat in [
    r'ProductCode["\']?\s*value=["\']([^"\']+)',
    r'vspfiles/photos/(SS-[^"\']+)',
    r'stevesilver\.com[^"\']+',
]:
    print(pat, re.findall(pat, html, re.I)[:5])
imgs = re.findall(r'data-large_image="([^"]+)"', html)
print("gallery", imgs[:3])
