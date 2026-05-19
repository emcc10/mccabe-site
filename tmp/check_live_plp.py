import re
import urllib.request

req = urllib.request.Request(
    "https://www.mccabestheaterandliving.com/category-s/177.htm",
    headers={"User-Agent": "Mozilla/5.0"},
)
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

idx = html.find("77180-01-1.jpg")
print(html[idx - 400 : idx + 200])
