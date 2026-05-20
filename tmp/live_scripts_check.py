import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", "replace")


html = get(SITE + "/category-s/187.htm")
scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.I)
plp = [s for s in scripts if "mc-plp" in s.lower() or "design-toolkit" in s.lower()]
print("Cat 187 enforcer tags:", re.findall(r"mc-plp-enforcer\.js\?v=([0-9]+)", html))
print("PLP/DTK script URLs:")
for s in plp:
    print(" ", s)

for q in ["20260603", "20260615", "20260616"]:
    js = get(f"{SITE}/v/vspfiles/js/mc-plp-enforcer.js?v={q}")
    ver = re.search(r'VERSION\s*=\s*"([0-9]+)"', js)
    tag = re.search(r"MC_PLP_ENFORCER_([0-9]+)", js)
    print(f"enforcer.js?v={q} -> VERSION={ver.group(1) if ver else '?'} tag={tag.group(1) if tag else '?'}")

dtk = get(f"{SITE}/v/vspfiles/templates/266/js/min/design-toolkit.min.js")
print("live DTK has MC_DTK_PLP_20260616:", "MC_DTK_PLP_20260616" in dtk)
idx = dtk.find("MC_DTK_PLP")
print("DTK PLP block start:", dtk[idx : idx + 100] if idx >= 0 else "missing")
