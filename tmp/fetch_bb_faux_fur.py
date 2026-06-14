import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
).read().decode("utf-8", "replace")

idx = html.find("beanbag-swatch-wrapper")
chunk = html[idx : idx + 8000] if idx >= 0 else ""
with open("tmp/bb_faux_fur_chunk.txt", "w", encoding="utf-8") as f:
    f.write(chunk)
print("wrote", len(chunk), "chars")
