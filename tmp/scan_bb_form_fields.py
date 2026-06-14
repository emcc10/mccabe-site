import urllib.request, re

def form_fields(slug):
    h = urllib.request.urlopen(
        urllib.request.Request(
            f"https://www.mccabestheaterandliving.com/product-p/{slug}.htm",
            headers={"User-Agent": "x"},
        ),
        timeout=60,
    ).read().decode("utf-8", "replace")
    parts = re.split(r"<script", h, flags=re.I)
    html = parts[0]
    for i in range(1, len(parts)):
        chunk = parts[i]
        end = chunk.find("</script>")
        if end >= 0:
            html += chunk[end + 9 :]
    m = re.search(r'<form[^>]*action="([^"]*)"', html, re.I)
    print("===", slug, "===")
    print("form", m.group(1) if m else None)
    for inp in re.findall(r"<input[^>]+>", html, re.I):
        name = re.search(r'name="([^"]+)"', inp, re.I)
        typ = re.search(r'type="([^"]+)"', inp, re.I)
        if name:
            print(" ", typ.group(1) if typ else "?", name.group(1))

for slug in ["bb-faux-fur", "bb-nest"]:
    form_fields(slug)
