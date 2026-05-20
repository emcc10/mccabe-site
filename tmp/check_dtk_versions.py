import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"

for q in ["20260520plp", "20260616", ""]:
    url = f"{SITE}/v/vspfiles/templates/266/js/min/design-toolkit.min.js"
    if q:
        url += f"?v={q}"
    t = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode("utf-8", "replace")
    m = re.search(r"MC_DTK_PLP_([0-9]+)", t)
    print(f"?v={q or '(none)'}: marker={m.group(0) if m else 'NONE'} len={len(t)}")
