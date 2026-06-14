import urllib.request, re

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
).read().decode("utf-8", "replace")

print("options_table id", 'id="options_table"' in html)
print("SELECT count", len(re.findall(r"<select", html, re.I)))
for m in re.finditer(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', html, re.I | re.S):
    print(" select", m.group(1)[:80])
    opts = re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(2))
    for v, t in opts[:8]:
        print("   opt", repr(t.strip()[:60]), "=>", v[:40])

for m in re.finditer(
    r'alternate_product_photo[^>]*title="([^"]*)"[^>]*src="([^"]+)"', html
):
    print(" alt title", m.group(1), "->", m.group(2).split("/")[-1][:50])

m = re.search(r'product_photo_zoom_url[^>]*href="([^"]+)"', html)
print("zoom", m.group(1) if m else None)

for pat in ["___4", "Choose Cover", "Faux Fur", "options_table"]:
    print(pat, html.count(pat))

for m in re.finditer(r'<table[^>]*id="([^"]*options[^"]*)"', html, re.I):
    print("table id", m.group(1))
