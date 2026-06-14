import urllib.request

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")

idx = h.find("Choose Cover")
print(h[idx - 200 : idx + 400])
