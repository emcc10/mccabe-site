import urllib.request
import re

url = "https://www.mccabestheaterandliving.com/product-p/bb-faux-fur.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
print("pdp64:", "pdp64" in html)
print("pdp65:", "pdp65" in html)
print("mc-bean-bag-media-stack:", "mc-bean-bag-media-stack" in html)
for pat, label in [
    (r"mc-pdp-auth-cta-fix\.js\?v=([^\"']+)", "auth js"),
    (r"custom-safe\.css\?v=([^\"']+)", "css"),
]:
    m = re.search(pat, html)
    if m:
        print(label + ":", m.group(1))
idx = html.find("id='altviews'")
if idx < 0:
    idx = html.find('id="altviews"')
print("altviews idx", idx)
if idx >= 0:
    print(html[max(0, idx - 500) : idx + 600])
