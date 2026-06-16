import urllib.request

base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"
ids = ["1069", "1074", "1013"]
pcs = ["SAR-LUSH-MINI", "SAR-DBL-RCH-FX-FUR", ""]
for pc in pcs:
    for oid in ids:
        for suffix in ["-S.jpg", "-T.jpg", f"-{oid}-S.jpg"]:
            name = f"{pc}-{oid}{suffix}" if pc else f"SAR-{oid}-S.jpg"
            if suffix == "-S.jpg" and pc:
                name = f"{pc}-{oid}-S.jpg"
            url = f"{base}/{name}"
            try:
                urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=10)
                print("OK", url)
            except Exception:
                pass
