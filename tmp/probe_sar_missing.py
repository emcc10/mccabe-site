"""Probe McCabe colors and Shopify handles for missing Saranoni products."""
from __future__ import annotations

import html as htmlmod
import json
import re
import urllib.parse
import urllib.request

CODES = [
    "SAR-BMB-SNUGGLER",
    "SAR-SNUGGLER",
    "SAR-COZY-BMB-ROBES",
    "SAR-MNKY-LUSH",
    "SAR-MNKY-LUSH-XL-LG",
    "SAR-MNKY-LUSH-TOD",
    "SAR-MARBLE-FX-FUR-MNKY-XL-LG",
    "SAR-GRAND-FX-FUR-KING",
    "SAR-GRAND-FX-FUR-QUEEN",
    "SAR-GRAND-FX-FUR-12X20",
    "SAR-WFL-KNT-ROBES",
    "SAR-BMB-HATS",
    "SAR-BMB-TOD",
    "SAR-LUSH-TOD",
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_colors(html_text: str, code: str) -> list[dict]:
    m = re.search(
        rf'<SELECT[^>]*name="SELECT___{re.escape(code)}___23"[^>]*>(.*?)</SELECT>',
        html_text,
        re.I | re.S,
    )
    if not m:
        return []
    out = []
    for om in re.finditer(
        r'<OPTION[^>]*value="([^"]*)"[^>]*>(.*?)</OPTION>', m.group(1), re.I | re.S
    ):
        val = om.group(1).strip()
        text = htmlmod.unescape(re.sub(r"<[^>]+>", "", om.group(2)))
        text = re.sub(r"\s+", " ", text).strip()
        if not val or not text or re.match(r"^(please|choose|select|--)", text, re.I):
            continue
        out.append({"optionId": val, "label": text})
    return out


def main() -> None:
    for code in CODES:
        url = (
            "https://www.mccabestheaterandliving.com/ProductDetails.asp?ProductCode="
            + urllib.parse.quote(code)
        )
        pdp = fetch(url)
        colors = parse_colors(pdp, code)
        print(f"\n{code} ({len(colors)} colors)")
        for c in colors:
            print(f"  {c['label']} ({c['optionId']})")


if __name__ == "__main__":
    main()
