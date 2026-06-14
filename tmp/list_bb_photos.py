import urllib.request, re

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")
imgs = sorted(set(re.findall(r"BB-FAUX-FUR[^\"'\s?]+\.(?:jpg|png|webp)", h, re.I)))
for i in imgs:
    print(i)
