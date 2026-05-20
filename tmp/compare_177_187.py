import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (McCabe PLP compare)"}
SITE = "https://www.mccabestheaterandliving.com"


def get(path: str) -> str:
    req = urllib.request.Request(SITE + path, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", "replace")


def analyze(cat: str, html: str) -> None:
    print(f"\n=== {cat} ===")
    print("enforcer tags:", re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html))
    print("design-toolkit:", re.findall(r"design-toolkit\.min\.js\?v=([^\"']+)", html))
    print("mc-plp-body-last:", re.findall(r"mc-plp-body-last\.css\?v=([0-9]+)", html))
    print("bridge script:", "mc-plp-enforcer-bridge" in html)
    print("mc-plp-image-box in HTML:", "mc-plp-image-box" in html)
    print("overflow:hidden on img box:", bool(
        re.search(r"v-product__img[^}]{0,300}overflow:\s*hidden", html, re.I | re.S)
    ))
    print("height:220px:", "height:220px" in html and "v-product__img" in html)

    # first product thumb block
    m = re.search(
        r'(<a[^>]*class="[^"]*v-product__img[^"]*"[^>]*>.*?</a>)',
        html,
        re.I | re.S,
    )
    if m:
        block = m.group(1)[:500]
        print("first thumb <a> snippet:", block.replace("\n", " ")[:400])

    imgs = re.findall(
        r'<a[^>]*v-product__img[^>]*>.*?<img[^>]+>',
        html,
        re.I | re.S,
    )
    print("thumb count:", len(imgs))
    if imgs:
        print("first img tag:", re.search(r"<img[^>]+>", imgs[0], re.I).group(0)[:300])

    photos = sorted(set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I)))
    print("photos:", len(photos), photos[:5])


for path in ["/category-s/177.htm", "/category-s/187.htm"]:
    analyze(path, get(path))
