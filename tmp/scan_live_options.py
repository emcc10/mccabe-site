import re
import urllib.request

for slug in [
    "bb-faux-fur",
    "bb-nest",
    "bb-corduroy",
    "sar-ruched-minky-throw-blanket",
]:
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
    sel = len(re.findall(r"<select\b", html, re.I))
    ot = 'id="options_table"' in html
    pc = re.search(r'name="ProductCode"[^>]*value="([^"]+)"', html, re.I)
    print(slug, "selects", sel, "options_table", ot, "pc", pc.group(1) if pc else "?")
