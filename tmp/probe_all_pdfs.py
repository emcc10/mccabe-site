#!/usr/bin/env python3
import urllib.error
import urllib.request
from urllib.parse import quote

UA = {"User-Agent": "Mozilla/5.0"}
jobs = [
    ("77651", ["MADISON", "MADISON TRACK", "TRACK ARM"]),
    ("77658", ["MADISON", "MADISON MODERN", "MODERN ENGLISH"]),
    ("77176", ["WINDSOR"]),
    ("42306", ["PINECREST"]),
    ("42002", ["THEO"]),
    ("43003", ["DENALI"]),
    ("41043", ["TUNDRA"]),
    ("41094", ["REGENT"]),
]
for model, styles in jobs:
    for style in styles:
        url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
        try:
            n = len(
                urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=25
                ).read()
            )
            print("OK", model, style, n)
        except urllib.error.HTTPError as e:
            print("--", model, style, e.code)
