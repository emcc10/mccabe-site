#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://www.mccabestheaterandliving.com/category-s/177.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
    "utf-8", "replace"
)
print("page len", len(html))
for needle in [
    "20260607mobilefloat",
    "mc-plp-thumb-mat",
    "data-mc-category-plp",
    "display_homepage_title",
    "slideshow-container",
    "bindMobileFloatNav",
    "MC PLP THUMB",
    "mc-plp-enforcer",
]:
    print(needle, "YES" if needle in html else "no")

body_class = re.search(r'<body[^>]*class="([^"]*)"', html, re.I)
print("body class", body_class.group(1)[:200] if body_class else "none")
html_class = re.search(r'<html[^>]*class="([^"]*)"', html, re.I)
print("html class", html_class.group(1)[:200] if html_class else "none")

# thumbs with/without mat class
mats = len(re.findall(r"mc-plp-thumb-mat", html))
imgs = len(re.findall(r"v-product__img", html))
print("mc-plp-thumb-mat count", mats, "v-product__img count", imgs)

# slideshow visible?
if "slideshow-container" in html:
    snip = html[html.find("slideshow-container") - 50 : html.find("slideshow-container") + 200]
    print("slideshow snippet", snip[:250])

# display_homepage_title content
dht = re.search(r'id="display_homepage_title"[^>]*>([^<]*)', html, re.I)
print("display_homepage_title text", repr(dht.group(1)[:80]) if dht else "none")
