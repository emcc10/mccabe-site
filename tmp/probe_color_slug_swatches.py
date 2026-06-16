import re
import urllib.request

def ok(url):
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
        return True
    except Exception:
        return False

colors = ["Blossom", "Aubergine", "Ballet Slipper", "Bloom", "Navy", "Charcoal"]
bases = [
    "https://www.mccabestheaterandliving.com/v/vspfiles/swatches/saranoni/{slug}.jpg",
    "https://www.mccabestheaterandliving.com/v/vspfiles/swatches/luxe/{slug}.jpg",
    "https://www.mccabestheaterandliving.com/v/vspfiles/swatches/luxe-comforts/{slug}.jpg",
    "https://www.mccabestheaterandliving.com/v/vspfiles/swatches/blankets/{slug}.jpg",
    "https://www.mccabestheaterandliving.com/v/vspfiles/images/saranoni/{slug}.jpg",
    "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/swatches/saranoni/{slug}.jpg",
]

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

for c in colors:
    for pat in bases:
        url = pat.format(slug=slug(c))
        if ok(url):
            print("OK", c, url)
