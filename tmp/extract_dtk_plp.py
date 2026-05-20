import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
url = "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/design-toolkit.min.js?v=20260520plp"
t = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read().decode("utf-8", "replace")
i = t.find("MC_DTK_PLP")
print(t[i : i + 800])
