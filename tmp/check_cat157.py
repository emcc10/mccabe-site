import re
import struct
import urllib.request
from io import BytesIO

from PIL import Image

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"


def jpg_size(data: bytes) -> tuple[int, int] | None:
    if data[:2] != b"\xff\xd8":
        return None
    i = 2
    while i < len(data) - 8:
        if data[i : i + 2] in (b"\xff\xc0", b"\xff\xc2"):
            h = struct.unpack(">H", data[i + 5 : i + 7])[0]
            w = struct.unpack(">H", data[i + 7 : i + 9])[0]
            return w, h
        seg = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seg
    return None


html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/157.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")
print("enforcer:", re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html))
print("dtk:", re.findall(r"design-toolkit\.min\.js\?v=([^\"']+)", html))
photos = sorted(set(re.findall(r"/photos/([^\"'?]+\.jpg)", html, re.I)))
print(f"photos ({len(photos)}):", photos)

for p in photos[:12]:
    if "{" in p:
        continue
    data = urllib.request.urlopen(
        urllib.request.Request(f"{SITE}/v/vspfiles/photos/{p}", headers=UA), timeout=60
    ).read()
    sz = jpg_size(data)
    im = Image.open(BytesIO(data)).convert("RGB")
    w, h = im.size
    mat = 0
    t = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            r, g, b = im.getpixel((x, y))
            t += 1
            if 220 <= r <= 248 and 220 <= g <= 248 and max(r, g, b) - min(r, g, b) < 22:
                mat += 1
    print(f"  {p}: {sz} bytes={len(data)} mat~{100*mat/t:.0f}%")
