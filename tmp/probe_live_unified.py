#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"

URLS = [
    ("bean-bag", f"{SITE}/product-p/bb-chinchilla.htm"),
    ("gatlin", f"{SITE}/product-p/ss-gatlin-pwr-sect.htm"),
    ("robe", f"{SITE}/product-p/sar-wearable.htm"),
]

MARKERS = [
    "mcNormalizePdpLayout",
    "mc-pdp-unified-ready",
    "mc-unified-pdp-row",
    "20260616unified",
    "mc-unified-pdp-critical-20260616",
    "C_CSS_DEPLOY_VERIFY_20260616unified",
    "tagPdpCells",
    "styleFixedSectional",
]

for label, url in URLS:
    print(f"\n=== {label} ===")
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")
    except Exception as e:
        print("ERR", e)
        continue
    for m in MARKERS:
        print(f"  {m}: {'YES' if m in html else 'NO'}")
    # live template_266.html direct
    try:
        t = urllib.request.urlopen(
            urllib.request.Request(f"{SITE}/v/template_266.html?cb=999", headers=UA), timeout=30
        ).read().decode("utf-8", "replace")
        print(f"  live template_266 has mcNormalizePdpLayout: {'YES' if 'mcNormalizePdpLayout' in t else 'NO'}")
        print(f"  live template_266 has unified2: {'YES' if '20260616unified2' in t else 'NO'}")
    except Exception as e:
        print("  template fetch ERR", e)
    css = re.search(r"custom-safe\.css[^\"']*", html)
    if css:
        print("  css href:", css.group(0)[:100])
