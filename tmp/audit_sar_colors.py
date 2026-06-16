"""Audit Saranoni products: color options and existing photo files on CDN."""
from __future__ import annotations

import html as htmlmod
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

CDN = "https://cdn4.volusion.store/srulk-fqudj/v/vspfiles/photos"
SEARCH_URL = "https://www.mccabestheaterandliving.com/searchresults.asp?Search=SAR-&show=250"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def head_ok(url: str) -> bool:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status < 400
    except Exception:
        return False


def parse_search_products(html: str) -> list[tuple[str, str, str]]:
    out = []
    for m in re.finditer(
        r'href="(https://www\.mccabestheaterandliving\.com/product-p/[^"]+)"[^>]*class="v-product__title[^"]*"[^>]*title="([^"]+)"',
        html,
        re.I,
    ):
        href, raw = m.group(1), htmlmod.unescape(m.group(2))
        if "," not in raw:
            continue
        name, code = raw.rsplit(",", 1)
        code = code.strip().upper()
        if not code.startswith("SAR-"):
            continue
        out.append((code, name.strip(), m.group(1)))
    # dedupe by code
    seen = {}
    for code, name, href in out:
        seen[code] = (name, href)
    return [(c, seen[c][0], seen[c][1]) for c in sorted(seen)]


def parse_color_options(html: str, product_code: str) -> list[dict]:
    pattern = re.compile(
        rf'<SELECT[^>]*name="SELECT___{re.escape(product_code)}___23"[^>]*>(.*?)</SELECT>',
        re.I | re.S,
    )
    m = pattern.search(html)
    if not m:
        return []
    block = m.group(1)
    opts = []
    for om in re.finditer(r'<OPTION[^>]*value="([^"]*)"[^>]*>(.*?)</OPTION>', block, re.I | re.S):
        val = om.group(1).strip()
        text = re.sub(r"<[^>]+>", "", om.group(2))
        text = htmlmod.unescape(re.sub(r"\s+", " ", text).strip())
        if not val or not text or re.match(r"^(please|choose|select|--)", text, re.I):
            continue
        opts.append({"optionId": val, "label": text})
    return opts


def main() -> int:
    search_html = fetch(SEARCH_URL)
    products = parse_search_products(search_html)
    print(f"Found {len(products)} SAR products in search\n")

    report = []
    for i, (code, name, href) in enumerate(products):
        if i and i % 10 == 0:
            time.sleep(0.5)
        try:
            pdp = fetch(href)
        except Exception as e:
            report.append({"code": code, "name": name, "error": str(e)})
            continue
        colors = parse_color_options(pdp, code)
        if len(colors) <= 1:
            continue
        color_status = []
        for c in colors:
            oid = c["optionId"]
            s_url = f"{CDN}/{code}-{oid}-S.jpg"
            t_url = f"{CDN}/{code}-{oid}-T.jpg"
            color_status.append(
                {
                    **c,
                    "hasS": head_ok(s_url),
                    "hasT": head_ok(t_url),
                }
            )
            time.sleep(0.05)
        missing = [x for x in color_status if not (x["hasS"] and x["hasT"])]
        report.append(
            {
                "code": code,
                "name": name,
                "href": href,
                "colors": color_status,
                "missingCount": len(missing),
            }
        )
        print(
            f"{code}: {len(colors)} colors, missing images for {len(missing)}"
        )

    out = Path(__file__).resolve().parent / "sar-color-audit.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {out}")

    multi = [r for r in report if r.get("colors")]
    total_missing = sum(r.get("missingCount", 0) for r in multi)
    print(f"Multi-color products: {len(multi)}")
    print(f"Total missing color image pairs: {total_missing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
