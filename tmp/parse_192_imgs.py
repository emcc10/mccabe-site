import re
import urllib.request

UA = {"User-Agent": "x"}
html = urllib.request.urlopen(
    urllib.request.Request(
        "https://www.mccabestheaterandliving.com/category-s/192.htm", headers=UA
    ),
    timeout=90,
).read().decode("utf-8", "replace")

# Each thumb: a.v-product__img with img inside
for m in re.finditer(
    r'<a[^>]*class="[^"]*v-product__img[^"]*"[^>]*href="([^"]+)"[^>]*>.*?<img[^>]+src="([^"]+)"',
    html,
    re.I | re.S,
):
    href = m.group(1)
    src = m.group(2)
    if "mccabe" not in href and not href.startswith("/"):
        continue
    if not href.startswith("http"):
        href = "https://www.mccabestheaterandliving.com" + href
    photo = ""
    pm = re.search(r"/photos/([^\"'?]+)", src, re.I)
    if pm:
        photo = pm.group(1)
    print(href[-50:], "|", photo[:60] if photo else src[:60])

print("\nTotal thumbs:", len(re.findall(r"v-product__img", html, re.I)))
