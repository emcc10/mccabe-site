#!/usr/bin/env python3
import urllib.error
import urllib.request
from urllib.parse import quote

UA = {"User-Agent": "Mozilla/5.0"}
for model in ["77651", "77656", "77658", "77176", "77768"]:
    for style in ["MADISON", "WINDSOR", "PYPER", "MADISON TRACK", "MADISON ROLL"]:
        url = f"https://images.palliser.com/specsheet/en/{quote(f'{model} {style}')}.pdf"
        try:
            n = len(
                urllib.request.urlopen(
                    urllib.request.Request(url, headers=UA), timeout=20
                ).read()
            )
            print("OK", model, style, n)
        except urllib.error.HTTPError as e:
            if e.code != 404:
                print("ERR", model, style, e.code)
