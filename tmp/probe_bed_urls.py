import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
candidates = [
    "https://stevesilver.com/wp-content/uploads/2019/10/HP900KFBW.jpg",
    "https://stevesilver.com/wp-content/uploads/2019/10/HP900HBW.jpg",
    "https://stevesilver.com/wp-content/uploads/2020/01/SteveSilverFurniture_HighlandPark_HP900KHB_HP900KFBW_VG1.jpg",
    "https://stevesilver.com/wp-content/uploads/2023/05/SteveSilverFurniture_HighlandPark_HP900KHB_HP900KFBW_VG1.jpg",
    "https://stevesilver.com/wp-content/uploads/2020/01/BearCreek_BC900KHB_BC900KFB_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2020/01/SteveSilverFurniture_BearCreek_BC900KHB_BC900KFB_WS1.jpg",
    "https://stevesilver.com/wp-content/uploads/2020/01/BearCreek_BC900KFB.jpg",
]
for url in candidates:
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(r.status, r.headers.get("Content-Length"), url.split("/")[-1])
    except Exception as e:
        print("FAIL", url.split("/")[-1], e)
