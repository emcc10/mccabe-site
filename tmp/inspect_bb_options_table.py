import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
print("id=options_table", 'id="options_table"' in html)
m = re.search(r'id="options_table"[^>]*>.*?</table>', html, re.S | re.I)
if m:
    print(m.group(0)[:2000])
else:
    idx = html.find('options_table')
    while idx >= 0:
        print("context:", repr(html[max(0, idx - 40) : idx + 80]))
        idx = html.find("options_table", idx + 1)
        if idx > 0 and html.find("options_table", 0) != idx:
            break

# Try Volusion ajax product options
for pat in [
    r"Product_Option_Categories[^;]{0,200}",
    r"optioncat[^\"']{0,100}",
    r"SELECT___BB-FAUX-FUR[^\"']*",
]:
    for m in re.finditer(pat, html, re.I):
        print("match:", m.group(0)[:200])
