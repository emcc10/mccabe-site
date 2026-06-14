import urllib.request, re

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")

# real HTML selects only (not in script)
parts = re.split(r"<script", h, flags=re.I)
html_only = parts[0]
for i in range(1, len(parts)):
    chunk = parts[i]
    end = chunk.find("</script>")
    if end >= 0:
        html_only += chunk[end + 9 :]

print("real selects", len(re.findall(r"<select\b", html_only, re.I)))
for m in re.finditer(r"<select\b[^>]*>(.*?)</select>", html_only, re.I | re.S):
    print("SELECT", m.group(0)[:200])

# alternate thumbs
for m in re.finditer(
    r'(?:title|alt)="([^"]*)"[^>]*(?:src|href)="([^"]*BB-FAUX-FUR[^"]*)"',
    html_only,
    re.I,
):
    print("img meta", m.group(1)[:40], "->", m.group(2).split("/")[-1][:40])

for m in re.finditer(
    r'(?:src|href)="([^"]*BB-FAUX-FUR[^"]*)"[^>]*(?:title|alt)="([^"]*)"',
    html_only,
    re.I,
):
    print("img meta2", m.group(2)[:40], "->", m.group(1).split("/")[-1][:40])

# onclick changeimage
for m in re.finditer(r"changeimage|ChangeImage|product_photo", html_only, re.I):
    pass
idx = html_only.lower().find("changeimage")
if idx >= 0:
    print("changeimage ctx", html_only[idx : idx + 300])

# form action
m = re.search(r'<form[^>]*action="([^"]*Product[^"]*)"', html_only, re.I)
print("form", m.group(1) if m else None)

# hidden inputs with option
for m in re.finditer(r'<input[^>]*name="([^"]*SELECT[^"]*)"', html_only, re.I):
    print("input", m.group(0)[:150])
