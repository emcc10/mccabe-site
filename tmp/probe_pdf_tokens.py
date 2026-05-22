#!/usr/bin/env python3
import urllib.error
import urllib.request
from urllib.parse import quote

UA = {"User-Agent": "Mozilla/5.0"}
candidates = [
    ("77111", "KINSLEY"),
    ("77119", "THEA"),
    ("41089", "ZG5"),
    ("41089", "ZG 5"),
    ("41089", "ZG-5"),
    ("41089", "ZG FIVE"),
]
for model, style in candidates:
    url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
    try:
        data = urllib.request.urlopen(
            urllib.request.Request(url, headers=UA), timeout=20
        ).read()
        print("OK", model, style, len(data))
    except urllib.error.HTTPError as e:
        print("HTTP", model, style, e.code)
