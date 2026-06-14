import urllib.request, re

h = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
        headers={"User-Agent": "x"},
    ),
    timeout=60,
).read().decode("utf-8", "replace")

# strip scripts/styles for text search
html = re.sub(r"<script[\s\S]*?</script>", "", h, flags=re.I)
html = re.sub(r"<style[\s\S]*?</style>", "", html, flags=re.I)

for kw in ["Choose Cover", "Choose Size", "SELECT___", "options_table", "productoptionname"]:
    idx = html.lower().find(kw.lower())
    print(kw, "in html (no script/style):", idx >= 0)
    if idx >= 0 and kw in ("Choose Cover", "SELECT___"):
        print(html[max(0, idx - 80) : idx + 200])

# tables with id
for m in re.finditer(r'<table[^>]*id="([^"]+)"', html, re.I):
    tid = m.group(1)
    if "option" in tid.lower() or "product" in tid.lower():
        print("table id", tid)
