import urllib.parse
import urllib.request

def slugify(s):
    return "".join(ch if ch.isalnum() else "-" for ch in s.lower()).strip("-")

def variants(c):
    out = [c]
    c2 = c.replace(" ", "-")
    if c2 not in out:
        out.append(c2)
    return out

def paths(family, color):
    f, c = family, color
    base_names = [
        f"{f}-{c}",
        f"{f}-{c.replace(' ', '-')}",
        f"{f.lower()}-{c.lower()}",
        f"{f.lower()}-{c.lower().replace(' ', '-')}",
        f"{slugify(f)}-{slugify(c)}",
    ]
    for cv in variants(c):
        if cv != c:
            base_names.append(f"{f}-{cv}")
    base_dir = "/v/vspfiles/swatches/"
    exts = [".jpg", ".jpeg", ".png"]
    urls = []
    for n in base_names:
        for e in exts:
            urls.append("https://www.mccabestheaterandliving.com" + base_dir + urllib.parse.quote(n + e))
    return urls

families = ["Saranoni", "Luxe", "Luxe Comforts", "Lush", "Blanket", "Minky", "Saranoni Lush"]
colors = ["Blossom", "Aubergine", "Navy", "Charcoal"]
for fam in families:
    for col in colors:
        for url in paths(fam, col):
            try:
                urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=6)
                print("OK", fam, col, url)
                break
            except Exception:
                pass
