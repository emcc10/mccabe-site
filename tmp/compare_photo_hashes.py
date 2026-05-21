import hashlib
import io
import urllib.request
from pathlib import Path

SITE = "https://www.mccabestheaterandliving.com"
UA = {"User-Agent": "Mozilla/5.0"}
ROOT = Path(__file__).resolve().parents[1] / "vspfiles" / "photos"

sys_path = []
photos = [
    "77675-1.jpg",
    "bb-chinchilla-1.jpg",
    "77180-01-1.jpg",
    "77694-91-1.jpg",
]


def md5(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


for name in photos:
    local = ROOT / name
    if local.is_file():
        data = local.read_bytes()
        src = "repo"
    else:
        data = urllib.request.urlopen(
            urllib.request.Request(f"{SITE}/v/vspfiles/photos/{name}", headers=UA),
            timeout=60,
        ).read()
        src = "live"
    print(f"{name} ({src}): md5={md5(data)} size={len(data)}")
