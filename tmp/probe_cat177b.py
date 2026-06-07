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

body = re.search(r"<body([^>]*)>", html, re.I)
print("body tag", body.group(0)[:300] if body else "none")
html_tag = re.search(r"<html([^>]*)>", html, re.I)
print("html tag", html_tag.group(0)[:300] if html_tag else "none")

for script in ["mc-site-fix", "mc-plp-enforcer", "mtl-sectional-renderer", "mc-plp-body-last"]:
    m = re.findall(rf'src="[^"]*{script}[^"]*"', html)
    print(script, len(m), m[:2] if m else [])

# is slideshow in DOM as visible element?
if_home = re.search(r'id="if_homepage"[^>]*style="([^"]*)"', html, re.I)
print("if_homepage inline style", if_home.group(1)[:100] if if_home else "none")
ss = re.search(r'id="slideshow-container"', html)
print("slideshow-container in DOM", bool(ss))

# vol-logo in header
logo = re.search(r'vol-logo[^<]{0,200}', html, re.I)
print("vol-logo snippet", logo.group(0)[:150] if logo else "none")
