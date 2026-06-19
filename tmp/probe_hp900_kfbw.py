import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe bed catalog)"}
for name in ["HP900KFBW.jpg", "HP900KHBW.jpg", "HP900QFBW.jpg", "HP900QHBW.jpg", "HP900KFBW-2.jpg"]:
    url = f"https://stevesilver.com/wp-content/uploads/2019/08/{name}"
    try:
        req = urllib.request.Request(url, headers=UA, method="HEAD")
        with urllib.request.urlopen(req, timeout=15) as r:
            print(name, r.headers.get("Content-Length"))
    except Exception as e:
        print(name, "FAIL", e)
