import urllib.request, re

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")

idx = h.find('id="v65-product-parent"')
if idx < 0:
    idx = h.find("id='v65-product-parent'")
print("idx", idx)
print(h[idx : idx + 15000])
