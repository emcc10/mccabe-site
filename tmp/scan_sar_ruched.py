import re
import urllib.request

slug = "sar-ruched-minky-throw-blanket"
url = f"https://www.mccabestheaterandliving.com/product-p/{slug}.htm"
h = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
).read().decode("utf-8", "replace")
parts = re.split(r"<script", h, flags=re.I)
html = parts[0]
for i in range(1, len(parts)):
    c = parts[i]
    e = c.find("</script>")
    html += c[e + 9 :] if e >= 0 else ""
print("selects", len(re.findall(r"<select\b", html, re.I)), "options_table", 'id="options_table"' in html)
for m in re.finditer(r'<select[^>]*name="([^"]*)"[^>]*>(.*?)</select>', html, re.I | re.S):
    print("SELECT", m.group(1))
    opts = re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(2))
    for v, t in opts[:5]:
        print(" ", repr(t.strip()[:60]), "=>", v)
    print(" ... total", len(opts))
