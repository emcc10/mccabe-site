#!/usr/bin/env python3
import re, urllib.request

SITE = "https://www.mccabestheaterandliving.com"
url = f"{SITE}/product-p/ss-gatlin-pwr-sect.htm"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")

def find_ver(pat):
    m = re.search(pat, html)
    return m.group(1) if m else "MISSING"

print("URL", url)
print("auth script", find_ver(r"mc-pdp-auth-cta-fix\.js\?v=([^\"&]+)"))
print("css", find_ver(r"custom-safe\.css\?v=([^\"&]+)"))
print("unified script in html", "mc-unified-pdp-layout" in html)
print("btnaddtocart in html", "btnaddtocart" in html)
print("is-sectional inline", "is-sectional-product" in html)
print("pdp67", "20260617pdp67" in html)
print("pdp66", "20260617pdp66" in html)

for ver in ["20260617pdp67", "20260617pdp66", "20260617pdp53"]:
    try:
        js_url = f"{SITE}/v/vspfiles/js/mc-pdp-auth-cta-fix.js?v={ver}"
        js = urllib.request.urlopen(
            urllib.request.Request(js_url, headers={"User-Agent": "Mozilla/5.0"}),
            timeout=30,
        ).read().decode("utf-8", "replace")
        v_m = re.search(r'var VERSION = "([^"]+)"', js)
        v = v_m.group(1) if v_m else "MISSING"
        print(f"cdn {ver} -> file VERSION {v}, isFixedSectional={('isFixedSectionalUnifiedPdp' in js)}")
    except Exception as e:
        print(f"cdn {ver} err", e)
