import urllib.request, re

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")

m = re.search(r'<form[^>]*ProductDetails[^>]*>(.*?)</form>', h, re.I | re.S)
if not m:
    m = re.search(r'id="v65-product-parent"(.*?)(?:</form>|<form)', h, re.I | re.S)
chunk = m.group(1) if m else ""
print("chunk len", len(chunk))
print("options_table", 'id="options_table"' in chunk)
print("select tags", len(re.findall(r"<select\b", chunk, re.I)))
for sel in re.findall(r"<select\b[^>]*name=\"([^\"]+)\"[^>]*>(.*?)</select>", chunk, re.I | re.S):
    print("SELECT", sel[0])
    for v, t in re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', sel[1])[:10]:
        print(" ", repr(t.strip()), v[:30])

# also search whole page for SELECT___ pattern
for m2 in re.finditer(r'name="(SELECT___[^"]+)"', h):
    print("found name", m2.group(1))
