#!/usr/bin/env python3
import re
import time
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe price probe)"}
codes = [
    "SS-HY500SV", "SS-HY500SVB", "SS-AUB500SV", "SS-JA500SV", "SS-COL500WSV",
    "SS-COL500NSV", "SS-COL500KSV", "SS-COL500ESV", "SS-BUR500NSV", "SS-AY200B",
    "SS-GA500SV", "SS-GAB500SV", "Karina-Sideboard", "SS-BUR520NC",
    "SS-ABR500KSV", "SS-ABR500NSV",
]

for code in codes:
    url = f"https://www.mccabestheaterandliving.com/product-p/{code.lower()}.htm"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20).read().decode("utf-8", "replace")
    except Exception as exc:
        print(code, "ERR", exc)
        continue
    title_m = re.search(r"<title>([^<]+)</title>", html, re.I)
    title = title_m.group(1).strip() if title_m else ""
    h1 = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    name = h1.group(1).strip() if h1 else ""
    box = re.search(r"colors_pricebox[\s\S]{0,3000}", html, re.I)
    price = ""
    if box:
        nums = re.findall(r"\$\s*([\d,]+(?:\.\d{2})?)", box.group(0))
        vals = [float(n.replace(",", "")) for n in nums if float(n.replace(",", "")) >= 50]
        if vals:
            price = str(int(max(vals)))
    print(f"{code}\t{price}\t{name or title}")
    time.sleep(0.3)
