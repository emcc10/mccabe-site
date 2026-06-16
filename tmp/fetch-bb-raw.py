import re
import urllib.request

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
print("options_table", 'id="options_table"' in html or "id='options_table'" in html)
for pat in ["SELECT___BB", "select___BB", "___58", "___4", "<select"]:
    print(pat, html.lower().count(pat.lower()))
sels = re.findall(r"<select[^>]{0,240}>", html, re.I)
print("select tags", len(sels))
for s in sels[:10]:
    print(s[:200])
