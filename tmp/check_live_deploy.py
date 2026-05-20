import re
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0"}
SITE = "https://www.mccabestheaterandliving.com"
ROOT = Path(__file__).resolve().parents[1]


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> None:
    html = fetch_bytes(SITE + "/category-s/187.htm").decode("utf-8", "replace")
    names = sorted(set(re.findall(r"/vspfiles/photos/([^\"'?]+\.(?:jpg|jpeg|png))", html, re.I)))[:8]
    print(f"Sectionals page sample photos ({len(names)} shown):")
    for name in names:
        local = ROOT / "vspfiles" / "photos" / name
        want = local.stat().st_size if local.is_file() else -1
        try:
            got = len(fetch_bytes(f"{SITE}/v/vspfiles/photos/{name}?t=1"))
        except Exception as exc:
            got = -1
            err = str(exc)
        else:
            err = ""
        match = "MATCH" if want > 0 and got == want else "MISMATCH"
        print(f"  {match} {name}: local={want} cdn={got} {err}")


if __name__ == "__main__":
    main()
