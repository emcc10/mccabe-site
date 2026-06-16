import urllib.request

base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"
products = [
    "SAR-LUSH-MINI", "SAR-DBL-RCH-FX-FUR", "SAR-CHNK-KNT-LG",
    "SAR-RUCHED-MINKY-THROW-BLANKET", "SAR-LUSH", "SAR-MINI",
]
oid = "1069"
for pc in products:
    for suf in ["-S.jpg", "-T.jpg"]:
        url = f"{base}/{pc}-{oid}{suf}"
        try:
            urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
            print("OK", url)
        except Exception:
            pass

# Volusion sometimes uses OptionGraphic
for path in [
    f"/v/vspfiles/option_graphics/{oid}.jpg",
    f"/v/vspfiles/option_graphics/option_{oid}.jpg",
    f"/v/vspfiles/photos/options/{oid}.jpg",
]:
    url = "https://www.mccabestheaterandliving.com" + path
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
        print("OK", url)
    except Exception:
        pass
