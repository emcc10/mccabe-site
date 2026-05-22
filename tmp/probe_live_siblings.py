#!/usr/bin/env python3
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com/v/vspfiles/photos"
prefixes = ["77111", "77119", "41089", "77743", "77752", "77651", "77656", "77658"]
suffixes = [
    "-01-1.jpg", "-A1-1.jpg", "-D1-1.jpg", "-A4-1.jpg", "-AE-1.jpg", "-AS-1.jpg",
    "-91-1.jpg", "-31-1.jpg", "-32-1.jpg", "-33-1.jpg", "-34-1.jpg", "-35-1.jpg",
    "-38-1.jpg", "-39-1.jpg", "-G3-1.jpg", "-J2-1.jpg", "-M2-1.jpg", "-42-1.jpg",
]
for p in prefixes:
    for s in suffixes:
        name = f"{p}{s}"
        url = f"{SITE}/{name}"
        try:
            data = urllib.request.urlopen(
                urllib.request.Request(url, headers=UA), timeout=8
            ).read()
            if len(data) > 5000 and data[:3] != b"GIF":
                print(name, len(data))
        except Exception:
            pass
