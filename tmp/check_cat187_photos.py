import re
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
ROOT = Path(__file__).resolve().parents[1] / "vspfiles" / "photos"

html = urllib.request.urlopen(
    urllib.request.Request(SITE + "/category-s/187.htm", headers=UA), timeout=90
).read().decode("utf-8", "replace")
photos = sorted(set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I)))

for name in photos:
    if name.startswith("{"):
        print(f"{name}: placeholder — skip")
        continue
    live_url = f"{SITE}/v/vspfiles/photos/{name}"
    try:
        live_len = len(urllib.request.urlopen(urllib.request.Request(live_url, headers=UA), timeout=60).read())
    except Exception as exc:
        live_len = -1
        err = str(exc)
    else:
        err = ""

    local = None
    for candidate in [ROOT / name, ROOT / name.lower()]:
        if candidate.is_file():
            local = candidate
            break
    if local:
        local_len = local.stat().st_size
        match = "OK" if live_len == local_len else f"MISMATCH repo={local_len} live={live_len}"
        print(f"{name} -> {local.name}: {match}")
    else:
        print(f"{name}: NOT IN REPO live={live_len} {err}")
