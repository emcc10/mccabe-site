import re
import urllib.request

URLS = [
    "https://www.mccabestheaterandliving.com/product-p/sar-lush-extra-large-blanket.htm",
    "https://www.mccabestheaterandliving.com/product-p/shelton-manual-reclining-sectional.htm",
    "https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm",
]

for url in URLS:
    print("===", url)
    html = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")

    pc = re.search(r'name="ProductCode"[^>]*value="([^"]+)"', html, re.I)
    print("ProductCode:", pc.group(1) if pc else "NONE")

    bc = re.search(r"vCSS_breadcrumb_td.*?<b>(.*?)</b>", html, re.S)
    print("breadcrumb:", re.sub(r"\s+", " ", bc.group(1))[:400] if bc else "NONE")

    for inp in re.findall(
        r'<input[^>]+name="(?:CategoryID|categoryid|Category_Id|Categories[^"]*)"[^>]*>',
        html,
        re.I,
    ):
        print("hidden:", inp[:200])

    # Volusion sometimes embeds category ids in meta or scripts
    for m in re.finditer(r"CategoryID[=:]\s*['\"]?(\d+)", html, re.I):
        print("CategoryID ref:", m.group(0)[:80])

    atc = re.findall(
        r"<(?:input|button)[^>]*(?:btnaddtocart|BtnAddToCart)[^>]*>",
        html,
        re.I,
    )
    for el in atc[:5]:
        print("ATC:", el[:250])

    wrap = re.findall(r'class="[^"]*mc-atc-button-wrap[^"]*"', html)
    print("mc-atc-button-wrap count:", len(wrap))
    print()
