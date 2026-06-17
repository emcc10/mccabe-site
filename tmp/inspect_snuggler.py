"""Inspect Shopify snuggler variant metadata for color mapping."""
from __future__ import annotations

import json
import urllib.request


def main() -> None:
    url = "https://saranoni.com/products/snuggler.json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    product = json.loads(urllib.request.urlopen(req, timeout=30).read())["product"]
    images = {img["id"]: img.get("src", "") for img in product.get("images") or []}
    seen = set()
    for v in product.get("variants") or []:
        key = (v.get("option1"), v.get("option2"), v.get("image_id"))
        if key in seen:
            continue
        seen.add(key)
        src = images.get(v.get("image_id"), "")[:100]
        print(v.get("option1"), "|", v.get("option2"), "|", v.get("option3"), "|", src)


if __name__ == "__main__":
    main()
