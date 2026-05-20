import re
import struct
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
ROOT = Path("vspfiles/photos")


def jpg_size(data: bytes) -> tuple[int, int] | None:
    i = 2
    while i < len(data) - 8:
        if data[i : i + 2] == b"\xff\xc0" or data[i : i + 2] == b"\xff\xc2":
            h = struct.unpack(">H", data[i + 5 : i + 7])[0]
            w = struct.unpack(">H", data[i + 7 : i + 9])[0]
            return w, h
        seg = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seg
    return None


def photos_on(cat: str) -> list[str]:
    html = urllib.request.urlopen(
        urllib.request.Request(SITE + cat, headers=UA), timeout=90
    ).read().decode("utf-8", "replace")
    return sorted(set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg))", html, re.I)))


for cat in ["/category-s/177.htm", "/category-s/187.htm"]:
    names = photos_on(cat)
    print(f"\n{cat} — {len(names)} photos")
    for name in names[:8]:
        local = ROOT / name
        if not local.is_file():
            local = ROOT / name.lower()
        live = urllib.request.urlopen(
            urllib.request.Request(f"{SITE}/v/vspfiles/photos/{name}", headers=UA),
            timeout=60,
        ).read()
        ls = jpg_size(live) if live[:2] == b"\xff\xd8" else None
        rs = jpg_size(local.read_bytes()) if local.is_file() else None
        print(f"  {name}: live={ls} repo={rs} local_exists={local.is_file()}")
