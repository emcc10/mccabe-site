import urllib.request

pc = "SAR-LUSH-MINI"
ids = ["1069", "1074", "1056"]
patterns = [
    "/v/vspfiles/photos/{pc}-{id}-S.jpg",
    "/v/vspfiles/photos/{pc}-{id}S.jpg",
    "/v/vspfiles/photos/{pc}-{id}.jpg",
    "/v/vspfiles/images/{pc}-{id}-S.jpg",
    "/v/vspfiles/swatches/saranoni/{id}.jpg",
    "/v/vspfiles/swatches/{pc}-{id}.jpg",
]
base = "https://www.mccabestheaterandliving.com"
for id_ in ids:
    print("---", id_)
    for pat in patterns:
        url = base + pat.format(pc=pc, id=id_)
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
            r = urllib.request.urlopen(req, timeout=15)
            print("OK", pat, r.status)
        except Exception as e:
            pass
