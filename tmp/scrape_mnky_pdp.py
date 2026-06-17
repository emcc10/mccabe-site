"""Scrape McCabe PDP for Saranoni color image URLs."""
from __future__ import annotations

import re
import urllib.parse
import urllib.request

CODES = ["SAR-MNKY-LUSH", "SAR-MNKY-LUSH-XL-LG"]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def main() -> None:
    for code in CODES:
        url = (
            "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode="
            + urllib.parse.quote(code)
        )
        html = fetch(url)
        print(f"\n=== {code} ===")
        for m in re.finditer(
            r"(https?://[^\"'\s]+|/v/vspfiles/photos/[^\"'\s]+)", html, re.I
        ):
            src = m.group(1)
            if code.replace("-", "") in src.replace("-", "") or any(
                x in src for x in ["1087", "1088", "1089", "MNKY", "minky"]
            ):
                print(src)


if __name__ == "__main__":
    main()
