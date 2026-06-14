import urllib.request
import re

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
).read().decode("utf-8", "replace")

for pat in ["mc-atc-button-wrap", "mc-pdp-purchase-stack", "mc-pdp-qty-row", "mc-pdp-features", "btnaddtocart", "v65-productdetail-cartqty"]:
    print(pat, pat in html)
