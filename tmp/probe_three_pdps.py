#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
URLS = [
    ("bean-bag", f"{SITE}/product-p/bb-chinchilla.htm"),
    ("sectional", f"{SITE}/product-p/gatlin-dual-power-leather-sectional.htm"),
    ("robe", f"{SITE}/product-p/sar-wearable.htm"),
]

for label, url in URLS:
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")
    except Exception as e:
        print(label, url, "ERR", e)
        continue
    print(f"\n=== {label} {url} ===")
    # main row tds
    parent = re.search(r'id="v65-product-parent"[^>]*>(.{0,8000})', html, re.I | re.S)
    chunk = parent.group(1) if parent else html[:15000]
    for pat in [
        r'<tr[^>]*class="[^"]*mc-pdp-main-row[^"]*"[^>]*>',
        r'td\.mc-pdp-options-td|mc-pdp-options-td',
        r'mc-pdp-media-td',
        r'name="btnaddtocart"[^>]{0,200}',
        r'class="vCSS_input_addtocart"[^>]{0,200}',
    ]:
        m = re.search(pat.replace("td\\.", "td"), chunk if "btn" in pat or "vCSS" in pat else html, re.I)
        if m:
            print(" ", pat[:50], ":", m.group(0)[:160])
    btn = re.search(r'<input[^>]*name="btnaddtocart"[^>]*>', html, re.I)
    print("  ATC:", btn.group(0)[:200] if btn else "NONE")
    opt_td = re.search(r'<td[^>]*mc-pdp-options-td[^>]*>', html, re.I)
    print("  info td:", opt_td.group(0)[:120] if opt_td else "NONE (class not set in HTML)")
