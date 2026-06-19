import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
searches = [
    ("BC900 king alt", "https://stevesilver.com/?s=BC900KFB"),
    ("HP900 white bed", "https://stevesilver.com/product/highland-park-king-bed-cathedral-white/"),
    ("MON900 queen", "https://stevesilver.com/product/montana-queen-bed-sand/"),
]
for label, url in searches:
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")
    except Exception as e:
        print(label, e)
        continue
    imgs = set(re.findall(r"stevesilver\.com/wp-content/uploads/[^\"'\s]+\.(?:jpg|jpeg|png)", html, re.I))
    print(f"\n{label} ({len(imgs)})")
    for u in sorted(imgs):
        n = u.split("/")[-1]
        if any(x in n.upper() for x in ("KFB", "QFB", "KHB", "QHB", "KBED", "QBED", "WS", "VG1")) and "RS" not in n.upper() and "DTL" not in n.upper():
            print(" ", n[:100])
