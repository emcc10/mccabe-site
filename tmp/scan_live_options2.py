import re
import urllib.request

urls = [
    "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm",
    "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode=BB%2DFAUX%2DFUR",
    "https://www.mccabestheaterandliving.com/product-p/sar-ruched-minky-throw-blanket.htm",
]
for url in urls:
    h = urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "x"}), timeout=60
    ).read().decode("utf-8", "replace")
    parts = re.split(r"<script", h, flags=re.I)
    html = parts[0]
    for i in range(1, len(parts)):
        c = parts[i]
        e = c.find("</script>")
        html += c[e + 9 :] if e >= 0 else ""
    sel = len(re.findall(r"<select\b", html, re.I))
    ot = 'id="options_table"' in html
    print("\n===", url.split("/")[-1][:60], "===")
    print("selects", sel, "options_table", ot)
    for m in re.finditer(r'<select[^>]*name="([^"]*)"[^>]*>(.*?)</select>', html, re.I | re.S):
        print(" ", m.group(1)[:80])
        opts = re.findall(r'<option[^>]*value="([^"]*)"[^>]*>([^<]*)', m.group(2))
        for v, t in opts[:8]:
            print("   ", repr(t.strip()[:40]), "=>", v)
