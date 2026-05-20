import re
import urllib.request
from io import BytesIO

from PIL import Image

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"


def mat_pct(data: bytes) -> tuple[float, tuple[int, int], int]:
    im = Image.open(BytesIO(data)).convert("RGB")
    w, h = im.size
    m = t = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = im.getpixel((x, y))
            t += 1
            if 220 <= r <= 248 and 220 <= g <= 248 and 220 <= b <= 248 and max(r, g, b) - min(r, g, b) < 22:
                m += 1
    return (100.0 * m / t if t else 0, im.size, len(data))


html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/187.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")
print("enforcer tags:", re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html))
print("dtk:", re.findall(r"design-toolkit\.min\.js\?v=([^\"']+)", html))
photos = sorted(set(re.findall(r"/photos/([^\"'?]+\.jpg)", html, re.I)))
for p in photos:
    if "{" in p:
        continue
    url = f"{SITE}/v/vspfiles/photos/{p}"
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
    pct, size, ln = mat_pct(data)
    print(f"  {p}: {size} {ln}b mat~{pct:.0f}%")
