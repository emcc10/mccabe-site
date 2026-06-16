import urllib.request

base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"
ids = ["1069", "1074", "1056", "1013", "1014"]
patterns = [
    "{id}-S.jpg",
    "SAR-{id}-S.jpg",
    "SAR-COLOR-{id}-S.jpg",
    "SAR-OPT-{id}-S.jpg",
    "OPTION-{id}-S.jpg",
]
for oid in ids:
    for pat in patterns:
        url = f"{base}/{pat.format(id=oid)}"
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
            print("OK", url)
        except Exception:
            pass

# try slug from color name on any product
slugs = ["blossom", "aubergine", "ballet-slipper"]
for s in slugs:
    for pref in ["SAR-", "SAR-COLOR-", ""]:
        url = f"{base}/{pref}{s}-S.jpg".replace("--", "-")
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
            print("OK slug", url)
        except Exception:
            pass
