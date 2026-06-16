import re
import urllib.parse
import urllib.request

codes = [
    "TMH-RACK-CLEAR-RACKS",
    "TMH-RACK-CLEAR",
    "TMH-RACK-WHT-MOP",
    "TMH-RACK-WHITE-MOP",
    "TMH-RACK-WHT-MOP-RACKS",
]
for code in codes:
    url = (
        "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode="
        + urllib.parse.quote(code)
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'name="ProductCode"\s+value="([^"]+)"', text, re.I)
    title = re.search(r"<title>([^<]+)", text, re.I)
    print(
        code,
        "->",
        m.group(1) if m else "?",
        "|",
        (title.group(1)[:70] if title else "?"),
    )
