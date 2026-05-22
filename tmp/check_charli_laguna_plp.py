import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/177.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

for label, needle in [("Charli Apt", "77743-91"), ("Laguna Apt", "77752-91"), ("Corissa", "77500-01")]:
    i = html.find(needle)
    print("===", label, "found", i >= 0, "===")
    if i < 0:
        continue
    chunk = html[max(0, i - 1200) : i + 400]
    for im in re.finditer(r"<img[^>]+src=\"([^\"]+)\"", chunk, re.I):
        print(" ", im.group(1))
