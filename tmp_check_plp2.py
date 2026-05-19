import urllib.request
from io import BytesIO
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0"}

def analyze(url, label):
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()
    img = Image.open(BytesIO(raw)).convert("RGB")
    w, h = img.size
    # sample horizontal strip at 30% height for bg colors
    y = int(h * 0.3)
    row = [img.getpixel((x, y)) for x in range(0, w, max(1, w // 20))]
    print(f"\n{label}")
    print(f"  url={url[:100]}")
    print(f"  bytes={len(raw)} size={w}x{h} corner={img.getpixel((5,5))}")
    print(f"  row@{y}={row[:8]}")

analyze(
    "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/77170-01-1.jpg?v-cache=1779212871",
    "PLP CDN (v-cache)",
)
analyze(
    "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos/77170-01-1.jpg",
    "CDN no cache",
)
analyze(
    "https://www.mccabestheaterandliving.com/v/vspfiles/photos/77170-01-1.jpg",
    "origin",
)
analyze(
    "https://www.mccabestheaterandliving.com/v/vspfiles/photos/77181-01-1.jpg?v-cache=1779212871",
    "77181 PLP style",
)
