import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://stevesilver.com/product/bear-creek-3-piece-king-bed/"
html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45).read().decode("utf-8", "replace")

for pat in [
    r"woocommerce-product-details__short-description[^>]*>(.*?)</div>",
    r'class="description[^"]*"[^>]*>(.*?)</div>',
]:
    m = re.search(pat, html, re.I | re.S)
    if m:
        text = re.sub(r"<[^>]+>", " ", m.group(1))
        print("DESC:", " ".join(text.split())[:600])
        break

m = re.search(r"Additional Information.*?<table[^>]*>(.*?)</table>", html, re.I | re.S)
if m:
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.I | re.S)
    print("TABLE rows:", len(rows))
    for row in rows[:8]:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.I | re.S)
        cells = [re.sub(r"<[^>]+>", " ", c).strip() for c in cells]
        if cells:
            print(" ", cells)

for pat in [r"<ul[^>]*>(.*?)</ul>", r"product-features[^>]*>(.*?)</"]:
    pass

bullets = re.findall(r"<li[^>]*>(.*?)</li>", html, re.I | re.S)
feat = [re.sub(r"<[^>]+>", " ", b).strip() for b in bullets if len(re.sub(r"<[^>]+>", "", b).strip()) > 10]
print("LI count sample:", feat[:6])

imgs = re.findall(r'data-large_image="([^"]+)"', html)
print("GALLERY:", len(imgs))
for u in imgs[:5]:
    print(" ", u.split("/")[-1])
