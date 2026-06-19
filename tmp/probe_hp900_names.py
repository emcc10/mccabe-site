import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
names = [
    "HP900KFBW-2.jpg", "HP900KHBW-2.jpg", "HP900KFBW.jpg", "HP900KHBW.jpg",
    "HP900QFBW.jpg", "SteveSilverFurniture_HighlandPark_HP900KHB_HP900KFBW_VG1.jpg",
    "SteveSilverCo_HighlandPark_HP900KHB_HP900KFBW_VG1.jpg",
]
bases = [
    "https://stevesilver.com/wp-content/uploads/2019/08/",
    "https://stevesilver.com/wp-content/uploads/2019/10/",
    "https://stevesilver.com/wp-content/uploads/2020/01/",
    "https://stevesilver.com/wp-content/uploads/2023/05/",
]
for base in bases:
    for name in names:
        url = base + name
        try:
            req = urllib.request.Request(url, headers=UA, method="HEAD")
            with urllib.request.urlopen(req, timeout=15) as r:
                if int(r.headers.get("Content-Length", 0)) > 15000:
                    print("OK", r.headers.get("Content-Length"), url)
        except Exception:
            pass
