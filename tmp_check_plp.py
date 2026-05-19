import re
import urllib.request
from io import BytesIO
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0"}
html = urllib.request.urlopen(
    urllib.request.Request("https://www.mccabestheaterandliving.com/category-s/177.htm", headers=UA),
    timeout=30,
).read().decode("utf-8", "replace")

print("f2f2f2 count:", html.lower().count("f2f2f2"))
print("ffffff on v-product__img:", "v-product__img" in html and html.count("background:#ffffff"))

imgs = re.findall(r'src="([^"]*photos/[^"]+)"', html)
print(f"\nFirst 6 img src:")
for u in imgs[:6]:
    print(" ", u[:120])

seen = set()
for u in imgs:
    name = u.split("/")[-1].split("?")[0]
    if name in seen:
        continue
    seen.add(name)
    url = u if u.startswith("http") else ("https:" + u if u.startswith("//") else "https://www.mccabestheaterandliving.com" + u)
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
    img = Image.open(BytesIO(raw)).convert("RGB")
    w, h = img.size
    white = gray = 0
    for y in range(h):
        for x in range(w):
            r, g, b = img.getpixel((x, y))
            if r > 240 and g > 240 and b > 240:
                white += 1
            elif abs(r - g) <= 8 and abs(r - b) <= 8 and 225 <= r <= 248:
                gray += 1
    print(f"\n{name} @ {url[:80]}...")
    print(f"  size={w}x{h} bytes={len(raw)} corner={img.getpixel((5,5))} center={img.getpixel((w//2,h//2))}")
    print(f"  white_px={white} gray_px={gray} total={w*h}")
    if len(seen) >= 5:
        break

# origin vs cdn for 77170
for label, url in [
    ("origin", "https://www.mccabestheaterandliving.com/v/vspfiles/photos/77170-01-1.jpg"),
    ("cdn", "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/77170-01-1.jpg"),
]:
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
        img = Image.open(BytesIO(raw)).convert("RGB")
        print(f"\n{label}: bytes={len(raw)} corner={img.getpixel((5,5))}")
    except Exception as e:
        print(f"\n{label}: ERROR {e}")
