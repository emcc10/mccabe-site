import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
for slug in (
    "highland-park-nightstand-cathedral-white",
    "highland-park-nightstand-waed-driftwood",
):
    url = f"https://stevesilver.com/product/{slug}/"
    html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode(
        "utf-8", "replace"
    )
    print("===", slug, "===")
    for m in re.finditer(r'data-large_image="([^"]+)"', html):
        u = m.group(1).replace("\\/", "/")
        if "RS" in u or "Revised" in u:
            print(u)
            req = urllib.request.Request(u, headers=UA)
            try:
                data = urllib.request.urlopen(req, timeout=30).read()
                print("  OK", len(data))
            except Exception as exc:
                print("  FAIL", exc)
