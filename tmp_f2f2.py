import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
html = urllib.request.urlopen(
    urllib.request.Request("https://www.mccabestheaterandliving.com/category-s/177.htm", headers=UA),
    timeout=30,
).read().decode("utf-8", "replace")

for m in re.finditer(r"[^{}]{0,200}f2f2f2[^{}]{0,80}", html):
    s = re.sub(r"\s+", " ", m.group(0))
    print(s[:200])
    print("---")
