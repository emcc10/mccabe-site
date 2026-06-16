import re
import urllib.request

def ok(url):
    try:
        urllib.request.urlopen(
            urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}),
            timeout=12,
        )
        return True
    except Exception:
        return False

base = "https://www.mccabestheaterandliving.com"
colors = ["blossom", "bloom", "navy", "charcoal", "aubergine", "ballet-slipper", "balletslipper"]
prefixes = [
    "/v/vspfiles/swatches/saranoni/{c}.jpg",
    "/v/vspfiles/swatches/saranoni/{c}.png",
    "/v/vspfiles/swatches/luxe/{c}.jpg",
    "/v/vspfiles/swatches/lush/{c}.jpg",
    "/v/vspfiles/swatches/blankets/{c}.jpg",
    "/v/vspfiles/manufacturers/saranoni/{c}.jpg",
    "/v/vspfiles/images/saranoni/{c}.jpg",
    "/v/vspfiles/photos/saranoni-{c}.jpg",
    "/v/vspfiles/photos/SAR-LUSH-MINI-{c}.jpg",
]
for c in colors:
    for pat in prefixes:
        url = base + pat.format(c=c)
        if ok(url):
            print("OK", url)

# list directory? try common index
for path in [
    "/v/vspfiles/swatches/saranoni/",
    "/v/vspfiles/swatches/luxe-comforts/",
]:
    try:
        html = urllib.request.urlopen(base + path, timeout=12).read().decode("utf-8", "replace")
        print(path, "len", len(html))
        for m in re.findall(r'href="([^"]+\.(jpg|png))"', html, re.I):
            print(" ", m[0][:80])
    except Exception as e:
        print(path, e)
