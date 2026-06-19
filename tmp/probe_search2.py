#!/usr/bin/env python3
import re
import time
import urllib.parse
import urllib.request

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

for q in ["noah", "olsen dove", "olsen console dove", "noah gray sleeper"]:
    url = "https://stevesilver.com/?s=" + urllib.parse.quote(q)
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
            "utf-8", "replace"
        )
        links = list(dict.fromkeys(re.findall(r'href="(https://stevesilver\.com/product/[^"]+/)"', html)))
        print("===", q, f"({len(links)} hits) ===")
        for l in links[:10]:
            print(" ", l)
    except Exception as exc:
        print("===", q, "ERROR", exc)
    time.sleep(2)
