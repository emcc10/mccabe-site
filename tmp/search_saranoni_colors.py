"""Search all saranoni.com products for color names."""
from __future__ import annotations

import json
import re
import urllib.request

NEED = [
    "jasmine",
    "lilly",
    "lily",
    "pomegranate",
    "gray marble",
    "tan marble",
    "olive",
    "bows",
    "ivy",
    "dogs",
]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())


def main() -> None:
    page = 1
    while page <= 5:
        url = f"https://saranoni.com/products.json?limit=250&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = json.loads(urllib.request.urlopen(req, timeout=60).read())
        products = data.get("products") or []
        if not products:
            break
        for p in products:
            title = (p.get("title") or "").lower()
            handle = p.get("handle") or ""
            for v in p.get("variants") or []:
                c1 = v.get("option1") or ""
                blob = f"{title} {handle} {c1}".lower()
                for needle in NEED:
                    if needle in blob or needle in norm(c1):
                        print(handle, "|", p.get("title"), "|", c1, "| image_id=", v.get("image_id"))
        page += 1


if __name__ == "__main__":
    main()
