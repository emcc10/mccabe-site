#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/177.htm", headers=UA
    ),
    timeout=30,
).read().decode("utf-8", "replace")

ca = html.find('id="content_area"')
print("content_area at", ca)
chunk = html[ca : ca + 12000]
# black backgrounds in first part of content
for m in re.finditer(r'background(?:-color)?\s*:\s*#?000|background(?:-color)?\s*:\s*black|colors_lines_light|colors_background', chunk, re.I):
    start = max(0, m.start() - 80)
    print("---", chunk[start : m.end() + 80].replace("\n", " ")[:200])

# header area
hdr = html.find('class="header header"')
if hdr < 0:
    hdr = html.find("header.header")
print("header at", hdr)
if hdr >= 0:
    print(html[hdr : hdr + 2500][:2000])
