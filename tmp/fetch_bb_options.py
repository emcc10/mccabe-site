import urllib.request, re, json

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60).read().decode("utf-8", "replace")

# cover select options
for m in re.finditer(r'<select[^>]*name="([^"]*___4[^"]*)"[^>]*>(.*?)</select>', html, re.I|re.S):
    print("SELECT", m.group(1))
    opts = re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(2))
    for v,t in opts[:12]:
        print(" ", repr(t.strip()), "=>", v[:80])

# main photo src
m = re.search(r'id="product_photo"[^>]*src="([^"]+)"', html)
print("main photo", m.group(1) if m else None)

# altviews sample
for src in re.findall(r'alternate_product_photo[^"]*"[^>]*src="([^"]+)"', html)[:5]:
    print("alt", src)

# imageMap
im = re.search(r"var imageMap = (\{[^}]+\})", html)
print("imageMap", im.group(1)[:300] if im else None)
