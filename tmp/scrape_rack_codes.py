import re
import html as htmlmod
import urllib.request

url = "https://www.mccabestheaterandliving.com/category-s/203.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

seen = {}
for m in re.finditer(
    r'class="v-product__title[^"]*"[^>]*title="([^"]+)"',
    text,
    re.I,
):
    raw = htmlmod.unescape(m.group(1))
    if "," in raw:
        name, code = raw.rsplit(",", 1)
        code = code.strip().upper()
        name = name.strip()
        seen[code] = name

for code in sorted(seen):
    if "RACK" in code or "rack" in seen[code].lower():
        print(f"{code}\t{seen[code]}")

print("ALL COUNT", len(seen))
print("RACK COUNT", sum(1 for c, n in seen.items() if "RACK" in c or "rack" in n.lower()))
