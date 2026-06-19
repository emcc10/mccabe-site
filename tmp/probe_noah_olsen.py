#!/usr/bin/env python3
import re, urllib.parse, urllib.request
UA = {"User-Agent": "Mozilla/5.0"}
for q in [
    "noah convertible sleeper sofa gray",
    "noah sleeper sofa",
    "olsen dove power reclining",
    "olsen dove dual power",
]:
    url = "https://stevesilver.com/?s=" + urllib.parse.quote(q)
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "replace")
    links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+/)"', html)))
    print("===", q, "===")
    for l in links[:8]:
        print(" ", l)
