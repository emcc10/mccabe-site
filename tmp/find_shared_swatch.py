import re
import urllib.request

def ok(url):
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=8)
        return True
    except Exception:
        return False

base = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"
oids = ["1069", "1074", "1013", "1012"]
products = ["SAR-DBL-RCH-FX-FUR", "SAR-CHNK-KNT-LG", "SAR-LUSH-MINI", "SAR-LUSH-THROW", "SAR-MINI"]
for oid in oids:
    for pc in products:
        url = f"{base}/{pc}-{oid}-S.jpg"
        if ok(url):
            print("FOUND", oid, url)

# search ruched for blossom option id
url = "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm"
html = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read().decode("utf-8", "replace")
if "Blossom" in html:
    print("ruched has Blossom")
    for m in re.finditer(r'value="(\d+)"[^>]*>Blossom', html):
        print(" blossom id", m.group(1))
